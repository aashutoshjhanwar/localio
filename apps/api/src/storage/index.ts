import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { createHash, createHmac, randomUUID } from 'crypto';

export interface PresignOptions {
  contentType: string;
  expiresIn?: number; // seconds, default 900
  maxBytes?: number;  // optional content-length enforcement
}

export interface PresignResult {
  uploadUrl: string;         // client PUTs the file to this
  publicUrl: string;         // where the file will be readable
  headers: Record<string, string>; // headers the client must send
  method: 'PUT';
  expiresAt: string;
  key: string;
}

export interface StorageAdapter {
  kind: 'local' | 's3';
  put(key: string, data: Buffer, contentType: string): Promise<string>; // returns public URL
  delete(key: string): Promise<void>;
  presignPut?(key: string, opts: PresignOptions): Promise<PresignResult>;
  publicUrl(key: string): string;
}

class LocalDiskStorage implements StorageAdapter {
  kind = 'local' as const;
  constructor(private dir: string, private publicBase: string) {}

  async put(key: string, data: Buffer): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, key), data);
    return this.publicUrl(key);
  }

  async delete(key: string): Promise<void> {
    try { await unlink(path.join(this.dir, key)); } catch { /* ignore missing */ }
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }
}

// S3-compatible storage via native SigV4 (works with AWS S3 + Cloudflare R2 + MinIO).
class S3Storage implements StorageAdapter {
  kind = 's3' as const;
  constructor(
    private bucket: string,
    private region: string,
    private accessKeyId: string,
    private secretAccessKey: string,
    private endpoint?: string,
    private publicBaseOverride?: string,
  ) {}

  private hostAndPath(key: string): { host: string; pathPart: string; baseUrl: string } {
    const host = this.endpoint
      ? new URL(this.endpoint).host
      : `${this.bucket}.s3.${this.region}.amazonaws.com`;
    const pathPart = this.endpoint ? `/${this.bucket}/${key}` : `/${key}`;
    const baseUrl = this.endpoint ?? `https://${host}`;
    return { host, pathPart, baseUrl };
  }

  publicUrl(key: string): string {
    const { host, baseUrl } = this.hostAndPath(key);
    const base = this.publicBaseOverride
      || (this.endpoint ? `${this.endpoint}/${this.bucket}` : `https://${host}`);
    return `${base}/${key}`;
    void baseUrl;
  }

  private encodePath(p: string): string {
    return p.split('/').map(encodeURIComponent).join('/');
  }

  private signingKey(dateStamp: string): Buffer {
    const kDate = createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(this.region).digest();
    const kService = createHmac('sha256', kRegion).update('s3').digest();
    return createHmac('sha256', kService).update('aws4_request').digest();
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const { host, pathPart, baseUrl } = this.hostAndPath(key);
    const url = `${baseUrl}${pathPart}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash('sha256').update(data).digest('hex');

    const headers: Record<string, string> = {
      host,
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    const signedHeaderKeys = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join('');
    const signedHeaders = signedHeaderKeys.join(';');

    const canonicalRequest = [
      'PUT',
      this.encodePath(pathPart),
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signature = createHmac('sha256', this.signingKey(dateStamp))
      .update(stringToSign).digest('hex');

    const auth = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const resp = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, Authorization: auth },
      body: new Uint8Array(data),
    });
    if (!resp.ok) {
      throw new Error(`s3_put_failed ${resp.status}: ${await resp.text().catch(() => '')}`);
    }
    return this.publicUrl(key);
  }

  async delete(key: string): Promise<void> {
    const { host, pathPart, baseUrl } = this.hostAndPath(key);
    const url = `${baseUrl}${pathPart}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const emptyHash = createHash('sha256').update('').digest('hex');

    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': emptyHash,
      'x-amz-date': amzDate,
    };
    const signedHeaderKeys = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join('');
    const signedHeaders = signedHeaderKeys.join(';');

    const canonicalRequest = [
      'DELETE', this.encodePath(pathPart), '', canonicalHeaders, signedHeaders, emptyHash,
    ].join('\n');
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256', amzDate, scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signature = createHmac('sha256', this.signingKey(dateStamp))
      .update(stringToSign).digest('hex');
    const auth = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    await fetch(url, { method: 'DELETE', headers: { ...headers, Authorization: auth } })
      .catch(() => { /* best-effort */ });
  }

  async presignPut(key: string, opts: PresignOptions): Promise<PresignResult> {
    const expiresIn = Math.min(Math.max(opts.expiresIn ?? 900, 60), 3600);
    const { host, pathPart, baseUrl } = this.hostAndPath(key);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;

    // Sign only the host + content-type headers so the client's PUT matches exactly.
    const signedHeaderKeys = ['content-type', 'host'];
    const canonicalHeaders = `content-type:${opts.contentType}\nhost:${host}\n`;
    const signedHeaders = signedHeaderKeys.join(';');

    const qs = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresIn),
      'X-Amz-SignedHeaders': signedHeaders,
    });
    const canonicalQuery = qs.toString();

    const canonicalRequest = [
      'PUT',
      this.encodePath(pathPart),
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signature = createHmac('sha256', this.signingKey(dateStamp))
      .update(stringToSign).digest('hex');

    const uploadUrl = `${baseUrl}${pathPart}?${canonicalQuery}&X-Amz-Signature=${signature}`;
    return {
      uploadUrl,
      publicUrl: this.publicUrl(key),
      headers: { 'content-type': opts.contentType },
      method: 'PUT',
      expiresAt: new Date(now.getTime() + expiresIn * 1000).toISOString(),
      key,
    };
  }
}

export function buildStorage(): StorageAdapter {
  if (process.env.STORAGE_DRIVER === 's3' || process.env.S3_BUCKET) {
    return new S3Storage(
      process.env.S3_BUCKET!,
      process.env.S3_REGION ?? 'ap-south-1',
      process.env.S3_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID!,
      process.env.S3_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY!,
      process.env.S3_ENDPOINT,
      process.env.S3_PUBLIC_BASE,
    );
  }
  return new LocalDiskStorage(
    path.resolve(process.cwd(), 'uploads'),
    process.env.UPLOADS_PUBLIC_BASE ?? '/uploads',
  );
}

export function makeKey(filename: string, prefix = 'u'): string {
  const ext = (filename.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '').toLowerCase();
  const safeExt = /^\.(jpg|jpeg|png|webp|gif|mp4|mov|pdf|heic)$/.test(ext) ? ext : '.bin';
  return `${prefix}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${randomUUID()}${safeExt}`;
}

// keyFromUrl: reverse a public URL back to the storage key so we can delete it.
// Best-effort — returns null if URL doesn't match the configured base.
export function keyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, 'http://localhost');
    // local driver: /uploads/<key>
    const localBase = process.env.UPLOADS_PUBLIC_BASE ?? '/uploads';
    if (u.pathname.startsWith(localBase + '/')) {
      return u.pathname.slice(localBase.length + 1);
    }
    // s3 virtual-host: bucket.s3.region.amazonaws.com/<key>
    // s3 path-style w/ endpoint: <endpoint-host>/<bucket>/<key>
    const bucket = process.env.S3_BUCKET;
    if (bucket) {
      if (u.hostname.startsWith(`${bucket}.`)) {
        return u.pathname.replace(/^\//, '');
      }
      if (u.pathname.startsWith(`/${bucket}/`)) {
        return u.pathname.slice(bucket.length + 2);
      }
      const publicBase = process.env.S3_PUBLIC_BASE;
      if (publicBase && url.startsWith(publicBase + '/')) {
        return url.slice(publicBase.length + 1);
      }
    }
  } catch { /* ignore */ }
  return null;
}

export const storage = buildStorage();

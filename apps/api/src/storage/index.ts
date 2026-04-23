import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { createHash, createHmac, randomUUID } from 'crypto';

export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<string>; // returns public URL
}

class LocalDiskStorage implements StorageAdapter {
  constructor(private dir: string, private publicBase: string) {}

  async put(key: string, data: Buffer): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, key), data);
    return `${this.publicBase}/${key}`;
  }
}

// S3-compatible storage via native SigV4 (works with AWS S3 + Cloudflare R2 + MinIO).
class S3Storage implements StorageAdapter {
  constructor(
    private bucket: string,
    private region: string,
    private accessKeyId: string,
    private secretAccessKey: string,
    private endpoint?: string,
    private publicBaseOverride?: string,
  ) {}

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const host = this.endpoint
      ? new URL(this.endpoint).host
      : `${this.bucket}.s3.${this.region}.amazonaws.com`;
    const pathPart = this.endpoint ? `/${this.bucket}/${key}` : `/${key}`;
    const url = `${this.endpoint ?? `https://${host}`}${this.endpoint ? `/${this.bucket}/${key}` : `/${key}`}`;

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
      pathPart.split('/').map(encodeURIComponent).join('/'),
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

    const kDate = createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(this.region).digest();
    const kService = createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const auth = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const resp = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, Authorization: auth },
      body: new Uint8Array(data),
    });
    if (!resp.ok) {
      throw new Error(`s3_put_failed ${resp.status}: ${await resp.text().catch(() => '')}`);
    }
    const base = this.publicBaseOverride
      || (this.endpoint ? `${this.endpoint}/${this.bucket}` : `https://${host}`);
    return `${base}/${key}`;
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

export function makeKey(filename: string): string {
  const ext = (filename.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? '').toLowerCase();
  return `${Date.now()}-${randomUUID()}${ext || '.bin'}`;
}

export const storage = buildStorage();

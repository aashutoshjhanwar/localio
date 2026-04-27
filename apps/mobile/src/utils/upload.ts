import { Api } from '../api/client';

// Smart uploader: presign → direct PUT when S3 is configured, else fall back to base64.
// Pass a local file URI (e.g. from expo-image-picker). Returns the public URL + key.
export async function uploadFile(input: {
  uri: string;
  filename: string;
  contentType: string;
}): Promise<{ url: string; key: string }> {
  const { uri, filename, contentType } = input;

  // Peek at the file size so the API can apply its content-length check.
  let size: number | undefined;
  try {
    const head = await fetch(uri, { method: 'HEAD' }).catch(() => null);
    const cl = head?.headers.get('content-length');
    if (cl) size = parseInt(cl, 10);
  } catch { /* ignore — size is optional */ }

  const presign = await Api.presignUpload({ filename, contentType, size }).catch(() => null);

  // Direct-to-S3 fast path.
  if (presign && presign.driver === 's3' && presign.uploadUrl) {
    const blob = await (await fetch(uri)).blob();
    const put = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: presign.headers ?? { 'content-type': contentType },
      body: blob,
    });
    if (!put.ok) throw new Error(`upload_failed_${put.status}`);
    return { url: presign.publicUrl!, key: presign.key };
  }

  // Fallback: base64 POST through the API (dev / local-disk driver).
  const blob = await (await fetch(uri)).blob();
  const base64 = await blobToBase64(blob);
  const r = await Api.uploadBase64({ filename, contentType, base64 });
  return { url: r.url, key: r.key };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = typeof reader.result === 'string' ? reader.result : '';
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

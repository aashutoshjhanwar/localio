import * as ImageManipulator from 'expo-image-manipulator';

export async function compressToBase64(
  uri: string,
  opts: { maxWidth?: number; quality?: number } = {},
): Promise<string> {
  const { maxWidth = 1280, quality = 0.7 } = opts;
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!out.base64) throw new Error('Could not read image');
  return out.base64;
}

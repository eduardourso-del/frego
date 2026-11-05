/**
 * Campaign photos are drawn at 56px in the app, and also have to survive a
 * full-width phone. 1200px on the long edge is enough for both, and turns a
 * multi-megabyte camera photo into a file the phone can fetch quickly.
 */
const REWARD_MAX_EDGE = 1200;
const REWARD_JPEG_QUALITY = 0.8;
/** Skip a second compression pass when the file is already small. */
const SKIP_REENCODE_BYTES = 180 * 1024;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

/** Resize and compress a campaign photo before it is stored. */
export async function prepareRewardImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Envie uma imagem (JPG, PNG ou WebP)');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Imagem até 15 MB');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Não foi possível ler a imagem.');
  }

  try {
    const width = bitmap.width;
    const height = bitmap.height;
    if (!width || !height) {
      throw new Error('Não foi possível ler a imagem.');
    }

    const edge = Math.max(width, height);
    const alreadyFits =
      edge <= REWARD_MAX_EDGE &&
      file.size <= SKIP_REENCODE_BYTES &&
      (file.type === 'image/jpeg' || file.type === 'image/webp');
    if (alreadyFits) return file;

    const scale = Math.min(1, REWARD_MAX_EDGE / edge);
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas não disponível');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(bitmap, 0, 0, outW, outH);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error('Não foi possível gerar a imagem.')),
        'image/jpeg',
        REWARD_JPEG_QUALITY,
      );
    });

    if (blob.size >= file.size && scale === 1 && file.type === 'image/jpeg') {
      return file;
    }

    return new File([blob], `reward-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
  } finally {
    bitmap.close();
  }
}

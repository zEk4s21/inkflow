/** Lado mayor máximo de las fotos del portfolio. Suficiente para pantallas retina sin pesar de más. */
export const MAX_IMAGE_SIDE = 2000;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export type PreparedImage = { blob: Blob; width: number; height: number; extension: "webp" | "jpg" };

/**
 * Achica y recomprime la foto en el navegador antes de subirla (respeta la orientación EXIF).
 * También descarta los metadatos de la cámara, como la ubicación GPS.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type)) throw new Error("Subí una foto JPG, PNG o WebP.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("La foto pesa más de 30 MB.");

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Tu navegador no pudo procesar la foto.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp");
  // Safari viejo no codifica WebP y devuelve PNG: en ese caso se usa JPEG.
  if (webp?.type === "image/webp") return { blob: webp, width, height, extension: "webp" };
  const jpeg = await toBlob(canvas, "image/jpeg");
  if (!jpeg) throw new Error("Tu navegador no pudo procesar la foto.");
  return { blob: jpeg, width, height, extension: "jpg" };
}

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
}

import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Tamaño recomendado para la vista previa de WhatsApp, Instagram, Facebook y X. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

const INK = "#0a0a0b";
const FG = "#f2efea";
const MUTED = "#a9a49c";
const ACCENT = "#d9322b";

/** La foto se manda embebida: si no se puede bajar, la imagen sale igual, sin foto. */
async function photoDataUrl(src: string | undefined) {
  if (!src) return null;
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Imagen de vista previa al compartir un link: el nombre (o el trabajo) con la tipografía de la
 * página y una foto del portfolio. Solo usa datos públicos.
 */
export async function renderShareImage({
  eyebrow,
  title,
  details,
  photoSrc,
}: {
  eyebrow: string | null;
  title: string;
  details: string[];
  photoSrc?: string;
}) {
  const [anton, photo] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/Anton-Regular.ttf")),
    photoDataUrl(photoSrc),
  ]);
  const titleSize = title.length <= 8 ? 190 : title.length <= 16 ? 120 : 76;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: INK, color: FG }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 64px", gap: 28 }}>
          {eyebrow && (
            <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 22, letterSpacing: 5, color: MUTED, textTransform: "uppercase" }}>
              <div style={{ width: 40, height: 2, background: ACCENT }} />
              {eyebrow}
            </div>
          )}
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: titleSize, lineHeight: 0.9, textTransform: "uppercase" }}>{title}</div>
          {details.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, fontSize: 30, color: MUTED }}>
              {details.map((detail, index) => (
                <div key={detail} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {index > 0 && <div style={{ width: 8, height: 8, borderRadius: 8, background: ACCENT }} />}
                  {detail}
                </div>
              ))}
            </div>
          )}
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse solo entiende <img>.
          <img src={photo} alt="" width={460} height={630} style={{ width: 460, height: 630, objectFit: "cover" }} />
        )}
      </div>
    ),
    { ...SHARE_IMAGE_SIZE, fonts: [{ name: "Anton", data: anton, style: "normal", weight: 400 }] },
  );
}

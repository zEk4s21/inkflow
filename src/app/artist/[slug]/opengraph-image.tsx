import { getPublicArtist, getPublishedWorks } from "@/server/artists/public-artist";
import { renderShareImage, SHARE_IMAGE_SIZE } from "@/server/artists/share-image";

export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";
export const alt = "Vista previa de la página del tatuador";

export default async function ShareImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [artist, works] = await Promise.all([getPublicArtist(slug), getPublishedWorks(slug)]);
  return renderShareImage({
    eyebrow: artist?.locationLabel ?? null,
    title: artist?.artistName ?? "INKFLOW",
    details: artist?.styles ?? [],
    photoSrc: works[0]?.image.src,
  });
}

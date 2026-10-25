import { getPublicArtist, getPublishedWork } from "@/server/artists/public-artist";
import { renderShareImage, SHARE_IMAGE_SIZE } from "@/server/artists/share-image";

export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";
export const alt = "Vista previa de un trabajo del portfolio";

export default async function ShareImage({ params }: { params: Promise<{ slug: string; workId: string }> }) {
  const { slug, workId } = await params;
  const [artist, work] = await Promise.all([getPublicArtist(slug), getPublishedWork(slug, workId)]);
  return renderShareImage({
    eyebrow: artist?.artistName ?? null,
    title: work?.title ?? "INKFLOW",
    details: work ? [work.category, ...(work.bodyZone ? [work.bodyZone] : [])] : [],
    photoSrc: work?.image.src,
  });
}

import { describe, expect, it } from "vitest";
import { INSTAGRAM_CATEGORY, mediaToWorks, titleFromCaption, type InstagramMedia } from "@/lib/instagram";

const media = (overrides: Partial<InstagramMedia>): InstagramMedia => ({
  id: "1",
  media_type: "IMAGE",
  media_url: "https://scontent.cdninstagram.com/a.jpg",
  permalink: "https://www.instagram.com/p/abc/",
  timestamp: "2026-11-01T12:00:00+0000",
  ...overrides,
});

describe("titleFromCaption", () => {
  it("usa la primera línea sin hashtags ni menciones", () => {
    expect(titleFromCaption("\nVirgen con rosario #blackandgrey @cliente\nSesión de 6 horas")).toBe("Virgen con rosario");
  });

  it("recorta los textos largos", () => {
    const title = titleFromCaption("a".repeat(100));
    expect(title).toHaveLength(60);
    expect(title.endsWith("…")).toBe(true);
  });

  it("tiene un título por defecto si no hay texto útil", () => {
    expect(titleFromCaption(undefined)).toBe("Publicación de Instagram");
    expect(titleFromCaption("#tattoo #ink")).toBe("Publicación de Instagram");
  });
});

describe("mediaToWorks", () => {
  it("convierte fotos y carruseles con su imagen", () => {
    const [work] = mediaToWorks([media({ caption: "Tigre", like_count: 10, comments_count: 2 })]);
    expect(work).toMatchObject({
      id: "ig-1",
      title: "Tigre",
      category: INSTAGRAM_CATEGORY,
      image: { src: "https://scontent.cdninstagram.com/a.jpg", alt: "Tigre" },
      instagram: { permalink: "https://www.instagram.com/p/abc/", likeCount: 10, commentsCount: 2, videoUrl: null },
    });
  });

  it("en los videos usa la miniatura como foto y guarda el video", () => {
    const [work] = mediaToWorks([
      media({ media_type: "VIDEO", media_url: "https://x.fbcdn.net/v.mp4", thumbnail_url: "https://x.fbcdn.net/t.jpg" }),
    ]);
    expect(work.image.src).toBe("https://x.fbcdn.net/t.jpg");
    expect(work.instagram?.videoUrl).toBe("https://x.fbcdn.net/v.mp4");
  });

  it("saltea las publicaciones sin imagen y no inventa likes", () => {
    const works = mediaToWorks([media({ id: "2", media_url: undefined }), media({ id: "3" })]);
    expect(works.map((work) => work.id)).toEqual(["ig-3"]);
    expect(works[0].instagram?.likeCount).toBeNull();
  });
});

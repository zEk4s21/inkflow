import { describe, expect, it } from "vitest";
import { instagramEmbedUrl, normalizeInstagramPostUrl } from "@/lib/instagram";

describe("normalizeInstagramPostUrl", () => {
  it.each([
    ["https://www.instagram.com/p/DAbc123xyz/", "https://www.instagram.com/p/DAbc123xyz/"],
    ["https://www.instagram.com/p/DAbc123xyz/?utm_source=ig_web_copy_link&igsh=abc", "https://www.instagram.com/p/DAbc123xyz/"],
    ["instagram.com/reel/C9-x_Yz12/", "https://www.instagram.com/reel/C9-x_Yz12/"],
    ["https://instagram.com/reels/C9xYz12", "https://www.instagram.com/reel/C9xYz12/"],
    ["https://www.instagram.com/tattoobyesti/p/DAbc123xyz/", "https://www.instagram.com/p/DAbc123xyz/"],
    ["  https://m.instagram.com/tv/DAbc123xyz  ", "https://www.instagram.com/p/DAbc123xyz/"],
  ])("acepta %s", (input, expected) => {
    expect(normalizeInstagramPostUrl(input)).toBe(expected);
  });

  it.each([
    "https://www.instagram.com/tattoobyesti/",
    "https://www.instagram.com/stories/tattoobyesti/123/",
    "https://evil.com/instagram.com/p/DAbc123xyz/",
    "https://www.instagram.com.evil.com/p/DAbc123xyz/",
    "javascript:alert(1)",
    "",
  ])("rechaza %s", (input) => {
    expect(normalizeInstagramPostUrl(input)).toBeNull();
  });
});

it("arma el link del embed", () => {
  expect(instagramEmbedUrl("https://www.instagram.com/p/DAbc123xyz/")).toBe("https://www.instagram.com/p/DAbc123xyz/embed/captioned/");
});

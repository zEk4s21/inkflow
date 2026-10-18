import { describe, expect, it } from "vitest";
import { parseFaq, parseProcess } from "@/server/artists/page-content";
import { instagramHandleSchema, profileFormSchema } from "@/server/settings/schemas";

describe("instagramHandleSchema", () => {
  it.each([
    ["tattoobyesti", "tattoobyesti"],
    ["@tattoobyesti", "tattoobyesti"],
    ["https://www.instagram.com/tattoobyesti/", "tattoobyesti"],
    ["instagram.com/tattoobyesti?igsh=abc", "tattoobyesti"],
    ["", null],
  ])("%s → %s", (input, expected) => {
    const result = instagramHandleSchema.safeParse(input);
    expect(result.success && result.data).toBe(expected);
  });

  it("rechaza caracteres inválidos", () => {
    expect(instagramHandleSchema.safeParse("usuario con espacios").success).toBe(false);
  });
});

describe("profileFormSchema", () => {
  const base = {
    displayName: "Esti",
    fullName: "",
    bio: "  ",
    styles: " Black & Grey, ,Blackwork ",
    locationLabel: "",
    instagramHandle: "@tattoobyesti",
    isPublic: true,
  };

  it("normaliza vacíos a null y separa estilos", () => {
    const parsed = profileFormSchema.parse(base);
    expect(parsed).toMatchObject({
      fullName: null,
      bio: null,
      locationLabel: null,
      styles: ["Black & Grey", "Blackwork"],
      instagramHandle: "tattoobyesti",
    });
  });

  it("exige nombre artístico", () => {
    const result = profileFormSchema.safeParse({ ...base, displayName: "   " });
    expect(result.success).toBe(false);
  });
});

describe("parseProcess / parseFaq", () => {
  it("descarta elementos con forma inválida", () => {
    expect(parseProcess([{ title: "Idea", description: "Contás" }, { title: 3 }, "x"])).toEqual([
      { title: "Idea", description: "Contás" },
    ]);
    expect(parseFaq(null)).toEqual([]);
  });
});

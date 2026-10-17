import { describe, expect, it } from "vitest";
import { categoriesWithWorks } from "@/lib/portfolio";
import type { PortfolioWork } from "@/server/artists/types";

const work = (id: string, category: string): PortfolioWork => ({
  id,
  title: id,
  category,
  bodyZone: null,
  description: null,
  image: { src: "", alt: "", width: 1, height: 1 },
});

describe("categoriesWithWorks", () => {
  it("cuenta trabajos por categoría en orden de aparición", () => {
    expect(categoriesWithWorks([work("a", "Religioso"), work("b", "Oriental"), work("c", "Religioso")])).toEqual([
      { name: "Religioso", count: 2 },
      { name: "Oriental", count: 1 },
    ]);
  });

  it("no inventa categorías si no hay trabajos", () => {
    expect(categoriesWithWorks([])).toEqual([]);
  });
});

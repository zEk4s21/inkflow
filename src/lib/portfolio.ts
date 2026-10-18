import type { PortfolioWork } from "@/server/artists/types";

/** Categorías con al menos un trabajo, en orden de aparición. Nunca devuelve categorías vacías. */
export function categoriesWithWorks(works: PortfolioWork[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const work of works) {
    counts.set(work.category, (counts.get(work.category) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count }));
}

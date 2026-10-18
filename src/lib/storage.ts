export const PORTFOLIO_BUCKET = "portfolio";

/** URL pública de una foto del bucket del portfolio. */
export function portfolioImageUrl(supabaseUrl: string, path: string) {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${PORTFOLIO_BUCKET}/${path}`;
}

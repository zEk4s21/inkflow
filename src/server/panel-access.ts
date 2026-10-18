import "server-only";

/**
 * El panel todavía no tiene login (llega en la Fase 2.2). Hasta entonces, en producción
 * solo se muestra si se habilita explícitamente la vista previa, para no exponer
 * una URL administrativa sin protección.
 */
export function isPanelPreviewAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.INKFLOW_PANEL_PREVIEW === "1";
}

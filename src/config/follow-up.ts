/** Tipos de control. La migración de la Fase 5.4 replica esta lista en un CHECK de Postgres. */
export const FOLLOW_UP_KINDS = ["healing_check", "touch_up", "custom"] as const;
export type FollowUpKind = (typeof FOLLOW_UP_KINDS)[number];

export const FOLLOW_UP_LABELS: Record<FollowUpKind, string> = {
  healing_check: "Ver cómo cicatrizó",
  touch_up: "Ofrecer retoque",
  custom: "Control",
};

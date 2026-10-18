import { describe, expect, it } from "vitest";
import { isActive, PANEL_NAV } from "@/components/panel/nav-items";

describe("navegación del panel", () => {
  it("marca Inicio solo en /panel exacto", () => {
    expect(isActive("/panel", "/panel")).toBe(true);
    expect(isActive("/panel/agenda", "/panel")).toBe(false);
  });

  it("marca secciones y sus subrutas", () => {
    expect(isActive("/panel/solicitudes/123", "/panel/solicitudes")).toBe(true);
    expect(isActive("/panel/solicitudesx", "/panel/solicitudes")).toBe(false);
  });

  it("la barra inferior del celular tiene como máximo 5 accesos", () => {
    expect(PANEL_NAV.filter((item) => item.mobile).length).toBeLessThanOrEqual(5);
  });
});

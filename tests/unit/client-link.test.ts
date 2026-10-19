import { describe, expect, it } from "vitest";
import { CLIENT_TOKEN_PATTERN, clientLinkPath, generateClientToken, hashClientToken } from "@/server/client-link/token";

describe("token del link para el cliente", () => {
  it("tiene 43 caracteres base64url y no se repite", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateClientToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(CLIENT_TOKEN_PATTERN);
  });

  it("se guarda como sha256 en hex, que respeta el CHECK de la base", () => {
    const hash = hashClientToken("abc");
    expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rechaza tokens con otro formato", () => {
    for (const token of ["", "corto", "a".repeat(44), `${"a".repeat(42)}/`, `${"a".repeat(42)}=`]) {
      expect(token).not.toMatch(CLIENT_TOKEN_PATTERN);
    }
    expect(clientLinkPath("x")).toBe("/seguimiento/x");
  });
});

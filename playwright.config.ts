import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** Mismo build con el asistente en modo simulado (sin IA). Igual que SIMULATED_AI_PORT en tests/e2e/helpers.ts. */
const SIMULATED_AI_PORT = 3101;

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Permite usar un Chromium ya instalado (ej. entornos sin descarga de browsers).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `pnpm start --port ${PORT}`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm start --port ${SIMULATED_AI_PORT}`,
      port: SIMULATED_AI_PORT,
      reuseExistingServer: !process.env.CI,
      env: { AI_PROVIDER: "simulated", INKFLOW_ALLOW_SIMULATED_AI: "1" },
    },
  ],
});

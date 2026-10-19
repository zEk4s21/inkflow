import type { NextConfig } from "next";

// Las fotos del portfolio vienen del Storage de Supabase.
const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");
const isLocalSupabase = ["127.0.0.1", "localhost"].includes(supabaseUrl.hostname);

const nextConfig: NextConfig = {
  cacheComponents: true,
  // El link de seguimiento lleva un token privado en la ruta: que no salga en el Referer ni se indexe.
  async headers() {
    return [
      {
        source: "/seguimiento/:token",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [new URL(`${supabaseUrl.origin}/storage/v1/object/public/portfolio/**`)],
    // Solo con Supabase local (desarrollo y CI). En producción el host es público.
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

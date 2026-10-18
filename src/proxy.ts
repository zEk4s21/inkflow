import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/config/env";
import type { Database } from "@/types/database.types";

/**
 * Refresca la sesión de Supabase antes de renderizar rutas privadas: los Server Components
 * no pueden escribir cookies, así que el token renovado se guarda acá.
 * Sin sesión, /panel redirige a /ingresar antes de renderizar. Es solo un atajo: el panel
 * vuelve a validar la sesión y la RLS filtra los datos.
 */
export async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && request.nextUrl.pathname.startsWith("/panel")) {
    return NextResponse.redirect(new URL("/ingresar", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/panel/:path*", "/ingresar"],
};

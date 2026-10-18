import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "magiclink"];

/**
 * Destino del link que llega por email. Valida el token en el servidor, así el link
 * funciona aunque se abra en otro navegador o dispositivo que el que lo pidió.
 * Siempre redirige a rutas internas: nunca a una URL que venga en la query.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL("/panel", request.url));
  }

  return NextResponse.redirect(new URL("/ingresar?error=link", request.url));
}

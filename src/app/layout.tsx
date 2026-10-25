import type { Metadata } from "next";
import { Anton, Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  // Las vistas previas al compartir necesitan URLs absolutas.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "INKFLOW",
  description: "Plataforma para tatuadores: portfolio, consultas y turnos.",
  // Hasta que haya contenido público real.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" data-scroll-behavior="smooth" className={`${geistSans.variable} ${anton.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

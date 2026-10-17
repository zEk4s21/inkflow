import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-display text-6xl uppercase">INKFLOW</h1>
      <p className="max-w-md text-fg-muted">En construcción.</p>
      <Link href="/artist/esti" className={buttonClasses({ variant: "secondary" })}>
        Ver la página de ejemplo
      </Link>
    </main>
  );
}

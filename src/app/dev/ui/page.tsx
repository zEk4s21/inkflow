import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, RequestStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { REQUEST_STATUSES } from "@/config/request-status";
import { formatMoney } from "@/lib/format";
import { InteractiveDemos } from "./interactive-demos";

export const metadata: Metadata = { title: "Sistema de diseño · INKFLOW" };

const swatches = [
  ["ink", "bg-ink"],
  ["surface-1", "bg-surface-1"],
  ["surface-2", "bg-surface-2"],
  ["surface-3", "bg-surface-3"],
  ["line-strong", "bg-line-strong"],
  ["fg-subtle", "bg-fg-subtle"],
  ["fg-muted", "bg-fg-muted"],
  ["fg", "bg-fg"],
  ["accent", "bg-accent"],
  ["accent-text", "bg-accent-text"],
] as const;

/** Catálogo del sistema de diseño. Solo existe en desarrollo. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-20 px-4 py-16 sm:px-8">
      <header className="flex flex-col gap-4 animate-rise">
        <p className="text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">Sistema de diseño · v0.1</p>
        <h1 className="font-display text-6xl leading-[0.95] uppercase sm:text-8xl">
          Del boceto <span className="text-accent-text">a la piel</span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-fg-muted">
          Negro, grafito y blanco para que la obra black &amp; grey sea la protagonista. Títulos condensados con
          carácter y un único acento rojo usado con moderación.
        </p>
      </header>

      <Section title="Color">
        <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
          {swatches.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-2">
              <div className={`${cls} aspect-square rounded-md border border-line`} />
              <span className="text-xs text-fg-subtle">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía">
        <div className="flex flex-col gap-6">
          <p className="font-display text-5xl uppercase sm:text-6xl">Black &amp; Grey</p>
          <p className="font-display text-3xl text-fg-muted">Puntillismo de arrastre · Blackwork</p>
          <p className="max-w-prose leading-relaxed text-fg-muted">
            Texto de interfaz en Geist. Pensado para leerse cómodo en el celular, con interlineado amplio y contraste
            suficiente en fondos oscuros. Precio de ejemplo: {formatMoney(185000)}.
          </p>
        </div>
      </Section>

      <Section title="Botones">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Iniciar mi proyecto</Button>
          <Button variant="secondary" size="lg">
            Ver trabajos
          </Button>
          <Button variant="ghost">Preguntas frecuentes</Button>
          <Button variant="danger">Cancelar turno</Button>
          <Button disabled>Deshabilitado</Button>
        </div>
        <InteractiveDemos />
      </Section>

      <Section title="Formularios">
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField label="Nombre" placeholder="Cómo querés que te llamemos" required autoComplete="name" />
          <TextField
            label="Email"
            type="email"
            defaultValue="sofia@"
            error="Revisá el email: le falta el dominio (por ejemplo, @gmail.com)."
          />
          <SelectField label="Zona del cuerpo" defaultValue="">
            <option value="" disabled>
              Elegí una zona
            </option>
            <option>Antebrazo</option>
            <option>Espalda</option>
            <option>Pierna</option>
          </SelectField>
          <TextField label="Tamaño aproximado" hint="En centímetros. Si no sabés, dejalo vacío." inputMode="numeric" />
          <div className="sm:col-span-2">
            <TextAreaField label="Contanos tu idea" placeholder="Un dragón que represente un cambio en mi vida…" />
          </div>
        </div>
      </Section>

      <Section title="Estados">
        <div className="flex flex-wrap gap-2">
          {REQUEST_STATUSES.map((status) => (
            <RequestStatusBadge key={status} status={status} />
          ))}
          <Badge tone="danger">Pago vencido</Badge>
        </div>
      </Section>

      <Section title="Carga y vacío">
        <div className="grid items-start gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-1 p-5">
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <EmptyState
            title="Todavía no hay solicitudes"
            description="Cuando alguien te consulte desde tu página o el asistente, la vas a ver acá."
            action={<Button variant="secondary">Copiar link de mi página</Button>}
          />
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6 border-t border-line pt-8">
      <h2 className="text-xs font-medium tracking-[0.2em] text-fg-subtle uppercase">{title}</h2>
      {children}
    </section>
  );
}

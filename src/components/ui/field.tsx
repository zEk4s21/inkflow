import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border bg-surface-1 px-4 text-fg placeholder:text-fg-subtle " +
  "transition-colors duration-200 hover:border-fg-subtle " +
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 " +
  "disabled:opacity-50 aria-invalid:border-danger";

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /**
   * Anunciar el error apenas aparece. Los formularios largos lo apagan: ya anuncian un resumen y
   * llevan el foco al primer campo con error, que lee este texto por aria-describedby.
   */
  announceError?: boolean;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

/** Etiqueta, ayuda y error conectados por aria-describedby para lectores de pantalla. */
function FieldShell({ label, hint, error, required, announceError = true, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {required && (
          <span className="text-fg-subtle" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role={announceError ? "alert" : undefined} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type Common = { label: string; hint?: string; error?: string; announceError?: boolean };

export function TextField({ label, hint, error, className, required, announceError, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} announceError={announceError}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, "h-12 border-line-input", className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, className, required, announceError, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} announceError={announceError}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, "min-h-32 border-line-input py-3 leading-relaxed", className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  required,
  announceError,
  children,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} announceError={announceError}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
        <select
          id={id}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, "h-12 appearance-none border-line-input pr-10", className)}
          {...props}
        >
          {children}
        </select>
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-fg-subtle"
          >
            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </FieldShell>
  );
}

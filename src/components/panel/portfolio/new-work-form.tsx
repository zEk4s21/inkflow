"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { prepareImage, type PreparedImage } from "@/lib/image-resize";
import { PORTFOLIO_BUCKET } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { createWork } from "@/server/portfolio/actions";
import { EMPTY_WORK, WorkFields } from "./work-fields";

export function NewWorkForm({ workspaceId, categories }: { workspaceId: string; categories: string[] }) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [values, setValues] = useState(EMPTY_WORK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, startSaving] = useTransition();
  const fileId = useId();

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function reset() {
    setImage(null);
    setPreview(null);
    setValues(EMPTY_WORK);
    setErrors({});
    setMessage(null);
  }

  async function onFile(file: File | undefined) {
    setErrors({});
    if (!file) return;
    setPreparing(true);
    try {
      const prepared = await prepareImage(file);
      setImage(prepared);
      setPreview(URL.createObjectURL(prepared.blob));
    } catch (error) {
      setImage(null);
      setPreview(null);
      setErrors({ image: error instanceof Error ? error.message : "No se pudo leer la foto." });
    } finally {
      setPreparing(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!image) {
      setErrors({ image: "Elegí una foto." });
      return;
    }
    startSaving(async () => {
      setMessage(null);
      const supabase = createSupabaseBrowserClient();
      const path = `${workspaceId}/${crypto.randomUUID()}.${image.extension}`;
      const upload = await supabase.storage
        .from(PORTFOLIO_BUCKET)
        .upload(path, image.blob, { contentType: image.blob.type, cacheControl: "31536000" });
      if (upload.error) {
        setMessage("No se pudo subir la foto. Revisá tu conexión y probá de nuevo.");
        return;
      }

      const result = await createWork({
        ...values,
        imagePath: path,
        imageWidth: image.width,
        imageHeight: image.height,
      });
      if (!result.ok) {
        // Si el trabajo no se creó, la foto no queda huérfana en el bucket.
        await supabase.storage.from(PORTFOLIO_BUCKET).remove([path]);
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
        return;
      }
      reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button className="self-start" onClick={() => setOpen(true)}>
        Agregar trabajo
      </Button>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6 rounded-lg border border-line bg-surface-1/40 p-6">
      <h2 className="font-medium">Nuevo trabajo</h2>
      <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
        <div className="flex flex-col gap-2">
          <label htmlFor={fileId} className="text-sm font-medium">
            Foto <span className="text-fg-subtle" aria-hidden>*</span>
          </label>
          <label
            htmlFor={fileId}
            className="flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-line-strong bg-surface-1 text-center text-sm text-fg-muted hover:border-fg-muted"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:)
              <img src={preview} alt="Vista previa de la foto elegida" className="h-full w-full object-cover" />
            ) : (
              <span className="px-4">{preparing ? "Procesando…" : "Tocá para elegir una foto"}</span>
            )}
          </label>
          <input
            id={fileId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-describedby={errors.image ? `${fileId}-error` : undefined}
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          {errors.image && (
            <p id={`${fileId}-error`} role="alert" className="text-sm text-danger">
              {errors.image}
            </p>
          )}
        </div>
        <WorkFields values={values} onChange={setValues} errors={errors} categories={categories} idPrefix="nuevo" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={saving} disabled={preparing}>
          Guardar trabajo
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancelar
        </Button>
        {message && (
          <p role="status" className="text-sm text-danger">
            {message}
          </p>
        )}
      </div>
    </form>
  );
}

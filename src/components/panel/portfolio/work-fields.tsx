"use client";

import { TextAreaField, TextField } from "@/components/ui/field";

export type WorkFieldValues = {
  title: string;
  category: string;
  bodyZone: string;
  description: string;
  altText: string;
  published: boolean;
};

export const EMPTY_WORK: WorkFieldValues = {
  title: "",
  category: "",
  bodyZone: "",
  description: "",
  altText: "",
  published: true,
};

/** Campos de un trabajo, compartidos por el alta y la edición. */
export function WorkFields({
  values,
  onChange,
  errors,
  categories,
  idPrefix,
}: {
  values: WorkFieldValues;
  onChange: (values: WorkFieldValues) => void;
  errors: Record<string, string>;
  categories: string[];
  idPrefix: string;
}) {
  const set = (name: keyof WorkFieldValues) => (event: { target: { value: string } }) =>
    onChange({ ...values, [name]: event.target.value });
  const listId = `${idPrefix}-categorias`;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <TextField label="Título" required maxLength={80} value={values.title} onChange={set("title")} error={errors.title} />
        <TextField
          label="Categoría"
          required
          maxLength={40}
          list={listId}
          hint="Elegí una existente o escribí una nueva."
          value={values.category}
          onChange={set("category")}
          error={errors.category}
        />
        <datalist id={listId}>
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </div>
      <TextField label="Zona del cuerpo" maxLength={40} value={values.bodyZone} onChange={set("bodyZone")} error={errors.bodyZone} />
      <TextAreaField
        label="Descripción"
        rows={3}
        maxLength={600}
        value={values.description}
        onChange={set("description")}
        error={errors.description}
      />
      <TextField
        label="Texto alternativo"
        maxLength={200}
        hint="Describe la foto para quien no la ve. Si lo dejás vacío se usa el título."
        value={values.altText}
        onChange={set("altText")}
        error={errors.altText}
      />
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={values.published}
          onChange={(event) => onChange({ ...values, published: event.target.checked })}
          className="size-5 accent-(--color-accent)"
        />
        Publicado en mi página
      </label>
    </div>
  );
}

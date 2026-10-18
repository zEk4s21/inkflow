"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import type { FaqItem, ProcessStep } from "@/server/artists/page-content";
import { updatePageContent, type FormState } from "@/server/settings/actions";
import { FormStatus } from "./form-status";

const initialState: FormState = { status: "idle" };

export function PageContentForm({ process, faq }: { process: ProcessStep[]; faq: FaqItem[] }) {
  const [state, formAction, pending] = useActionState(updatePageContent, initialState);
  const [steps, setSteps] = useState(process);
  const [questions, setQuestions] = useState(faq);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-10" noValidate>
      <input type="hidden" name="process" value={JSON.stringify(steps)} />
      <input type="hidden" name="faq" value={JSON.stringify(questions)} />

      <ListEditor
        title="El proceso"
        description="Los pasos que ve el cliente antes de consultarte."
        addLabel="Agregar paso"
        items={steps}
        error={errors.process}
        empty={{ title: "", description: "" }}
        onChange={setSteps}
        render={(step, index, update) => (
          <>
            <TextField
              label={`Paso ${index + 1}`}
              value={step.title}
              maxLength={80}
              error={errors[`process.${index}.title`]}
              onChange={(event) => update({ ...step, title: event.target.value })}
            />
            <TextAreaField
              label="Descripción"
              rows={2}
              value={step.description}
              maxLength={400}
              error={errors[`process.${index}.description`]}
              onChange={(event) => update({ ...step, description: event.target.value })}
            />
          </>
        )}
      />

      <ListEditor
        title="Preguntas frecuentes"
        description="Respuestas a lo que más te preguntan."
        addLabel="Agregar pregunta"
        items={questions}
        error={errors.faq}
        empty={{ question: "", answer: "" }}
        onChange={setQuestions}
        render={(item, index, update) => (
          <>
            <TextField
              label={`Pregunta ${index + 1}`}
              value={item.question}
              maxLength={160}
              error={errors[`faq.${index}.question`]}
              onChange={(event) => update({ ...item, question: event.target.value })}
            />
            <TextAreaField
              label="Respuesta"
              rows={3}
              value={item.answer}
              maxLength={800}
              error={errors[`faq.${index}.answer`]}
              onChange={(event) => update({ ...item, answer: event.target.value })}
            />
          </>
        )}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          Guardar textos
        </Button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

type ListEditorProps<T> = {
  title: string;
  description: string;
  addLabel: string;
  items: T[];
  error?: string;
  empty: T;
  onChange: (items: T[]) => void;
  render: (item: T, index: number, update: (item: T) => void) => React.ReactNode;
};

function ListEditor<T>({ title, description, addLabel, items, error, empty, onChange, render }: ListEditorProps<T>) {
  const update = (index: number) => (item: T) => onChange(items.map((current, i) => (i === index ? item : current)));
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 flex flex-col gap-1">
        <span className="font-medium text-fg">{title}</span>
        <span className="text-sm text-fg-muted">{description}</span>
      </legend>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {items.length === 0 && <p className="text-sm text-fg-subtle">Sin cargar. La sección no se muestra en tu página.</p>}
      <ol className="flex flex-col gap-4">
        {items.map((item, index) => (
          <li key={index} className="flex flex-col gap-4 rounded-lg border border-line bg-surface-1 p-4">
            {render(item, index, update(index))}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
                Subir
              </Button>
              <Button variant="ghost" size="sm" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                Bajar
              </Button>
              <Button variant="danger" size="sm" className="ml-auto" onClick={() => remove(index)}>
                Quitar
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Button variant="secondary" className="self-start" onClick={() => onChange([...items, empty])}>
        {addLabel}
      </Button>
    </fieldset>
  );
}

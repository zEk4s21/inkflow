"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AppointmentStatus } from "@/config/appointment-status";
import { changeAppointmentStatus, rescheduleAppointment } from "@/server/appointments/actions";
import type { AppointmentStatusChange, AppointmentTimeInput } from "@/server/appointments/schemas";
import { AppointmentTimeForm } from "./appointment-time-form";

/** Acciones sobre un turno abierto (pedido o confirmado). Los cerrados no muestran nada. */
export function AppointmentActions({
  appointmentId,
  status,
  started,
  label,
  current,
  today,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  /** Ya empezó: recién ahí se puede marcar como realizado o ausente. */
  started: boolean;
  /** "miércoles 21 de octubre, 14:30", para los textos de confirmación. */
  label: string;
  current: AppointmentTimeInput;
  today: string;
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (status !== "requested" && status !== "confirmed") return null;

  const change = (next: AppointmentStatusChange) =>
    startTransition(async () => {
      const result = await changeAppointmentStatus(appointmentId, next);
      setError(result.ok ? null : result.message);
    });

  if (rescheduling) {
    return (
      <AppointmentTimeForm
        initial={current}
        today={today}
        submitLabel="Guardar nuevo horario"
        onSubmit={(values) => rescheduleAppointment(appointmentId, values)}
        onCancel={() => setRescheduling(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "requested" && (
          <>
            <Button size="sm" loading={pending} onClick={() => change("confirmed")} aria-label={`Confirmar turno del ${label}`}>
              Confirmar
            </Button>
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="ghost" disabled={pending}>
                  Rechazar
                </Button>
              }
              title="Rechazar el turno"
              description={`El pedido del ${label} queda rechazado y el horario sigue libre. Avisale al cliente por mensaje: INKFLOW todavía no le escribe.`}
              confirmLabel="Rechazar"
              cancelLabel="Volver"
              onConfirm={() => change("cancelled")}
            />
          </>
        )}
        {status === "confirmed" && started && (
          <>
            <Button size="sm" variant="secondary" loading={pending} onClick={() => change("completed")}>
              Realizado
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("no_show")}>
              No vino
            </Button>
          </>
        )}
        {!started && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRescheduling(true)}>
            Reprogramar
          </Button>
        )}
        {status === "confirmed" && !started && (
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost" disabled={pending}>
                Cancelar turno
              </Button>
            }
            title="Cancelar el turno"
            description={`El turno del ${label} se cancela y el horario vuelve a quedar libre. Avisale al cliente por mensaje: INKFLOW todavía no le escribe.`}
            confirmLabel="Cancelar turno"
            cancelLabel="Volver"
            onConfirm={() => change("cancelled")}
          />
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

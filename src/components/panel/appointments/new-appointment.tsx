"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createAppointment } from "@/server/appointments/actions";
import type { AppointmentTimeInput } from "@/server/appointments/schemas";
import { AppointmentTimeForm } from "./appointment-time-form";

/** "Dar turno" desde una solicitud: queda confirmado directamente. */
export function NewAppointment({ requestId, initial, today }: { requestId: string; initial: AppointmentTimeInput; today: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        Dar turno
      </Button>
    );
  }
  return (
    <AppointmentTimeForm
      initial={initial}
      today={today}
      submitLabel="Confirmar turno"
      onSubmit={(values) => createAppointment(requestId, values)}
      onCancel={() => setOpen(false)}
    />
  );
}

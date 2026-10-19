# Política de privacidad · BORRADOR

> **Borrador para revisión legal. No publicar así.**
> - `[COMPLETAR]`: dato que define el responsable.
> - `[REVISAR]`: punto que tiene que validar el abogado.
> - Ver [README](README.md).

Última actualización: `[COMPLETAR fecha]`

## Quién es responsable de tus datos

- **Responsable:** `[COMPLETAR nombre completo o razón social del tatuador o estudio]`, CUIT `[COMPLETAR]`, con domicilio en `[COMPLETAR domicilio]`.
- **Contacto para temas de datos:** `[COMPLETAR email]`.
- **Base de datos:** los datos se guardan en la base de datos de consultas y clientes del estudio. Inscripción en el Registro Nacional de Bases de Datos: `[COMPLETAR número o REVISAR si corresponde]`.

La página y el panel funcionan con INKFLOW, una herramienta que el estudio usa para recibir y organizar consultas. `[REVISAR: si INKFLOW lo opera un tercero, describirlo como encargado del tratamiento y firmar el contrato correspondiente]`.

## Qué datos pedimos y para qué

Cuando nos escribís desde el formulario o el asistente (Ink Assistant), pedimos:

| Dato | ¿Obligatorio? | Para qué |
|---|---|---|
| Nombre | Sí | Saber con quién hablamos |
| Email o WhatsApp | Al menos uno | Responderte la consulta |
| Tu idea, zona del cuerpo y tamaño | La idea sí; el resto no | Evaluar el diseño y armar un presupuesto |
| Estilo, color, si es un cover up y otros detalles (asistente) | No | Lo mismo |
| Día y hora que preferís | No | Proponerte un turno, que queda a confirmar |

**Si no dejás nombre, idea y un medio de contacto, no podemos recibir la consulta.** Si un dato es inexacto, puede que no podamos responderte. Lo demás es opcional y no cambia que te respondamos.

Además, sin que lo escribas:

- **Para frenar envíos automáticos**:
  - Guardamos una huella irreversible (hash) de la dirección IP desde la que enviás, no la IP en sí, durante `[COMPLETAR plazo]`.
  - Usamos el captcha de Cloudflare Turnstile.
- **Si usás el asistente**, se guarda la conversación:
  - Si no terminás enviando una consulta, lo charlado se borra a los 7 días.
  - Si la enviás, queda junto con la consulta.

Usamos tus datos **solo** para responder tu consulta y, si avanzás, para:

- el presupuesto;
- los turnos;
- los pagos que registramos a mano;
- los controles de cicatrización y retoque.

No los vendemos, no los usamos para publicidad y no los mostramos en la página pública.

## Datos de salud

**No pongas en el formulario ni en el asistente datos sobre tu salud** (alergias, medicación, enfermedades, embarazo). Son datos sensibles y nadie está obligado a darlos. Si hacen falta para la sesión, los hablamos en persona. `[REVISAR: cómo se registra la información de salud que el tatuador necesite antes de tatuar]`.

## Con quién se comparten

Tus datos los ve el estudio (`[COMPLETAR quiénes: el tatuador y, si hay, su equipo]`). Para funcionar usamos estos proveedores, que procesan datos por cuenta del estudio:

| Proveedor | Para qué | Dónde |
|---|---|---|
| Supabase | Base de datos, login del panel y fotos | Brasil (São Paulo) |
| Vercel | Servir la página | `[REVISAR]` EE.UU. y otras regiones |
| Cloudflare (Turnstile) | Captcha anti-bots | `[REVISAR]` |
| Resend | Mandar los avisos por email | `[REVISAR]` EE.UU. |
| Anthropic (Claude) | Responder en el asistente, solo si lo usás | `[REVISAR]` EE.UU. |

`[REVISAR: Brasil y EE.UU. no figuran como países con protección adecuada para la AAIP. Definir la base legal de la transferencia internacional (consentimiento expreso, cláusulas contractuales modelo de la Res. AAIP 198/2023 u otra) y cómo se recaba.]`

`[REVISAR: condiciones de cada proveedor sobre uso y retención de datos, en especial Anthropic.]`

## Link de seguimiento

Si el estudio te pasa un link privado, ahí ves:

- el estado de tu consulta;
- el presupuesto;
- lo pagado;
- tus turnos;
- los cuidados.

Lo puede ver cualquiera que tenga el link: no lo compartas. El estudio lo puede desactivar en cualquier momento.

## Cuánto tiempo guardamos tus datos

- Conversaciones del asistente que no terminaron en consulta: se borran a los 7 días.
- Consultas, datos de contacto, presupuestos, turnos y pagos: `[COMPLETAR plazo, por ejemplo mientras haya relación y N años después; REVISAR obligaciones contables o fiscales]`.

## Tus derechos

Podés pedir **acceso** a tus datos, y que los **rectifiquemos, actualicemos o suprimamos**, escribiendo a `[COMPLETAR email]`.

- **Acceso:** respondemos dentro de los 10 días corridos.
- **Rectificación, actualización o supresión:** dentro de los 5 días hábiles.

Quizá te pidamos algo que acredite que sos vos.

> El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.
>
> La DIRECCION NACIONAL DE PROTECCION DE DATOS PERSONALES, Organo de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.

`[REVISAR: texto de la Disposición DNPDP 10/2008 tomado de una reproducción; confirmar contra el Boletín Oficial y si corresponde nombrar a la Agencia de Acceso a la Información Pública (AAIP), actual autoridad de control.]`

## Seguridad

- Cada estudio ve solo sus datos.
- El acceso al panel es por link al email del tatuador.
- Las claves de los servicios no se guardan en el código.

Ningún sistema es infalible. Si detectamos un problema que afecte tus datos, te avisamos `[REVISAR alcance]`.

## Cambios

Si cambiamos esta política, publicamos la versión nueva acá con su fecha.

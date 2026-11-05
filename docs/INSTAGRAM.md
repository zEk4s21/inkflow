# Portfolio desde Instagram

Si un estudio conecta su cuenta de Instagram, la sección **Trabajos** de su página pública muestra
sus últimas 24 publicaciones (fotos, carruseles y reels). Cada una abre una ventana con la foto
o el video, el texto, los likes y comentarios, y los botones "Quiero algo así" y "Ver en
Instagram". Sin conexión, o si Instagram no responde, se muestran los trabajos cargados en el
panel, como siempre.

## Qué hace falta

1. **Cuenta profesional.** En la app de Instagram: Configuración > Tipo de cuenta y herramientas
   > Cambiar a cuenta profesional (Creador o Empresa). Es gratis.
2. **App de Meta.** En [Meta for Developers](https://developers.facebook.com/apps) crear una app
   (tipo "Empresa"), agregarle el producto **Instagram** y entrar a
   "API setup with Instagram login".
3. **Token.** En "Generate access tokens" agregar la cuenta de Instagram del tatuador, iniciar
   sesión y copiar el token que aparece (dura 60 días).
4. **Conectar.** Desde una máquina con `.env.local` apuntando a la base que corresponda:

   ```bash
   pnpm instagram:connect <slug> <token>
   ```

   El script prueba el token contra Instagram antes de guardarlo y muestra la cuenta conectada.

## Cómo funciona

- El token se guarda en `instagram_connections` (solo lo ve el servidor con la clave secreta).
- El feed se cachea una hora (`src/server/instagram/feed.ts`): las publicaciones nuevas aparecen
  solas y los links de las fotos, que Instagram hace vencer, siempre están vigentes.
- Cuando faltan menos de 20 días para que venza, el servidor renueva el token y guarda el nuevo.
  Si alguna vez vence igual (por ejemplo, si nadie entró a la página en 40 días), basta con
  generar uno nuevo y volver a correr `pnpm instagram:connect`.
- Las fotos se sirven desde `*.cdninstagram.com` / `*.fbcdn.net` (permitidos en `next.config.ts`).

# Plan: puesta en línea (entorno de pruebas)

Objetivo: HayCancha funcionando en `haycancha.com.ar`, con base en la nube, para mostrarlo
y cargar los primeros complejos reales. Todavía sin pago online (eso es la fase 2).

## Antes de empezar (lo hace Juan)

- [ ] **Dominio `haycancha.com.ar`** en [nic.ar](https://nic.ar) (con Clave Fiscal de ARCA).
- [ ] **Cuenta en [Cloudflare](https://cloudflare.com)** (gratis). nic.ar no guarda los
      registros DNS: hay que delegar el dominio en un proveedor de DNS. En Cloudflare se
      agrega el dominio, y en nic.ar se cargan los dos "servidores de nombre" que da
      Cloudflare. La delegación puede tardar unas horas.
- [ ] **Cuenta en [Supabase](https://supabase.com)** (gratis) y un proyecto
      `haycancha-pruebas`. Anotar la contraseña de la base que pide al crearlo.
- [ ] **Cuenta en [Render](https://render.com)** conectada a GitHub (repo
      `juanperdomo-9/HayCancha`). Para pruebas alcanza el plan gratis; para uso real, el
      backend en el plan Starter (USD 7 por mes), que no se "duerme".

## Decisiones para tomar mañana

1. **Región.** Render no tiene servidores en Sudamérica. Conviene poner Supabase y Render
   en la misma región de Estados Unidos (Virginia / US East), así la API y la base están
   cerca entre sí. Desde Argentina se nota poco.
2. **Dónde se guardan logos y portadas.** En Render, el disco del backend se borra en cada
   deploy, así que los archivos subidos se perderían. Opciones:
   - **Supabase Storage** (recomendado): gratis en este volumen. Suma una dependencia en
     el backend para subir archivos (a confirmar cuál antes de agregarla).
   - Disco persistente de Render: pago y solo en planes pagos.
   Hasta resolverlo, los complejos se pueden cargar sin logo (se ven sus iniciales).

## Pasos (los hago con vos)

1. **Supabase**
   - Activar las extensiones `btree_gist` y `vector` (Database > Extensions), en el
     esquema `extensions`.
   - Migraciones con la conexión del pooler en **modo sesión** (puerto 5432).
   - `app.cli preparar-base` para el usuario `app_user` (la app usa el pooler en **modo
     transacción**, puerto 6543). Verificar en la documentación de Supabase cómo se
     conecta un rol propio por el pooler (`app_user.<ref-del-proyecto>`).
   - Crear tu superadmin con `app.cli crear-superadmin`. **No** se carga el ejemplo.
2. **Render: backend** (web service, Python)
   - Build: `uv sync --frozen`. Antes de cada deploy: `alembic upgrade head`.
   - Inicio: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
   - Variables: `DATABASE_URL`, `DATABASE_URL_ADMIN`, `JWT_SECRET` (nueva, al azar),
     `COOKIE_SEGURA=true`, `APP_BASE_URL=https://api.haycancha.com.ar`,
     `FRONTEND_URL=https://haycancha.com.ar`.
   - Dominio propio: `api.haycancha.com.ar`.
3. **Render: frontend** (static site)
   - Build: `npm ci && npm run build`, carpeta `dist`.
   - Regla de reescritura `/*` → `/index.html` (para que funcionen las rutas de React).
   - Variable: `VITE_API_URL=https://api.haycancha.com.ar`.
   - Dominio propio: `haycancha.com.ar` (y `www` redirigiendo).
4. **Cloudflare**: registros DNS que apunten a Render (los que indique Render para cada
   dominio). Render emite los certificados https solos.
5. **Prueba completa**: ingreso como superadmin, alta de un complejo, canchas, horarios,
   una reserva desde la agenda y verla en la página pública, desde el celular.

## Qué queda para después

- El cron job (vencimiento de reservas pendientes): hace falta recién con el pago online.
- El proyecto `produccion` de Supabase (plan Pro) antes de cobrar señas reales.
- Clave de Google Maps (`VITE_GOOGLE_MAPS_KEY`) para el mapa embebido.

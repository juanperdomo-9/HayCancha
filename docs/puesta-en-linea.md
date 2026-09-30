# Puesta en línea (entorno de pruebas)

Objetivo: HayCancha en `haycancha.com.ar` (página) y `api.haycancha.com.ar` (API), con la
base en Supabase y todo en **Oregon** (Supabase y Render en la misma región).

Las llaves **nunca** se mandan por chat ni se escriben en el repo: se pegan directo en
Render (servicio → **Environment**). Guardá una copia en el gestor de contraseñas.

## 1. Dominio (nic.ar + Cloudflare)

1. Registrar `haycancha.com.ar` en [nic.ar](https://nic.ar) (Clave Fiscal de ARCA).
2. En [Cloudflare](https://dash.cloudflare.com): **Add a domain** → `haycancha.com.ar` →
   plan Free. Cloudflare da dos *nameservers*.
3. En nic.ar: **Mis dominios → haycancha.com.ar → Delegar** y cargar los dos nameservers
   de Cloudflare. Puede tardar unas horas; Cloudflare avisa cuando queda activo.

## 2. Supabase (proyecto `haycancha-pruebas`, Oregon)

1. **Database → Extensions**: activar `btree_gist` y `vector` en el esquema `extensions`.
2. **Storage → New bucket**: nombre `archivos`, marcado **Public** (logos y portadas).
3. **Connect** (botón de arriba) → pestaña de conexión → copiar las dos URL del
   **pooler (Supavisor)**:
   - **Modo sesión (puerto 5432)** → es `DATABASE_URL_ADMIN` tal cual, con la contraseña
     de la base: `postgresql://postgres.REF:CONTRASEÑA@HOST:5432/postgres`.
   - **Modo transacción (puerto 6543)** → es `DATABASE_URL`, pero cambiando el usuario
     `postgres.REF` por `app_user.REF` y la contraseña por **una nueva que inventes**
     (larga, sin símbolos raros como `@ : / ?`). El deploy se la asigna a `app_user`.
4. **Settings → API**: copiar la **Project URL** (`https://REF.supabase.co`) →
   `SUPABASE_URL`.
5. **Settings → API Keys → Secret keys**: crear una (`sb_secret_...`) →
   `SUPABASE_SECRET_KEY`. Es secreta: solo va en Render.

## 3. Render (Blueprint)

1. **New → Blueprint** → repo `juanperdomo-9/HayCancha`. Render lee `render.yaml` y
   propone tres servicios: `haycancha-api`, `haycancha-web` y `haycancha-tick`.
2. Antes de aplicar, completar las variables que pide (las `sync: false`):

| Variable | De dónde sale |
| --- | --- |
| `DATABASE_URL` | Supabase, pooler modo transacción con `app_user` (paso 2.3) |
| `DATABASE_URL_ADMIN` | Supabase, pooler modo sesión con `postgres` (paso 2.3) |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Supabase (pasos 2.4 y 2.5) |
| `TOKEN_ENCRYPTION_KEY` | En tu compu: `cd backend && uv run python -m app.cli generar-clave`. **Si se pierde, todos los complejos vuelven a vincular Mercado Pago** |
| `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET` | App de Mercado Pago (paso 5). Se pueden cargar después |
| `EMAIL_API_KEY` | Resend → API Keys → Create (permiso *Sending access*) |
| `VITE_GOOGLE_MAPS_KEY` | Opcional (mapa). Se puede dejar vacía |

   `JWT_SECRET` la genera Render solo. La tarea de cada minuto toma las llaves de la API.
3. Aplicar. El primer deploy de la API instala todo, aplica las migraciones en Supabase y
   prepara `app_user`.
4. Dominios: en cada servicio, **Settings → Custom Domains** ya figura el dominio
   (`api.haycancha.com.ar` en la API; `haycancha.com.ar` y `www` en la web). Render
   muestra qué registro DNS crear.
5. En Cloudflare → **DNS → Records**, crear los que indica Render (CNAME) con la nube en
   **gris (DNS only)**, así Render emite el certificado https.
6. Crear tu superadmin: en la API de Render, **Shell** (planes pagos), o desde tu compu
   con las URL de Supabase en un `backend/.env.supabase` (no se sube al repo):
   `uv run --env-file .env.supabase python -m app.cli crear-superadmin --usuario haycancha`.

Costos: la API y la web en plan free alcanzan para probar (la API se duerme sin uso: el
primer pedido tarda ~1 minuto). La tarea de cada minuto no tiene plan free (se paga por
uso). Para cobrar señas reales, la API en **Starter** (USD 7/mes) y Supabase **Pro**.

## 4. Resend (emails)

1. **Domains → Add domain** → `mail.haycancha.com.ar`.
2. Copiar los registros que muestra (SPF, DKIM, MX) en Cloudflare → DNS → Records.
3. **Verify**. Hasta que quede verificado, solo se pueden mandar emails de prueba a la
   cuenta de Resend.

## 5. Mercado Pago (app de HayCancha)

1. [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) → **Crear
   aplicación** → Pagos online → Checkout Pro.
2. **Detalles de aplicación → Editar**: URL de redireccionamiento
   `https://api.haycancha.com.ar/mercadopago/callback` y habilitar **PKCE**.
3. **Credenciales de producción**: Client ID y Client Secret → `MP_CLIENT_ID`,
   `MP_CLIENT_SECRET`.
4. **Webhooks → Configurar notificaciones** → modo productivo:
   `https://api.haycancha.com.ar/webhooks/mercadopago`, evento **Pagos** → guardar →
   copiar la clave secreta → `MP_WEBHOOK_SECRET`.
5. **Cuentas de prueba**: crear un vendedor y un comprador. Para probar, en Render
   `MP_TOKENS_DE_PRUEBA=true`, vincular un complejo de prueba con el vendedor y pagar con
   el comprador. Probar el botón **Simular** del webhook.

## 6. Prueba completa

Superadmin → alta de un complejo → canchas, horarios, logo → el dueño recibe el email →
vincula Mercado Pago → reserva desde el celular → paga con la cuenta de prueba → se
confirma sola → email al dueño → cancelar a tiempo → se devuelve la seña.

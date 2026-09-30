# CLAUDE.md: HayCancha, sistema de reservas para canchas y complejos deportivos

Este archivo es la guía del proyecto. Leelo completo antes de proponer o escribir código.

## Qué estamos construyendo

Una sola web (multi-tenant) que usan muchos complejos deportivos a la vez: fútbol (5, 7, 11), pádel, tenis, básquet, vóley y cualquier otro deporte que se alquile por turno. Un mismo complejo puede tener varias canchas, del mismo deporte o de distintos (por ejemplo, 4 canchas de fútbol 7 y 1 de fútbol 5), y cada una tiene su propia duración de turno (por ejemplo, fútbol 60 minutos y pádel 90). **Nunca asumas que todo es fútbol.** En este archivo, "complejo" es el cliente (un registro en `negocios`) y "cancha" es cada espacio que se reserva (un registro en `recursos`). El producto se llama **HayCancha** y vive en `haycancha.com.ar`. Cada complejo tiene su propia página (`haycancha.com.ar/el-potrero`) donde los jugadores:

1. ven los horarios libres,
2. reservan un turno,
3. pagan la seña con Mercado Pago,
4. y reciben la confirmación **sin que ningún humano intervenga**.

Más adelante se suma un asistente de IA en la página de cada complejo que responde preguntas y reserva. Después vienen otros rubros (peluquerías, restaurantes) sobre el mismo motor, así que el modelo de datos habla de "negocios" y "recursos", no de "canchas" a secas.

La interfaz es en español de Argentina, con voseo ("Reservá", "Elegí un horario").

## Reglas para trabajar en este repo

- **Una fase a la vez.** Hacé solo la fase que te pida. No adelantes funciones de fases siguientes.
- **Primero el plan, después el código.** Antes de cada tarea grande, proponé un plan corto (archivos a crear o tocar, decisiones) y esperá el OK.
- **Nada de WhatsApp.** Todo pasa en la página. Las notificaciones van por email (y push más adelante). Única excepción: el complejo puede cargar un número para un botón "Consultar por WhatsApp" en su página (solo abre un chat para dudas; reservas, pagos y avisos nunca pasan por ahí).
- **La IA nunca confirma turnos ni valida pagos.** Un turno solo pasa a `confirmada` cuando llega un webhook de Mercado Pago válido con el pago aprobado. Nunca se aceptan capturas de comprobantes.
- **Nunca confiar en montos del frontend.** Precios y señas se calculan siempre en el backend.
- **Preguntá antes de sumar dependencias** que no estén en la sección Stack.
- **Todo cambio de base de datos va por migración de Alembic.** Nada de cambios a mano.
- Al terminar una tarea: corré los tests y el linter, y contá qué cambió y qué falta probar.
- Si algo de este archivo parece equivocado o desactualizado (por ejemplo, un detalle de la API de Mercado Pago), avisá y verificá contra la documentación oficial antes de seguir.

## Stack

**Backend (`backend/`)**
- Python 3.12, FastAPI, Uvicorn
- SQLAlchemy 2.x + psycopg 3, migraciones con Alembic
- Pydantic v2 + pydantic-settings (configuración por variables de entorno)
- Mercado Pago por su API REST con `httpx` (decidido en la fase 2: el SDK oficial solo arma los mismos pedidos y es más difícil de probar)
- Contraseñas: `argon2-cffi`. Sesiones: JWT (PyJWT) en cookie httpOnly
- Encriptación de tokens de Mercado Pago: `cryptography` (Fernet)
- Tests: pytest. Linter y formato: ruff
- Manejo de paquetes: uv

**Frontend (`frontend/`)**
- React + Vite + TypeScript (no Create React App)
- React Router, TanStack Query
- Tailwind CSS, con los colores de cada complejo como variables CSS
- Animaciones: `motion`. Íconos: `lucide-react`
- Mobile first: la mayoría de los jugadores reserva desde el celular

**Infraestructura**
- Base de datos: Postgres en **Supabase**, con las extensiones `btree_gist` (reservas sin superposición) y `vector` (pgvector, para el asistente en la fase 3). Se activan en el panel de Supabase, en Database > Extensions.
  - Dos proyectos separados: `pruebas` (plan gratuito) y `produccion` (plan Pro: los proyectos gratuitos se pausan tras una semana de poca actividad, y producción no se puede pausar).
  - Supabase se usa solo como base de datos Postgres. El login de los dueños lo maneja el backend (FastAPI), no Supabase Auth, y el frontend nunca habla directo con la base.
  - La app se conecta por el pooler en modo transacción. Ese modo no admite prepared statements, así que en psycopg va `prepare_threshold=None`.
  - Las migraciones (`DATABASE_URL_ADMIN`) van por el pooler en modo sesión (puerto 5432): la conexión directa de Supabase es solo IPv6 y Render no llega a IPv6.
  - Las extensiones van en el esquema `extensions`, como en Supabase. El rol `app_user` necesita ese esquema en su `search_path`.
  - Los tests automáticos usan un Postgres local descartable (`docker-compose.yml` en la raíz, puerto 5433, variable `TEST_DATABASE_URL`), nunca un proyecto de Supabase. Sin esa variable, los tests que necesitan base se saltean.
- Dominios: `haycancha.com.ar` (frontend) y `api.haycancha.com.ar` (backend). Tienen que compartir dominio para que la cookie de sesión funcione.
- Deploy: Render (web service para el backend, static site para el frontend, cron job para tareas periódicas)
- Webhooks en desarrollo local: túnel tipo ngrok

## Estructura del repo

```
/
├── CLAUDE.md
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py          # settings desde variables de entorno
│   │   ├── db.py              # engine, sesión, set_config del tenant
│   │   ├── models/            # SQLAlchemy
│   │   ├── schemas/           # Pydantic
│   │   ├── routers/           # public, panel, admin, webhooks
│   │   ├── services/          # reservas, pagos, mercadopago, email
│   │   └── jobs/              # vencimiento de reservas pendientes
│   ├── alembic/
│   └── tests/
└── frontend/
    └── src/
        ├── pages/             # public, panel, admin
        ├── components/
        ├── api/
        └── theme/
```

## Comandos

```
docker compose up -d --wait                              # Postgres local (raíz del repo)
cd backend && uv run alembic upgrade head                # migraciones (DATABASE_URL_ADMIN)
cd backend && uv run python -m app.cli preparar-base     # login de app_user, en cada base nueva
cd backend && uv run python -m app.cli cargar-ejemplo    # El Potrero y usuarios de prueba (--reemplazar para rehacerlo)
cd backend && uv run python -m app.cli crear-superadmin --email ...  # superadmin real
cd backend && uv run uvicorn app.main:app --reload       # API en :8000
cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd frontend && npm run dev                               # web en :5173
cd frontend && npm test && npm run lint && npm run build
```

En los tests, la conexión de la app hace `SET ROLE app_user` (ver `tests/conftest.py`), así RLS se prueba de verdad.

## Variables de entorno

Nunca subir secretos al repo. Mantener actualizados `backend/.env.example` y `frontend/.env.example` (cada herramienta lee el `.env` de su carpeta).

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | Conexión de la app con el rol `app_user` (sujeto a RLS) |
| `DATABASE_URL_ADMIN` | Rol dueño de las tablas: migraciones y panel de superadmin |
| `JWT_SECRET` | Firma de las sesiones y de los links de invitación (32+ caracteres al azar) |
| `COOKIE_SEGURA` | `true` en producción: la cookie de sesión solo por https |
| `CARPETA_ARCHIVOS` | Dónde se guardan logos y portadas (hasta la puesta en línea) |
| `VITE_GOOGLE_MAPS_KEY` | (frontend) Maps Embed API para el mapa de cada complejo; restringida al dominio |
| `TOKEN_ENCRYPTION_KEY` | Clave Fernet para encriptar tokens de Mercado Pago |
| `MP_CLIENT_ID`, `MP_CLIENT_SECRET` | App de Mercado Pago (OAuth) |
| `MP_WEBHOOK_SECRET` | Clave secreta de webhooks (se genera en "Tus integraciones") |
| `MP_REDIRECT_URI` | Callback de OAuth (vacío: `{APP_BASE_URL}/mercadopago/callback`) |
| `MP_TOKENS_DE_PRUEBA` | `true` solo para vincular cuentas de prueba de Mercado Pago (credenciales TEST-) |
| `APP_BASE_URL` | URL pública del backend (para `notification_url`) |
| `FRONTEND_URL` | URL pública del frontend (para `back_urls`) |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Envío de emails con Resend (avisos al dueño e invitaciones). Sin clave, los emails se muestran en el log. `EMAIL_FROM` con el dominio verificado: `HayCancha <avisos@mail.haycancha.com.ar>` |
| `PAGOS_SIMULADOS` | Solo desarrollo: permite reservas online sin Mercado Pago, con un botón para simular el pago |
| `LLM_API_KEY` | Solo fase 3 |

## Multi-tenant: una sola app para todos los complejos

- Cada complejo (el cliente) es un registro en `negocios` y se identifica por su `slug` en la URL.
- **Todas las tablas con datos de un negocio llevan `negocio_id`**, y todas las consultas filtran por él.
- **Row Level Security (RLS) en Postgres** como segunda barrera, para que un error en el código no pueda mostrar datos de otro complejo:
  - La app se conecta con un rol `app_user` que **no** es dueño de las tablas y tiene `NOBYPASSRLS`. El dueño de una tabla se saltea RLS salvo que se use `FORCE ROW LEVEL SECURITY`; en Supabase, `postgres` y `service_role` no sirven para la app. Verificá en la documentación de Supabase qué atributos tienen sus roles.
  - Al comenzar cada transacción: `SELECT set_config('app.negocio_id', :negocio_id, true)`.
  - Política en cada tabla con `negocio_id`:

```sql
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_negocio ON reservas
  USING (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid)
  WITH CHECK (negocio_id = NULLIF(current_setting('app.negocio_id', true), '')::uuid);
```

  - El `NULLIF` es obligatorio: después de una transacción que usó `set_config(..., true)`, la conexión (reutilizada por el pooler) devuelve `''` en vez de `NULL`, y `''::uuid` da error.
  - La sesión de SQLAlchemy vuelve a fijar `app.negocio_id` al empezar cada transacción (evento `after_begin` en `app/db.py`), así un `commit()` en el medio no la deja sin negocio.
  - Las tablas hijas referencian al padre con claves compuestas (`(negocio_id, recurso_id)` → `recursos(negocio_id, id)`), así una reserva no puede apuntar a una cancha de otro negocio ni siquiera con la conexión de administrador.
- La tabla `negocios` se lee libremente (rutas públicas, que solo devuelven campos públicos: nombre, logo, colores, horarios), pero tiene RLS para escribir: `app_user` solo puede modificar el negocio de `app.negocio_id` y no puede crear ni borrar negocios (eso es del alta, con la conexión de administrador). **Los tokens de Mercado Pago nunca salen del backend.**
- Los usuarios tienen RLS como el resto. Para el login (que busca por email antes de saber el negocio) hay funciones `SECURITY DEFINER` acotadas, en vez de usar la conexión de administrador.
- El panel de superadmin usa `DATABASE_URL_ADMIN`. Esa conexión nunca se usa en rutas públicas ni del panel de dueños.

## Modelo de datos

Claves primarias `uuid` con `gen_random_uuid()`. Fechas con hora en `timestamptz` (se guardan en UTC y se muestran en la zona horaria del negocio). Dinero en `numeric(12,2)` y `Decimal` en Python: **nunca float**.

| Tabla | Campos principales |
| --- | --- |
| `negocios` | `id`, `slug` (único), `nombre`, `rubro` (`deportes` por ahora), `logo_url`, `portada_url`, `color_primario`, `color_secundario`, `zona_horaria` (por defecto `America/Argentina/Buenos_Aires`), `direccion`, `barrio`, `servicios` (lista de textos: "Vestuarios", "Estacionamiento"…), `sena_tipo` (`fija` o `porcentaje`, por defecto `porcentaje`), `sena_valor` (por defecto 20: lo habitual es 20%, pero lo decide cada complejo), `minutos_para_pagar` (por defecto 10), `horas_cancelacion` (**sin valor por defecto**: se acuerda con cada complejo y es obligatorio en el alta), `plan`, `estado_cuenta` (`al_dia`, `atrasado`, `suspendido`), `mp_user_id`, `mp_access_token_enc`, `mp_refresh_token_enc`, `mp_token_vence_a`, `activo`, `creado_a` |
| `usuarios` | `id`, `negocio_id` (null solo para superadmin), `email` (único), `password_hash`, `rol` (`superadmin`, `dueno`, `empleado`) |
| `deportes` | `id`, `codigo` (único: `futbol5`, `futbol7`, `futbol11`, `padel`, `tenis`, `basquet`, `voley`…), `nombre`, `duracion_sugerida_min`. Tabla global, sin `negocio_id`: se amplía agregando filas, sin cambiar código |
| `recursos` | `id`, `negocio_id`, `deporte_id`, `nombre` ("Cancha 1", "Pádel 2"), `caracteristicas` (texto libre: "techada", "sintético", "blindex"), `activo` |
| `horarios` | `id`, `negocio_id`, `recurso_id`, `dia_semana` (0 = lunes … 6 = domingo, como `weekday()` de Python), `desde`, `hasta` (hora local del negocio; si `hasta` <= `desde`, la franja termina al día siguiente: 18:00 a 02:00, o 09:00 a 00:00 para cerrar a medianoche), `duracion_turno_min` (por defecto, la sugerida del deporte), `precio`. Una cancha puede tener varias franjas por día con precios distintos (por ejemplo, más cara de noche) |
| `clientes` | `id`, `negocio_id`, `nombre`, `telefono`, `email`; único (`negocio_id`, `telefono`) |
| `recursos_combinados` | `negocio_id`, `recurso_id` (la cancha grande), `parte_id` (cada cancha que la forma). Solo para complejos que unen canchas |
| `reservas` | `id`, `negocio_id`, `recurso_id`, `cliente_id` (null en un bloqueo), `reserva_origen_id` (solo en las reservas espejo de canchas combinadas), `inicio`, `fin`, `estado`, `precio`, `sena`, `sena_en_efectivo` (bool), `saldo_cobrado` (bool), `asistencia` (null, `vino`, `no_vino`), `motivo_bloqueo`, `vence_a`, `mp_preference_id`, `origen` (`web`, `panel`, `bot`), `creado_por` (usuario del panel, si la cargó a mano), `creado_a` |
| `pagos` | `id`, `negocio_id`, `reserva_id`, `mp_payment_id` (**único**), `monto`, `estado`, `detalle` (jsonb con la respuesta de Mercado Pago), `creado_a` |
| `conocimiento` (fase 3) | `id`, `negocio_id`, `texto`, `embedding` (vector), `fuente` |
| `consultas_sin_respuesta` (fase 3) | `id`, `negocio_id`, `pregunta`, `resuelta`, `creado_a` |

**Reservas que no se pisan.** Esta regla vive en la base de datos, no solo en el código:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservas ADD CONSTRAINT reservas_sin_superposicion
  EXCLUDE USING gist (
    recurso_id WITH =,
    tstzrange(inicio, fin, '[)') WITH &&
  ) WHERE (estado IN ('pendiente_pago', 'confirmada', 'bloqueada'));
```

**Canchas que se combinan.** Algunos complejos unen canchas (por ejemplo, dos de fútbol 5 forman una de fútbol 7). Se modela con `recursos_combinados`. Al reservar una cancha, en la misma transacción se crean reservas `bloqueada` espejo en todas las canchas relacionadas (sus partes, o la cancha grande que integra), con `reserva_origen_id` apuntando a la reserva real. Así la misma regla de superposición impide que se pisen. Si la reserva real se cancela o vence, sus espejos se liberan con ella. El modelo queda preparado desde el principio, pero esta función se implementa cuando un complejo la necesite.

## Flujo de reserva

Estados: `pendiente_pago`, `confirmada`, `vencida`, `cancelada`, `bloqueada`. Un bloqueo es una reserva sin cliente en estado `bloqueada`, así la misma regla de la base de datos impide reservar encima. Una reserva cargada a mano en el panel nace `confirmada`, sin pasar por Mercado Pago.

1. El jugador elige deporte y horario en `/:slug`. La página muestra cuántas canchas de ese deporte quedan libres en cada horario ("quedan 3 canchas de fútbol 7 a las 21"). Si las canchas se diferencian (techada o descubierta, por ejemplo), el jugador puede elegir una en particular.
2. El backend, en una transacción:
   - marca como `vencida` toda reserva `pendiente_pago` del mismo recurso con `vence_a` pasado;
   - crea o busca el `cliente` (nombre, teléfono, email);
   - calcula `precio` y `sena` según `horarios` y la configuración del negocio;
   - si el jugador no eligió una cancha, le asigna la primera libre de ese deporte en ese horario;
   - crea la reserva en `pendiente_pago` con `vence_a = ahora + minutos_para_pagar`. Si la restricción de superposición falla porque otro la tomó en ese instante, prueba con la siguiente cancha libre del mismo deporte. Si no queda ninguna, responde "ese horario ya no está disponible".
3. Crea la preferencia de Mercado Pago y devuelve el link de pago.
4. El jugador paga. Mercado Pago avisa por webhook y el backend confirma (ver abajo).
5. El jugador vuelve a `/:slug/reserva/:id`, que consulta el estado hasta que pase a `confirmada`.
6. Un job que corre cada minuto marca como `vencidas` las `pendiente_pago` con `vence_a` pasado, y así se liberan esos horarios.

**Cancelaciones:** con más horas de anticipación que `horas_cancelacion`, se devuelve la seña automáticamente. Con menos, se pierde.

## Pagos con Mercado Pago

**Cada complejo cobra en su propia cuenta**, vinculada con OAuth (modelo marketplace):
- Botón "Vincular Mercado Pago" en el panel del dueño que lleva a la autorización de Mercado Pago, con **PKCE** (`code_challenge` S256) y `state` para que nadie pueda vincular una cuenta ajena. El `refresh_token` llega con el flujo normal de autorización (verificado en la documentación: ya no hace falta pedir `offline_access`). En la app de Mercado Pago hay que habilitar el flujo con PKCE (Detalles de aplicación → Editar); si no, la vinculación falla. El pedido de token va en JSON.
- En el callback se cambia el `code` por `access_token` y `refresh_token`, que se guardan encriptados.
- El access token dura 180 días. Un job lo renueva antes de vencer con `grant_type=refresh_token` y guarda el par nuevo.
- Todas las llamadas de pago de un complejo se hacen **con el access token de ese complejo**.

**Preferencia de Checkout Pro** (una por reserva):
- `items`: un ítem "Seña: Cancha 1, sáb 12/10 21:00", `quantity` 1, `unit_price` = `sena`, `currency_id` `ARS`
- `external_reference`: el `id` de la reserva
- `notification_url`: `{APP_BASE_URL}/webhooks/mercadopago/{negocio_id}` (el webhook sabe de qué complejo es y con qué token consultar)
- `back_urls` hacia `{FRONTEND_URL}/{slug}/reserva/{id}` y `auto_return: "approved"`
- `expires: true`, `expiration_date_from` = ahora, `expiration_date_to` = `vence_a`
- `binary_mode: true`, para que el pago quede aprobado o rechazado sin estados pendientes
- `payment_methods.excluded_payment_types`: excluir los pagos en efectivo (`ticket`, `atm`), que tardan en acreditarse. Confirmá los ids en la documentación
- `marketplace_fee`: opcional, 0 por defecto

**Webhook** `POST /webhooks/mercadopago/{negocio_id}`:
1. **Validar la firma.** El header `x-signature` trae `ts=...,v1=...`. Se arma el manifest `id:{data.id};request-id:{x-request-id};ts:{ts};` (con `data.id` en minúsculas, tomado del query param), se calcula HMAC-SHA256 con `MP_WEBHOOK_SECRET` y se compara con `v1` en tiempo constante. Si no coincide, 401. Verificá el formato exacto del manifest en la documentación oficial antes de implementarlo.
2. Responder rápido (200) y procesar.
3. Consultar el pago a la API (`GET /v1/payments/{id}`) con el token de ese complejo. **Nunca confiar en el cuerpo del webhook.**
4. Chequear: `status == "approved"`, `external_reference` = una reserva de ese negocio, y `transaction_amount` y moneda iguales a la `sena`.
5. En una transacción, insertar en `pagos`. Si `mp_payment_id` ya existe, terminar: los webhooks pueden llegar repetidos.
6. Según el estado de la reserva:
   - `pendiente_pago`: pasa a `confirmada`.
   - `vencida`: intentar pasarla a `confirmada`. Si la restricción de superposición falla (otro tomó el turno), devolver el pago con la API de reembolsos.
   - `cancelada`: devolver el pago.
7. Avisar al dueño por email. **Al jugador no se le manda email**: ve la confirmación en `/:slug/reserva/:id`, donde también se le muestra el link de su reserva para guardarlo (el email del formulario es opcional).

Si en el aviso falta alguno de los valores del manifest (por ejemplo, `x-request-id`), esa parte se saca del texto que se firma, como indica la documentación. Mercado Pago espera un 200 en menos de 22 segundos y reintenta durante días si no lo recibe.

**Comisión de HayCancha** (`marketplace_fee`): 0 por ahora.

**Cancelación por parte del jugador:** desde la página de su reserva, confirmando con el teléfono que usó al reservar. La devolución de la seña sigue la política del complejo.

**Abusos:** hay un tope de reservas pendientes de pago al mismo tiempo por teléfono (2) y por conexión (4, con la IP transformada con HMAC, sin guardarla), para que nadie trabe los turnos con reservas que no va a pagar.

**Cambio de horario del jugador:** desde la página de su reserva, confirmando con el teléfono, una sola vez y con la misma anticipación que la política de cancelación. La seña se mantiene; el saldo es el precio del turno nuevo menos la seña (nunca negativo).

**Devoluciones:** el pago a devolver queda con `devolucion = 'pendiente'` en la misma transacción; si Mercado Pago no acepta el reembolso (por ejemplo, sin saldo en la cuenta del complejo), la tarea periódica lo reintenta cada 10 minutos. El webhook general `/webhooks/mercadopago` (el que se carga en el panel de Mercado Pago) busca el complejo por `user_id`.

**Pagos simulados (solo desarrollo):** con `PAGOS_SIMULADOS=true`, un complejo sin Mercado Pago vinculado igual toma reservas online y la página de la reserva muestra "Simular pago aprobado", que pasa por el mismo servicio que el webhook. En producción esa variable no existe.

## Frontend

**Rutas y slugs reservados.** Las rutas del sistema van antes que `/:slug`. Ningún complejo puede tener como slug una palabra que use el sistema: `panel`, `admin`, `ingresar`, `api`, `precios`, `ayuda`, `terminos`, `privacidad`, `complejos`, `duenos`, `diseno` (guía del sistema de diseño, solo en desarrollo). La lista vive en el backend y se valida en el alta.

**Página principal** (`/`, sin login, con la marca de HayCancha): portada, listado de los complejos clientes activos (tarjeta con portada, logo, barrio, deportes y próximo turno libre; filtro por deporte) y una sección para vender el producto a dueños de complejos. Solo muestra campos públicos y nunca complejos suspendidos.

**Público** (sin login):
- `/:slug`: página del complejo con su logo, colores y portada; filtro por deporte (se muestra solo si el complejo tiene más de uno), selector de fecha, horarios libres con cuántas canchas quedan en cada uno, y formulario (nombre, teléfono, email) que lleva al pago.
- `/:slug/reserva/:id`: estado de la reserva. Muestra "esperando el pago" hasta que pase a `confirmada`.
- Chat del asistente (fase 3).

**Panel del dueño** (`/panel/:slug`, con login, por ejemplo `/panel/el-potrero`). Estructura de HayCancha con el logo y el color del complejo. El backend verifica que el usuario pertenezca al negocio de ese slug; si no, 403 (cambiar el slug en la URL nunca muestra otro complejo). El dueño lo usa sobre todo desde el celular, en la cancha:

- **Agenda del día** (la pantalla principal): una columna por cancha, agrupadas por deporte, y una fila por turno según los horarios cargados. Cada turno muestra su estado:
  - **Libre**: tocándolo se carga una reserva a mano (alguien que llamó o vino en persona).
  - **Pendiente de pago**: nombre del jugador y cuántos minutos le quedan para pagar.
  - **Reservado**: nombre del jugador, si pagó la seña, cuánto queda por cobrar en la cancha y de dónde vino la reserva (página, asistente o cargada a mano).
  - **Bloqueado**: el dueño lo cerró (torneo, lluvia, mantenimiento), con el motivo.
- En el celular, si el complejo tiene muchas canchas, la grilla se desliza de costado y se puede filtrar por deporte.
- Arriba, el resumen del día: turnos ocupados y libres, señas cobradas y saldo que falta cobrar en la cancha.
- Las reservas nuevas aparecen solas, sin recargar la página (consulta cada 30 segundos).
- Selector de fecha y **vista de la semana** con cuántos turnos libres y ocupados tiene cada día.
- **Detalle de una reserva**: nombre, teléfono (con botones para llamar o escribir por WhatsApp desde el celular del dueño), email, cuándo reservó, de dónde vino y el estado del pago. Acciones:
  - marcar si vino o no vino (alimenta la lista de los que faltan);
  - marcar el saldo como cobrado en la cancha;
  - cancelar (la seña se devuelve según la política);
  - mover a otra cancha o a otro horario libre.
- **Reserva cargada a mano**: nombre, teléfono y, si corresponde, si dejó seña en efectivo. Queda confirmada al instante y ocupa el turno para la página y el asistente, así nunca se pisa una reserva telefónica con una online.
- **Bloquear horarios**: uno o varios turnos, o el día completo, con motivo.
- Los empleados ven y manejan la agenda, pero no la configuración ni los pagos.
- Canchas (cada una con su deporte), horarios, duración de turno, precios, seña y política de cancelación
- Marca: logo, portada y colores
- Vincular Mercado Pago
- Conocimiento del asistente y preguntas sin responder (fase 3)

**Superadmin** (`/admin`, el fundador y quien hace las altas): alta de complejos, suspender o reactivar, estado de cobro de cada uno.
- **Cómo entra un complejo:** el dueño dice que sí y completa un formulario con todo lo necesario (datos del complejo, canchas, horarios, precios, seña, política de cancelación, marca, empleados). El equipo de HayCancha carga todo; el dueño no tiene que configurar nada para empezar. La pantalla de alta sigue el mismo orden que el formulario, para cargarlo rápido.
- El alta crea el complejo y el usuario del dueño, y genera un link para que elija su contraseña (en la fase 1 se lo pasa el equipo; desde la fase 2 le llega por email).
- Los dueños no se registran solos: todo complejo entra por el alta.
- El superadmin también puede configurar cualquier complejo (canchas, horarios, precios, seña, marca), para dejárselo listo al dueño. Desde `/admin`, un botón "Configurar" abre `/panel/:slug` de ese complejo con las mismas pantallas del dueño: no se duplica la interfaz. El backend permite al rol `superadmin` cualquier slug y usa la conexión normal (`app_user`) con `set_config('app.negocio_id', ...)` de ese negocio, así RLS sigue aplicando. `DATABASE_URL_ADMIN` queda solo para lo que es de todos los negocios (alta, suspensión, cobros).

**Tema por complejo:** el backend devuelve los colores del negocio y el frontend los aplica con `<TemaComplejo>` (`frontend/src/theme/`), que define las variables CSS `--complejo`, `--complejo-sobre`, `--complejo-texto`, `--complejo-suave`, etc. En Tailwind se usan como `bg-complejo`, `text-complejo-texto`, etc. La estructura de las páginas es la misma para todos.
- La base de la página es neutra y el color del complejo es solo acento (botón de reservar, horario elegido, detalles). Nunca pinta fondos grandes.
- Con cualquier color, el frontend deriva: color de texto encima (blanco o casi negro, el de mayor contraste), una versión oscurecida para textos sobre fondo claro (contraste mínimo 4.5:1) y tonos suaves para fondos.
- Sin fotos de portada, se usa un dibujo de la cancha vista desde arriba con el color del complejo.

**Marca HayCancha: "Cal y césped".** Se usa en la página principal, el panel de superadmin y el marco del panel de los dueños.
- Colores: crema `#F1E9D8` (fondo), crema oscuro `#E6DAC2`, césped `#1E7A3E` (acento), noche `#14231A` (texto y bloques oscuros), cal `#F6F1E6`, verde claro `#57C986` (acento sobre fondos oscuros).
- Tipografías: Big Shoulders Display para títulos (mayúsculas, estilo cartel de estadio), Instrument Sans para el texto, Archivo condensada para nombres y números de turnos.
- Logo: una cancha vista desde arriba (rectángulo verde con líneas de cal) y el nombre "HAYCANCHA" con "HAY" en verde.
- Evitar lo genérico: nada de gradientes violetas, emojis como íconos ni todo centrado y redondeado igual. Animaciones con propósito (elegir turno, pasar al pago, confirmar) y respetando `prefers-reduced-motion`.
- Referencia visual: `maquetas/maquetas-haycancha.html`.

## Asistente de IA (solo fase 3)

- Vive solo en la página de cada complejo.
- **RAG filtrado por `negocio_id`** con pgvector: busca solo en el conocimiento de ese complejo.
- Herramientas que puede usar (funciones del backend): `ver_disponibilidad`, `crear_reserva_pendiente`, `generar_link_pago`, `cancelar_reserva`, `registrar_consulta` (guarda lo que no sabe para que el dueño lo complete).
- **No tiene ninguna herramienta para confirmar reservas ni para marcar pagos.**
- Personalización por complejo: nombre del bot, tono y mensaje de bienvenida.
- Límite de mensajes por IP y por sesión para controlar costos.
- El proveedor del modelo va detrás de una interfaz propia, para poder cambiarlo. LangChain es opcional.

## Tests mínimos

- Dos reservas superpuestas en el mismo recurso: la segunda falla (también con duraciones distintas, por ejemplo un turno de 90 minutos contra uno de 60).
- Complejo con 4 canchas de fútbol 7: cuatro reservas a la misma hora quedan en cuatro canchas distintas y la quinta falla, también si llegan todas al mismo tiempo.
- Canchas combinadas (cuando se implemente): reservar la cancha grande bloquea sus partes, y reservar una parte bloquea la grande.
- Un complejo con canchas de fútbol y de pádel muestra cada deporte con su duración y su precio.
- Una reserva cargada a mano o un bloqueo ocupan el turno: la página y el asistente ya no lo ofrecen, y una reserva online en ese horario falla.
- La agenda muestra cada turno con el estado correcto (libre, pendiente, reservado, bloqueado) y el nombre del jugador.
- Un empleado ve la agenda, pero no puede entrar a la configuración ni a los pagos.
- Aislamiento: con `app.negocio_id` de un negocio no se leen ni escriben datos de otro.
- Webhook con firma inválida: 401.
- Webhook repetido: el turno se confirma una sola vez y hay un solo registro en `pagos`.
- Monto distinto a la seña: no se confirma.
- Pago que llega con la reserva vencida y el horario tomado: se devuelve el pago.
- Cálculo de seña fija y por porcentaje.

## Fases

Hasta la puesta en línea, todo se desarrolla en local: la base es el Postgres de `docker-compose.yml` (`haycancha_dev` para la app y `haycancha_test` para los tests).

**Fase 0: base del proyecto**
- [x] Estructura de carpetas, uv, Vite, ruff, pytest, `.env.example`
- [x] Alembic con la migración de las extensiones `btree_gist` y `vector`
- [x] Postgres local con Docker andando y la migración aplicada
- [x] Sistema de diseño en el frontend: marca HayCancha, tipografías, motor de tema por complejo y animaciones base
- [x] Repo en GitHub con el primer commit (`github.com/juanperdomo-9/HayCancha`)

**Fase 1: una sola web para todos los complejos** (en 4 bloques: 1A datos y seguridad, 1B disponibilidad y páginas públicas, 1C login, configuración y superadmin, 1D agenda)
- [x] Tabla global `deportes` con sus datos iniciales
- [x] Tablas `negocios`, `usuarios`, `recursos`, `horarios`, `clientes`, `reservas` con `negocio_id`
- [x] Rol `app_user`, RLS y `set_config` por transacción
- [x] Rutas públicas por slug y cálculo de disponibilidad (el botón final dice "Pago online: muy pronto" hasta la fase 2)
- [x] Página principal de HayCancha con el listado de complejos
- [x] Login y panel del dueño: canchas, horarios, precios, marca, equipo
- [x] Agenda del día y de la semana, detalle de reserva, reservas cargadas a mano y bloqueos
- [x] Panel de superadmin: alta de negocios, cobro y suspensión, y "Configurar" cada complejo
- [x] Cargar un complejo de prueba como primer negocio, con varias canchas de fútbol 7, una de fútbol 5 y una de pádel (`app.cli cargar-ejemplo`, con usuarios de prueba solo locales en `app/ejemplo.py`)

**Fase 2: seña con Mercado Pago**
- [ ] App en Mercado Pago Developers y OAuth por complejo (el OAuth con PKCE, la pestaña Cobros y la renovación de tokens ya están; falta crear la app y cargar sus claves)
- [x] Reserva `pendiente_pago` con vencimiento y job de vencimiento
- [x] Preferencia con vencimiento, sin efectivo y `binary_mode`
- [x] Webhook con firma, consulta del pago, idempotencia y reembolsos (con reintento de devoluciones pendientes)
- [x] Cancelación y cambio de horario del jugador (una vez, con la anticipación de la política), y "¿Devolver la seña?" al cancelar desde el panel
- [x] Emails al dueño (reserva nueva, cancelación, cambio de horario, devolución pendiente, Mercado Pago desvinculado) e invitaciones por email, con Resend (sin `EMAIL_API_KEY` se muestran en el log). Falta verificar el dominio en Resend (puesta en línea)
- [x] Botón opcional "Consultar por WhatsApp" por complejo (`negocios.whatsapp`)
- [ ] Pruebas completas con usuarios de prueba de Mercado Pago

**Puesta en línea** (cuando haya que mostrarlo afuera o antes de cobrar señas reales; puede ir entre la fase 1 y la 2). Plan detallado en `docs/puesta-en-linea.md`: el dominio se delega a un DNS (Cloudflare) porque nic.ar no guarda registros, y los logos no pueden quedar en el disco de Render (se borra en cada deploy).
- [ ] Dominio `haycancha.com.ar` registrado en nic.ar
- [ ] Proyectos `pruebas` y `produccion` en Supabase, conexión por el pooler, extensiones y migraciones aplicadas
- [ ] Deploy en Render (backend, frontend y cron job) con `api.haycancha.com.ar`

**Fase 3: asistente de IA**
- [ ] Carga de conocimiento por complejo en el panel
- [ ] Embeddings con pgvector y búsqueda filtrada por `negocio_id`
- [ ] Agente con herramientas
- [ ] Chat en la página del complejo
- [ ] Notificaciones push (la página instalable como app)

## Decisiones abiertas

Preguntá antes de asumir cualquiera de estas:
- Modelo de IA y su costo por complejo

## Documentación de referencia

Buscá la versión para Argentina de cada página (dominio `mercadopago.com.ar`).

- Mercado Pago, vigencia de la preferencia: https://www.mercadopago.com.br/developers/es/docs/checkout-pro/checkout-customization/preferences/term-of-preference
- Mercado Pago, webhooks: https://www.mercadopago.cl/developers/es/docs/checkout-pro/additional-content/notifications/webhooks
- Mercado Pago, renovación del token de OAuth: https://www.mercadopago.com.pe/developers/es/docs/security/oauth/renewal
- Mercado Pago, marketplace: https://mercadopago.com.mx/developers/es/docs/split-payments/integration-configuration/integrate-marketplace
- Supabase, conexión y pooler: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase, prepared statements con el pooler: https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL
- Supabase, extensiones: https://supabase.com/docs/guides/database/extensions

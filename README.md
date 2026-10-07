# HayCancha

Reservas de canchas para complejos deportivos: cada complejo tiene su página
(`haycanchas.com.ar/el-potrero`) donde los jugadores ven los horarios libres, reservan y
pagan la seña, sin mandar un WhatsApp. El dueño maneja todo desde su panel.

La guía completa del proyecto (reglas, modelo de datos, fases y decisiones) está en
[`CLAUDE.md`](CLAUDE.md).

## Qué hay

| Dirección | Qué es |
| --- | --- |
| `/` | Página principal: los complejos y su próximo turno libre |
| `/:slug` | Página de un complejo: horarios libres, precio y seña |
| `/ingresar` | Ingreso de dueños, empleados y del equipo de HayCancha |
| `/panel/:slug` | Panel del complejo: agenda, canchas, horarios, seña, su página y equipo |
| `/admin` | Panel de HayCancha: alta de complejos, cobros y suspensiones |

## Estructura

```
backend/    API en FastAPI (Python 3.12, uv), SQLAlchemy, Alembic
frontend/   React + Vite + TypeScript + Tailwind
docker/     Postgres local (desarrollo y tests)
docs/       Formulario de alta de complejos y planes de trabajo
maquetas/   Maquetas de diseño
```

## Cómo levantarlo en tu compu

Necesitás Docker Desktop, [uv](https://docs.astral.sh/uv/) y Node 24.

```bash
docker compose up -d --wait                       # Postgres local (puerto 5433)
cd backend
cp .env.example .env                              # y completá JWT_SECRET
uv run alembic upgrade head                       # crea las tablas
uv run python -m app.cli preparar-base            # habilita el usuario de la app
uv run python -m app.cli cargar-ejemplo           # complejo de ejemplo: El Potrero
uv run python -m app.cli crear-superadmin --usuario tu-usuario
uv run uvicorn app.main:app --reload              # API en http://localhost:8000
```

En otra terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                                       # web en http://localhost:5173
```

## Tests y linters

```bash
cd backend && uv run pytest && uv run ruff check . && uv run ruff format --check .
cd frontend && npm test && npm run lint && npm run build
```

Los tests del backend usan una base descartable (`TEST_DATABASE_URL`), nunca una base real.

---

Desarrollo web por [jpweb.com.ar](https://jpweb.com.ar)

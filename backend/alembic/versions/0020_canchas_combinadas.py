"""canchas combinadas: espejos automáticos en la base

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-16

Algunos complejos unen canchas: dos de fútbol 5 forman una de fútbol 7. La relación ya
estaba en recursos_combinados (cancha grande -> cada parte). Ahora la base mantiene sola
las reservas espejo: cuando una reserva ocupa una cancha (pendiente de pago, confirmada o
bloqueo), se crea un bloqueo "espejo" en cada cancha que comparte lugar con ella; cuando
deja de ocuparla (vence, se cancela) o cambia de cancha u horario, sus espejos se
cancelan y se vuelven a crear. Como los espejos son reservas 'bloqueada', la misma regla
de superposición (reservas_sin_superposicion) impide que se pisen, y si un espejo choca,
falla la reserva original con el mismo error.

La regla de superposición se divide en dos, para que los espejos puedan
superponerse entre sí (si se reservan las dos de fútbol 5 por separado, cada una deja su
espejo en la de fútbol 7; al cancelar una, la otra la sigue bloqueando):
- reservas_sin_superposicion: dos reservas reales no se pisan (como antes).
- reservas_sin_pisar_espejos: una real y un espejo tampoco.

Comparten lugar dos canchas cuando sus "huellas" se tocan: la huella de una cancha es
ella misma y todas sus partes (y las partes de sus partes). Así, reservar la grande
bloquea sus partes, reservar una parte bloquea la grande, y dos grandes que comparten
una parte también se bloquean entre sí.

Va en un trigger para que valga en todos los caminos (página, panel, asistente, mover,
cambio de horario, vencimiento y webhook) sin depender del código.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0020"
down_revision: str | Sequence[str] | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE reservas DROP CONSTRAINT reservas_sin_superposicion")
    op.execute(
        """
        ALTER TABLE reservas ADD CONSTRAINT reservas_sin_superposicion
          EXCLUDE USING gist (
            recurso_id WITH =,
            tstzrange(inicio, fin, '[)') WITH &&
          ) WHERE (estado IN ('pendiente_pago', 'confirmada', 'bloqueada')
                   AND reserva_origen_id IS NULL)
        """
    )
    op.execute(
        """
        ALTER TABLE reservas ADD CONSTRAINT reservas_sin_pisar_espejos
          EXCLUDE USING gist (
            recurso_id WITH =,
            tstzrange(inicio, fin, '[)') WITH &&,
            (reserva_origen_id IS NULL) WITH <>
          ) WHERE (estado IN ('pendiente_pago', 'confirmada', 'bloqueada'))
        """
    )
    op.execute(
        """
        CREATE FUNCTION canchas_en_conflicto(p_negocio uuid, p_recurso uuid)
        RETURNS TABLE (id uuid)
        LANGUAGE sql STABLE
        AS $$
          WITH RECURSIVE huella(raiz, id) AS (
            SELECT r.id, r.id FROM recursos r WHERE r.negocio_id = p_negocio
            UNION
            SELECT h.raiz, rc.parte_id
            FROM huella h
            JOIN recursos_combinados rc
              ON rc.negocio_id = p_negocio AND rc.recurso_id = h.id
          )
          SELECT DISTINCT otra.raiz
          FROM huella mia
          JOIN huella otra ON otra.id = mia.id
          WHERE mia.raiz = p_recurso AND otra.raiz <> p_recurso
        $$
        """
    )
    # Rehace los espejos de una reserva: cancela los que tenía y, si ocupa la cancha, crea
    # uno en cada cancha que comparte lugar. La usan el trigger y el panel (cuando el dueño
    # cambia qué canchas se unen).
    op.execute(
        """
        CREATE FUNCTION rehacer_espejos(p_negocio uuid, p_reserva uuid) RETURNS void
        LANGUAGE plpgsql
        AS $$
        DECLARE
          r reservas%ROWTYPE;
        BEGIN
          SELECT * INTO r FROM reservas WHERE negocio_id = p_negocio AND id = p_reserva;
          -- Las reservas no se borran: los espejos viejos se cancelan.
          UPDATE reservas SET estado = 'cancelada'
          WHERE negocio_id = p_negocio AND reserva_origen_id = p_reserva
            AND estado = 'bloqueada';
          IF r.estado IN ('pendiente_pago', 'confirmada', 'bloqueada') THEN
            INSERT INTO reservas
              (negocio_id, recurso_id, reserva_origen_id, inicio, fin, estado,
               motivo_bloqueo, origen)
            SELECT p_negocio, c.id, r.id, r.inicio, r.fin, 'bloqueada',
                   'Se usa en ' || (SELECT x.nombre FROM recursos x
                                    WHERE x.negocio_id = p_negocio AND x.id = r.recurso_id),
                   r.origen
            FROM canchas_en_conflicto(p_negocio, r.recurso_id) c;
          END IF;
        END
        $$
        """
    )
    op.execute(
        """
        CREATE FUNCTION sincronizar_espejos() RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          -- Los espejos no generan espejos.
          IF NEW.reserva_origen_id IS NOT NULL THEN
            RETURN NULL;
          END IF;
          IF TG_OP = 'UPDATE' AND NEW.estado = OLD.estado AND NEW.inicio = OLD.inicio
             AND NEW.fin = OLD.fin AND NEW.recurso_id = OLD.recurso_id THEN
            RETURN NULL;
          END IF;
          IF TG_OP = 'INSERT'
             AND NEW.estado NOT IN ('pendiente_pago', 'confirmada', 'bloqueada') THEN
            RETURN NULL;
          END IF;
          PERFORM rehacer_espejos(NEW.negocio_id, NEW.id);
          RETURN NULL;
        END
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER espejos_de_canchas_combinadas
        AFTER INSERT OR UPDATE OF estado, inicio, fin, recurso_id ON reservas
        FOR EACH ROW EXECUTE FUNCTION sincronizar_espejos()
        """
    )
    op.execute("CREATE INDEX ix_reservas_origen ON reservas (reserva_origen_id)")


def downgrade() -> None:
    op.execute("ALTER TABLE reservas DROP CONSTRAINT reservas_sin_pisar_espejos")
    op.execute("ALTER TABLE reservas DROP CONSTRAINT reservas_sin_superposicion")
    op.execute(
        """
        ALTER TABLE reservas ADD CONSTRAINT reservas_sin_superposicion
          EXCLUDE USING gist (
            recurso_id WITH =,
            tstzrange(inicio, fin, '[)') WITH &&
          ) WHERE (estado IN ('pendiente_pago', 'confirmada', 'bloqueada'))
        """
    )
    op.execute("DROP INDEX ix_reservas_origen")
    op.execute("DROP TRIGGER espejos_de_canchas_combinadas ON reservas")
    op.execute("DROP FUNCTION sincronizar_espejos()")
    op.execute("DROP FUNCTION rehacer_espejos(uuid, uuid)")
    op.execute("DROP FUNCTION canchas_en_conflicto(uuid, uuid)")

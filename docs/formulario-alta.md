# Formulario de alta de complejos

Lo completa el dueño cuando dice que sí. Con estas respuestas, el equipo de HayCancha
carga todo y el complejo queda funcionando sin que el dueño configure nada. La pantalla
de alta de `/admin` sigue este mismo orden. Entre corchetes, el campo donde se guarda.

**Texto de introducción para el formulario:**
> ¡Bienvenido a HayCancha! Con estos datos armamos tu página de reservas. Te lleva unos
> 10 minutos. Si algo no lo sabés ahora, dejalo en blanco y lo vemos juntos.

## 1. Tu complejo
1. Nombre del complejo, tal como lo conocen los jugadores. [`negocios.nombre`]
2. Dirección y barrio. [`direccion`, `barrio`]
3. ¿Cómo querés que sea la dirección de tu página? `haycancha.com.ar/_____`
   (en minúsculas y con guiones, por ejemplo `el-potrero`). [`slug`]
4. ¿Qué servicios tiene el complejo? (elegí todos los que correspondan)
   Vestuarios · Duchas · Estacionamiento · Buffet · Parrilla · Wi-Fi · Alquiler de pelotas
   o paletas · Otro: ____ [`servicios`]
5. Tu nombre, teléfono y email. Con ese email vas a entrar al panel. [`usuarios` rol `dueno`]

## 2. Tus canchas
Repetir por cada cancha:
6. Nombre de la cancha, como la llaman ustedes (Cancha 1, Pádel 2, La techada…). [`recursos.nombre`]
7. Deporte: Fútbol 5 · Fútbol 7 · Fútbol 11 · Pádel · Tenis · Básquet · Vóley · Otro. [`deporte_id`]
8. Características: techada o descubierta; piso (sintético, cemento, parquet, polvo de
   ladrillo…); paredes de pádel (blindex o muro). [`caracteristicas`]

9. ¿Unen canchas? Por ejemplo, dos de fútbol 5 que juntas forman una de fútbol 7.
   ¿Cuáles? [`recursos_combinados`]

## 3. Horarios y precios
Por cada deporte (o por cancha, si alguna tiene horarios distintos):
10. Días y horario en que se alquila (por ejemplo: lunes a domingo de 9 a 24; viernes y
    sábado hasta las 2). [`horarios.dia_semana`, `desde`, `hasta`]
11. Duración de cada turno (fútbol suele ser 60 minutos; pádel, 90). [`duracion_turno_min`]
12. Precio del turno. Si cambia según el horario o el día, contanos cómo (por ejemplo:
    $70.000 hasta las 18 y $85.000 de 18 a 24). [`precio`, una franja por precio]

## 4. Seña y cancelación
13. ¿Cuánto cobrás de seña para reservar? Un porcentaje del turno (lo habitual es 20%) o
    un monto fijo. [`sena_tipo`, `sena_valor`]
14. ¿Con cuántas horas de anticipación puede cancelar un jugador y recuperar la seña?
    (por ejemplo, 24 horas; si cancela con menos, la pierde). [`horas_cancelacion`, obligatorio]
15. ¿Cuántos minutos le damos al jugador para pagar la seña antes de liberar el turno?
    (recomendamos 10). [`minutos_para_pagar`]

## 5. Tu marca
16. Logo (idealmente en PNG o SVG, con fondo transparente). [`logo_url`]
17. Una o más fotos del complejo para la portada: horizontales, de día y con buena luz.
    Si no tenés, usamos un dibujo de tu cancha con tus colores. [`portada_url`]
18. Colores del complejo (si los tienen; si no, los sacamos del logo). [`color_primario`,
    `color_secundario`]

## 6. Tu equipo
19. Nombre y email de las personas que van a manejar la agenda (reciben un link para
    entrar; ven y cargan reservas, pero no tocan precios ni pagos). [`usuarios` rol `empleado`]

## 7. Cobros
20. ¿Tenés una cuenta de Mercado Pago a nombre del complejo? Las señas entran directo ahí.
    La vinculamos juntos más adelante. [se vincula en la fase 2]

## 8. Algo más
21. ¿Hay algo que quieras que sepamos? (reglas del complejo, torneos fijos, horarios que
    siempre están tomados…)

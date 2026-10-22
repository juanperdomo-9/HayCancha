"""Simula el perfil de Instagram de HayCanchas: destacadas arriba y grilla abajo.
Uso: python instagram/perfil_preview.py  (después de exportar las piezas)."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).parent
FONDO, TEXTO, GRIS = (0, 0, 0), (245, 245, 245), (168, 168, 168)
W = 1080
F = "C:/Windows/Fonts/"


def fuente(tam, negrita=False):
    return ImageFont.truetype(F + ("segoeuib.ttf" if negrita else "segoeui.ttf"), tam)


def circulo(img, d):
    img = img.resize((d, d), Image.LANCZOS)
    mascara = Image.new("L", (d * 4, d * 4), 0)
    ImageDraw.Draw(mascara).ellipse((0, 0, d * 4 - 1, d * 4 - 1), fill=255)
    img.putalpha(mascara.resize((d, d), Image.LANCZOS))
    return img


lienzo = Image.new("RGB", (W, 2400), FONDO)
d = ImageDraw.Draw(lienzo)

# Cabecera: avatar, nombre y bio.
logo = Image.open(AQUI.parent / "frontend/public/logo-haycanchas.png").convert("RGBA")
lienzo.paste(circulo(logo, 190), (48, 60), circulo(logo, 190))
d.text((280, 70), "haycanchas", font=fuente(44, True), fill=TEXTO)
d.text((280, 135), "4 publicaciones", font=fuente(32), fill=TEXTO)
bio = ["HayCanchas", "Reservá tu cancha online: turnos libres de verdad", "y seña con Mercado Pago. Sin llamar a nadie.", "haycanchas.com.ar"]
for i, linea in enumerate(bio):
    d.text((48, 290 + i * 44), linea, font=fuente(32, i == 0), fill=(224, 241, 255) if i == 3 else TEXTO)

# Destacadas: la portada recortada en círculo, como Instagram.
nombres = ["Cómo reservar", "Dueños", "Deportes", "Preguntas", "Complejos", "Novedades"]
archivos = ["1-como-reservar", "2-duenos", "3-deportes", "4-preguntas", "5-complejos", "6-novedades"]
for i, (nombre, archivo) in enumerate(zip(nombres, archivos)):
    portada = Image.open(AQUI / f"destacadas/portadas/{archivo}.png").convert("RGBA")
    recorte = portada.crop((240, 660, 840, 1260))  # el círculo de 600px del centro
    x = 40 + i * 172
    d.ellipse((x - 5, 495, x + 145, 645), outline=(54, 54, 54), width=3)
    lienzo.paste(circulo(recorte, 140), (x, 500), circulo(recorte, 140))
    ancho = d.textlength(nombre, font=fuente(24))
    d.text((x + 70 - ancho / 2, 660), nombre, font=fuente(24), fill=TEXTO)

# Grilla (lo último publicado, arriba a la izquierda), con el recorte 3:4 del perfil.
orden = ["4-deportes", "3-para-duenos", "2-como-reservar", "1-lanzamiento"]
celda_w, celda_h, gap = 358, 477, 3
for i, carpeta in enumerate(orden):
    slide = Image.open(AQUI / f"carruseles/{carpeta}/slide-1.png").convert("RGB")
    alto = round(1080 * celda_h / celda_w)
    top = (1350 - alto) // 2
    tile = slide.crop((0, top, 1080, top + alto)).resize((celda_w, celda_h), Image.LANCZOS)
    x = (i % 3) * (celda_w + gap)
    y = 740 + (i // 3) * (celda_h + gap)
    lienzo.paste(tile, (x, y))

final_h = 740 + 2 * (celda_h + gap) + 40
lienzo.crop((0, 0, W, final_h)).save(AQUI / "perfil-preview.png")
print("instagram/perfil-preview.png")

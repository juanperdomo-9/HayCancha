/** Achica una foto antes de subirla: lado mayor hasta `maximo` píxeles, en WebP. Una foto
 * de celular de 3-5 MB queda en unos 200-400 KB (más espacio en el almacenamiento y la
 * página carga más rápido). Si algo falla o no achica, se sube la original. */
export async function achicarImagen(archivo: File, maximo: number): Promise<File> {
  try {
    const imagen = await createImageBitmap(archivo)
    const escala = Math.min(1, maximo / Math.max(imagen.width, imagen.height))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(imagen.width * escala)
    lienzo.height = Math.round(imagen.height * escala)
    lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
    imagen.close()
    const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, 'image/webp', 0.82))
    // Safari viejo no sabe hacer WebP y devuelve PNG: ahí conviene la original.
    if (!blob || blob.type !== 'image/webp' || blob.size >= archivo.size) return archivo
    return new File([blob], archivo.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' })
  } catch {
    return archivo
  }
}

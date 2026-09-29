/** Links para llamar o escribir por WhatsApp desde el celular del dueño. */

export function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, '')
}

/**
 * Número de Argentina en formato internacional para WhatsApp (549 + área + número).
 * "11 5555-1234", "011 15 5555 1234" y "+54 9 11 5555 1234" dan 5491155551234.
 */
export function numeroWhatsapp(telefono: string): string {
  let n = soloDigitos(telefono)
  if (n.startsWith('549')) return n
  if (n.startsWith('54')) n = n.slice(2)
  if (n.startsWith('0')) n = n.slice(1)
  // El "15" de los celulares va después del código de área (2 a 4 dígitos): se saca.
  const conQuince = n.match(/^(\d{2,4})15(\d{6,8})$/)
  if (conQuince && conQuince[1].length + conQuince[2].length === 10) n = conQuince[1] + conQuince[2]
  return `549${n}`
}

export const urlWhatsapp = (telefono: string) => `https://wa.me/${numeroWhatsapp(telefono)}`
export const urlLlamar = (telefono: string) => `tel:+${numeroWhatsapp(telefono).replace(/^549/, '54')}`

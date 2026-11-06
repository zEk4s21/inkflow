/*
 * Teléfonos de WhatsApp en el formato que entiende wa.me: código de país + número, solo dígitos.
 * Los clientes casi siempre escriben el número como lo marcan en Argentina ("11 2233-4455",
 * "011 15 2233-4455"), sin el 54 ni el 9 de celular: sin completarlos, wa.me abre otro país.
 */

const ARGENTINA = "54";
/** Número nacional argentino sin prefijos: código de área (empieza con 1, 2 o 3) + abonado. */
const AR_NATIONAL = /^[1-3][0-9]{9}$/;

/**
 * Devuelve el número listo para wa.me. Los números argentinos quedan como 549 + área + abonado.
 * Si empieza con + (o 00) y otro código de país, se respeta tal cual.
 * Ej.: "11 2233-4455", "(011) 15-2233-4455" y "+54 9 11 2233-4455" → "5491122334455".
 */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits === "") return "";

  const international = trimmed.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith(ARGENTINA) && (international || digits.length >= 12)) {
    return argentineMobile(digits.slice(ARGENTINA.length)) ?? digits;
  }
  if (international) return digits;
  return argentineMobile(digits) ?? digits;
}

/** Número argentino nacional → 549 + área + abonado, o null si no tiene esa forma. */
function argentineMobile(national: string): string | null {
  let number = national;
  if (number.startsWith("9")) number = number.slice(1); // el 9 de celular ya venía
  if (number.startsWith("0")) number = number.slice(1); // prefijo de larga distancia
  // Formato local de celular: área (2 a 4 cifras) + 15 + abonado.
  if (number.length === 12) {
    const area = [2, 3, 4].find((length) => number.slice(length, length + 2) === "15");
    if (area) number = number.slice(0, area) + number.slice(area + 2);
  }
  return AR_NATIONAL.test(number) ? `549${number}` : null;
}

/** Link para abrir un chat de WhatsApp, opcionalmente con un mensaje escrito. */
export function whatsappUrl(phone: string, text?: string): string {
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/**
 * Para mostrar: "5491122334455" → "+54 9 11 2233-4455". En el interior el largo del código de
 * área varía, así que solo se separa el 54 9. Otros países: "+" y los dígitos.
 */
export function formatPhone(phone: string): string {
  const buenosAires = /^54911([0-9]{4})([0-9]{4})$/.exec(phone);
  if (buenosAires) return `+54 9 11 ${buenosAires[1]}-${buenosAires[2]}`;
  if (/^549[1-3][0-9]{9}$/.test(phone)) return `+54 9 ${phone.slice(3)}`;
  return `+${phone}`;
}

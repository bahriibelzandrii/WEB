/**
 * Серверна валідація форм (Lab 3).
 *
 * У жодній формі немає атрибута `required` — усі перевірки робить сервер.
 * Помилки збираються у `errors: string[]` і повертаються разом із
 * повторним рендером форми зі статусом 400 (паттерн Lab 2:
 * locals `errors` + `values`, банер — views/partials/flash.pug).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim білих символів; будь-що інше → "". */
export function clean(v: unknown): string {
  return String(v ?? "").trim();
}

/** Число з поля (допускає «,» як десятковий роздільник); порожнє/не число → null. */
export function toNumber(v: unknown): number | null {
  const s = clean(v).replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** «YYYY-MM-DD» → UTC-опівночі (канонічне зберігання date-only); інше → null.
 * Відхиляє й календарно неіснуючі дати (2024-13-45 тощо) через round-trip-перевірку. */
export function parseDateOnly(v: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(v));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v);
}

/** Телефон: 10–15 цифр, необов'язковий «+» на початку, роздільники ( ) - і пробіли. */
export function isPhone(v: string): boolean {
  if (!/^\+?[0-9][0-9()\-\s]*$/.test(v)) return false;
  const digits = v.replace(/\D/g, "").length;
  return digits >= 10 && digits <= 15;
}

/** Телефон UA: +380 + 9 цифр (12) або 0 + 9 цифр (10).
 *  Дозволені роздільники: пробіл ( ) - . ; необов'язковий «+» на початку. */
export function isUaPhone(v: string): boolean {
  if (!/^\+?[0-9][0-9()\-. \t]*$/.test(v)) return false;
  const d = v.replace(/\D/g, "");
  return (d.length === 12 && d.startsWith("380")) || (d.length === 10 && d.startsWith("0"));
}

/** true, якщо у числі ≤ max знаків після коми/крапки (для ціни/годин). */
export function maxDecimals(v: unknown, max = 2): boolean {
  const s = clean(v).replace(",", ".");
  const i = s.indexOf(".");
  if (i === -1) return true;
  return s.length - i - 1 <= max;
}

export const MIN_DATE = Date.UTC(1990, 0, 1); // дати раніше 1990 — недопустимі

/** true, якщо рядок непорожній і довший за `max`. */
export function tooLong(v: string, max: number): boolean {
  return v.length > max;
}

/** Prisma P2002 — порушення унікальності (email, name, sku). */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("code" in err)) return false;
  return err.code === "P2002";
}

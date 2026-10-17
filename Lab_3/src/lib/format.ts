/**
 * Форматування даних для представлень (docs/PAGES.md §2.2).
 * Decimal/числа завжди пропускати через ці функції перед рендером.
 */

const uahFmt = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" });

/** Гроші: `1 234,56 ₴`. Приймає Decimal (як рядок/число), number, string. */
export function uah(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return uahFmt.format(n);
}

/** Дата: `14.09.2026`. */
export function dateOnly(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("uk-UA");
}

/** Дата + час: `14.09.2026, 15:30`. */
export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("uk-UA")}, ${d.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Розмір файлу: `840 КБ` / `1,2 МБ`. */
export function bytes(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
}

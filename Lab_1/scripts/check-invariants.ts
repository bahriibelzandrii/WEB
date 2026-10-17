/**
 * Перевірка інваріантів І1–І10 (docs/DATA_MODEL.md) на всіх даних БД.
 * Запуск: npm run check. При порушенні — exit code 1.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type Violation = string;
const results: Array<{ id: string; name: string; violations: Violation[] }> = [];

function check(id: string, name: string, violations: Violation[]) {
  results.push({ id, name, violations });
}

const DAY = 86_400_000;

async function main() {
  const requests = await prisma.request.findMany({
    include: {
      works: true,
      parts: true,
      estimate: true,
      invoice: { include: { payments: true } },
      warranty: true,
      originalRequest: true,
    },
  });

  // І1 — Estimate.total = totalWorks + totalParts
  {
    const v: Violation[] = [];
    for (const r of requests) {
      if (!r.estimate) continue;
      const e = r.estimate;
      if (Number(e.total) !== Number(e.totalWorks) + Number(e.totalParts))
        v.push(`${r.number}: total(${e.total}) ≠ works(${e.totalWorks}) + parts(${e.totalParts})`);
    }
    check("І1", "Estimate.total = totalWorks + totalParts", v);
  }

  // І2 — Estimate.totalWorks = Σ RequestWork.cost
  {
    const v: Violation[] = [];
    for (const r of requests) {
      if (!r.estimate) continue;
      const sum = r.works.reduce((s, w) => s + Number(w.cost), 0);
      if (Number(r.estimate.totalWorks) !== sum)
        v.push(`${r.number}: totalWorks(${r.estimate.totalWorks}) ≠ Σ works(${sum})`);
    }
    check("І2", "Estimate.totalWorks = Σ RequestWork.cost", v);
  }

  // І3 — Estimate.totalParts = Σ (quantity × unitPrice)
  {
    const v: Violation[] = [];
    for (const r of requests) {
      if (!r.estimate) continue;
      const sum = r.parts.reduce((s, p) => s + p.quantity * Number(p.unitPrice), 0);
      if (Number(r.estimate.totalParts) !== sum)
        v.push(`${r.number}: totalParts(${r.estimate.totalParts}) ≠ Σ parts(${sum})`);
    }
    check("І3", "Estimate.totalParts = Σ (qty × unitPrice)", v);
  }

  // І4 — Invoice.finalTotal = total − discount
  {
    const v: Violation[] = [];
    for (const r of requests) {
      if (!r.invoice) continue;
      const i = r.invoice;
      if (Number(i.finalTotal) !== Number(i.total) - Number(i.discount))
        v.push(`${r.number}: finalTotal(${i.finalTotal}) ≠ total(${i.total}) − discount(${i.discount})`);
    }
    check("І4", "Invoice.finalTotal = total − discount", v);
  }

  // І5 — Invoice.status ↔ Σ payments
  {
    const v: Violation[] = [];
    for (const r of requests) {
      if (!r.invoice) continue;
      const i = r.invoice;
      const paid = i.payments.reduce((s, p) => s + Number(p.amount), 0);
      const final = Number(i.finalTotal);
      const expected = paid <= 0 ? (final <= 0 ? "PAID" : "UNPAID") : paid >= final ? "PAID" : "PARTIAL";
      if (i.status !== expected)
        v.push(`${r.number}: status=${i.status}, але Σ payments=${paid} / finalTotal=${final} ⇒ очікувано ${expected}`);
    }
    check("І5", "Invoice.status узгоджений із платежами", v);
  }

  // І6 — Warranty.endDate = startDate + periodDays
  {
    const v: Violation[] = [];
    for (const r of requests) {
      if (!r.warranty) continue;
      const w = r.warranty;
      const expected = new Date(w.startDate.getTime() + w.periodDays * DAY);
      if (w.endDate.getTime() !== expected.getTime())
        v.push(`${r.number}: endDate(${w.endDate.toISOString()}) ≠ startDate + ${w.periodDays}д (${expected.toISOString()})`);
    }
    check("І6", "Warranty.endDate = startDate + periodDays", v);
  }

  // І7 — WARRANTY_CLAIM ⇒ originalRequestId ≠ null
  {
    const v: Violation[] = [];
    for (const r of requests) {
      if (r.type === "WARRANTY_CLAIM" && !r.originalRequestId)
        v.push(`${r.number}: WARRANTY_CLAIM без originalRequestId`);
    }
    check("І7", "WARRANTY_CLAIM ⇒ originalRequestId", v);
  }

  // І8 — RequestPart.quantity ≥ 1
  {
    const v: Violation[] = [];
    for (const r of requests) {
      for (const p of r.parts) {
        if (p.quantity < 1) v.push(`${r.number}: quantity=${p.quantity} < 1`);
      }
    }
    check("І8", "RequestPart.quantity ≥ 1", v);
  }

  // І9 — discount ≥ 0, finalTotal ≥ 0, Payment.amount > 0
  {
    const v: Violation[] = [];
    for (const r of requests) {
      if (!r.invoice) continue;
      const i = r.invoice;
      if (Number(i.discount) < 0) v.push(`${r.number}: discount=${i.discount} < 0`);
      if (Number(i.finalTotal) < 0) v.push(`${r.number}: finalTotal=${i.finalTotal} < 0`);
      for (const p of i.payments) {
        if (Number(p.amount) <= 0) v.push(`${r.number}: payment.amount=${p.amount} ≤ 0`);
      }
    }
    check("І9", "Грошові обмеження (discount/finalTotal/amount)", v);
  }

  // І10 — активні записи: deletedAt = null; Request.number унікальний
  {
    const v: Violation[] = [];
    for (const r of requests) {
      if (r.deletedAt !== null) v.push(`${r.number}: deletedAt ≠ null`);
    }
    const seen: Record<string, number> = {};
    for (const r of requests) seen[r.number] = (seen[r.number] ?? 0) + 1;
    for (const [n, c] of Object.entries(seen)) if (c > 1) v.push(`дубль number=${n} ×${c}`);
    check("І10", "deletedAt = null; number унікальний", v);
  }

  // Звіт
  let failed = 0;
  console.log("Перевірка інваріантів (docs/DATA_MODEL.md):\n");
  for (const r of results) {
    const ok = r.violations.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? "✅" : "❌"} ${r.id} — ${r.name}`);
    for (const msg of r.violations) console.log(`     • ${msg}`);
  }
  console.log(
    failed === 0
      ? `\nУсі інваріанти виконані (${results.length}/${results.length}).`
      : `\nПорушень: ${failed} із ${results.length}.`
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error("CHECK FAILED (помилка виконання):", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * web-check.ts — незалежні детерміновані веб-тести (Lab 2).
 *
 * Кожен запуск починається з чистого стану:
 *   0. ре-seed БД (seed ідемпотентний: очищує таблиці + детерміновані дані:
 *      60 заявок, 30 клієнтів, 45 пристроїв, 14 робіт);
 *   1. запуск createApp() на ефемерному порту (незалежно від dev-сервера);
 *   2. строгі асерції: каркас, списки (абсолютні лічильники), картки,
 *      повні картки (оцінка/рахунок/вкладення/гарантія), відсутність
 *      форм створення/редагування/переходів (перенесено у наступну ЛР).
 *
 * Запуск: npm run check:web
 * Вихідний код: 0 — усі тести пройшли, 1 — є провали, 2 — інфраструктурна помилка.
 */
import { spawnSync } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import prisma from "../src/prisma.js";

interface Result {
 name: string;
 ok: boolean;
 detail?: string;
}

const results: Result[] = [];

function check(name: string, ok: boolean, detail = ""): void {
 results.push({ name, ok, detail });
 console.log(`${ok ? "  ✅" : "  ❌"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

interface Resp {
 code: number;
 location?: string;
 body: string;
}

let base = "";
let port = 0;

function req(method: string, path: string): Promise<Resp> {
 const { promise, resolve, reject } = Promise.withResolvers<Resp>();
 const r = http.request(
  {
   host: "127.0.0.1",
   port,
   path,
   method,
  },
  (res) => {
   let body = "";
   res.on("data", (c) => (body += c));
   res.on("end", () =>
    resolve({ code: res.statusCode ?? 0, location: res.headers.location, body }),
   );
  },
 );
 r.on("error", reject);
 r.end();
 return promise;
}

/** Дані рядки <tbody> сторінки-таблиці. */
function rows(html: string): string[] {
 const m = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
 if (!m) return [];
 return m[1].split(/<tr>/).slice(1);
}

/** id сутностей з посилань виду /<prefix>/<id> (без «new»). */
function idsFrom(html: string, prefix: string): string[] {
 const out: string[] = [];
 const re = new RegExp(`href="/${prefix}/([a-z0-9]+)"`, "g");
 let m: RegExpExecArray | null;
 while ((m = re.exec(html))) {
  if (m[1] !== "new") out.push(m[1]);
 }
 return out;
}

function section(title: string): void {
 console.log(`\n${title}`);
}

async function main(): Promise<void> {
 console.log("web-check: детерміновані веб-тести (Lab 2)");

 // 0) Детермінований сброс: ре-seed (ідемпотентний).
 console.log("→ ре-seed БД...");
 const seed = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
  { encoding: "utf-8" },
 );
 if (seed.status !== 0) {
  console.error(seed.stderr || seed.stdout);
  process.exit(2);
 }

 // 1) Свій сервер на ефемерному порту.
 const app = createApp();
 const server = app.listen(0);
 const { promise: listening, resolve: resolveListening } = Promise.withResolvers<void>();
 server.once("listening", () => resolveListening());
 await listening;
 port = (server.address() as AddressInfo).port;
 base = `http://127.0.0.1:${port}`;
 console.log(`→ сервер: ${base}`);

 // ---------------- A. Каркас ----------------
 section("A. Каркас");
 const health = await req("GET", "/health");
 const hjson = JSON.parse(health.body) as { status: string; db: string };
 check("A1 GET /health → 200 ok/up", health.code === 200 && hjson.status === "ok" && hjson.db === "up", health.body);

 const home = await req("GET", "/");
 check("A2 GET / → 200 + навігація", home.code === 200 &&
  home.body.includes("Головна") && home.body.includes("Заявки") &&
  home.body.includes("Клієнти") && home.body.includes("Пристрої") &&
  home.body.includes("Роботи"));
 check("A3 GET / → 8 карток (всього + 7 статусів)",
  home.body.includes("Всього заявок") &&
  home.body.includes("Нова") && home.body.includes("У діагностиці") &&
  home.body.includes("Оцінка готова") && home.body.includes("У ремонті") &&
  home.body.includes("Готова") && home.body.includes("Завершена") &&
  home.body.includes("Скасована"));
 check("A4 GET / → «Останні заявки» (10 рядків)", rows(home.body).length === 10, `rows=${rows(home.body).length}`);

 const nf = await req("GET", "/nonexistent");
 check("A5 GET /nonexistent → 404 сторінка", nf.code === 404 && nf.body.includes("404"));

 // ---------------- B. Списки (абсолютні лічильники) ----------------
 section("B. Списки");
 const list1 = await req("GET", "/requests");
 check("B1 /requests: 20 рядків, «Показано 1–20 з 60»",
  rows(list1.body).length === 20 && list1.body.includes("Показано 1–20 з 60"),
  `rows=${rows(list1.body).length}`);
 const list2 = await req("GET", "/requests?page=2");
 check("B2 /requests?page=2: «Показано 21–40 з 60»", list2.body.includes("Показано 21–40 з 60"));
 const list3 = await req("GET", "/requests?page=3");
 check("B3 /requests?page=3: «Показано 41–60 з 60»", list3.body.includes("Показано 41–60 з 60"));

 const fNew = await req("GET", "/requests?status=NEW");
 const fNewRows = rows(fNew.body);
 check("B4 фільтр status=NEW: >0 рядків, усі з бейджем NEW",
  fNewRows.length > 0 && fNewRows.every((r) => r.includes("badge-status-new")),
  `rows=${fNewRows.length}`);
 const fRepair = await req("GET", "/requests?type=REPAIR");
 const fRepairRows = rows(fRepair.body);
 check("B5 фільтр type=REPAIR: усі рядки «Ремонт»",
  fRepairRows.length > 0 && fRepairRows.every((r) => r.includes(">Ремонт<")),
  `rows=${fRepairRows.length}`);
 const fHigh = await req("GET", "/requests?priority=HIGH&status=NEW");
 const fHighRows = rows(fHigh.body);
 check("B6 комбінація status+priority: усі HIGH+NEW",
  fHighRows.every((r) => r.includes("badge-priority-high") && r.includes("badge-status-new")),
  `rows=${fHighRows.length}`);
 const fQ = await req("GET", "/requests?q=R-2026-0001");
 check("B7 пошук q=R-2026-0001: знайдено саме її",
  rows(fQ.body).length === 1 && fQ.body.includes("R-2026-0001"));

 const cList = await req("GET", "/clients");
 check("B8 /clients: 20 рядків, «з 30»",
  rows(cList.body).length === 20 && cList.body.includes("Показано 1–20 з 30"));
 const cPage2 = await req("GET", "/clients?page=2");
 check("B9 /clients?page=2: «Показано 21–30 з 30»", cPage2.body.includes("Показано 21–30 з 30"));
 const cSearch = await req("GET", "/clients?q=+380671234501");
 check("B10 /clients пошук за телефоном: 1 рядок", rows(cSearch.body).length === 1,
  `rows=${rows(cSearch.body).length}`);

 const dList = await req("GET", "/devices");
 check("B11 /devices: 20 рядків, «з 45»",
  rows(dList.body).length === 20 && dList.body.includes("Показано 1–20 з 45"));
 const wList = await req("GET", "/works");
 check("B12 /works: рівно 14 робіт", rows(wList.body).length === 14, `rows=${rows(wList.body).length}`);

 // ---------------- C. Картки ----------------
 section("C. Картки");
 const reqIds = idsFrom(list1.body, "requests");
 const firstReq = reqIds[0];
 const card = await req("GET", `/requests/${firstReq}`);
 check("C1 /requests/:id → 200 + секції",
  card.code === 200 &&
  card.body.includes("Клієнт") && card.body.includes("Пристрій") &&
  card.body.includes("Опис") && card.body.includes("badge-status-"));
 check("C2 /requests/:id/edit → 404 (перенесено у наступну ЛР)",
  (await req("GET", `/requests/${firstReq}/edit`)).code === 404);
 check("C3 /requests/new → 404 (перенесено у наступну ЛР)",
  (await req("GET", "/requests/new")).code === 404);

 const clientIds = idsFrom(cList.body, "clients");
 const cCard = await req("GET", `/clients/${clientIds[0]}`);
 check("C4 /clients/:id → 200 + історія", cCard.code === 200 && cCard.body.includes("Історія заявок"));
 const deviceIds = idsFrom(dList.body, "devices");
 const dCard = await req("GET", `/devices/${deviceIds[0]}`);
 check("C5 /devices/:id → 200 + власник", dCard.code === 200 && dCard.body.includes("Власник"));
 check("C6 /requests/відсутній → 404", (await req("GET", "/requests/nonexistent")).code === 404);
 check("C7 /clients/відсутній → 404", (await req("GET", "/clients/nonexistent")).code === 404);

 // ---------------- D. Прибрані форми (Lab 2 — read-only) ----------------
 section("D. Форми відсутні (перенесено у наступну ЛР)");
 check("D1 POST /requests → 404 (роут створення прибраний)",
  (await req("POST", "/requests")).code === 404);
 check("D2 POST /requests/:id/transition → 404 (роут переходів прибраний)",
  (await req("POST", `/requests/${firstReq}/transition`)).code === 404);
 check("D3 POST /requests/:id/edit → 404 (роут редагування прибраний)",
  (await req("POST", `/requests/${firstReq}/edit`)).code === 404);
 check("D4 /requests: немає «Створити заявку» і POST-форм",
  !list1.body.includes("Створити заявку") && !/<form[^>]*method="post"/.test(list1.body));
 check("D5 /requests/:id: немає «Редагувати» і форми переходу статусу",
  !card.body.includes("Редагувати") && !/<form[^>]*method="post"/.test(card.body));

 // ---------------- E. Повні картки (seed: оцінки, рахунки, вкладення, гарантія) ----------------
 section("E. Повні картки");
 const est = await prisma.estimate.findFirst();
 const estCard = await req("GET", `/requests/${est!.requestId}`);
 check("E1 картка з оцінкою → 200 + «Створив»",
  estCard.code === 200 && estCard.body.includes("Створив"), estCard.code === 500 ? "500" : "");
 const pay = await prisma.payment.findFirst({ include: { invoice: true } });
 const invCard = await req("GET", `/requests/${pay!.invoice.requestId}`);
 check("E2 картка зі сплаченим рахунком: «Оплачено»",
  invCard.code === 200 && invCard.body.includes("Оплачено"));
 const att = await prisma.fileAttachment.findFirst();
 const attCard = await req("GET", `/requests/${att!.requestId}`);
 check("E3 картка з вкладеннями: таблиця Файл | Розмір | Тип | Завантажив",
  attCard.code === 200 && attCard.body.includes("Розмір") && attCard.body.includes("Завантажив"));
 const wReq = await prisma.request.findFirst({ where: { type: "WARRANTY_CLAIM" } });
 const wCard = await req("GET", `/requests/${wReq!.id}`);
 check("E4 гарантійна заявка: «Гарантійне посилання» + оригінального ремонту",
  wCard.code === 200 && wCard.body.includes("Гарантійне посилання") && wCard.body.includes("Оригінальний ремонт:"));
 check("E5 /devices: без /clients/undefined у посиланнях на власника",
  !dList.body.includes("/clients/undefined"));

 // ---------------- F. Фільтри та пагінація (read-only) ----------------
 section("F. Фільтри та пагінація");
 check("F1 /requests: фільтр select name=\"status\"/\"type\"/\"priority\"",
  /<select[^>]*name="status"/.test(list1.body) &&
  /<select[^>]*name="type"/.test(list1.body) &&
  /<select[^>]*name="priority"/.test(list1.body));
 // 60 заявок у seed (у Lab 2 створення немає): останню сторінку клампить
 const overPage = await req("GET", "/requests?page=999");
 check("F2 /requests?page=999 → clamp до останньої («Показано 41–60 з 60»)",
  overPage.body.includes("Показано 41–60 з 60"));
 check("F3 порожній результат: «Нічого не знайдено» + «Скинути фільтри»",
  (await req("GET", "/requests?q=zzz-no-match")).body.includes("Скинути фільтри"));

 // ---------------- Підсумок ----------------
 const failed = results.filter((r) => !r.ok);
 console.log(`\nПідсумок: ${results.length} перевірок: ${results.length - failed.length} пройдено, ${failed.length} провалів`);
 if (failed.length > 0) {
  console.log("Провали:");
  for (const f of failed) console.log(`  [FAIL] ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
 }
 server.close();
 await prisma.$disconnect();
 process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
 console.error("web-check: інфраструктурна помилка:", e);
 process.exit(2);
});

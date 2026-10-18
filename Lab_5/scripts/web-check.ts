/**
 * web-check.ts — незалежні детерміновані веб-тести (Lab 2).
 *
 * Кожен запуск починається з чистого стану:
 *   0. ре-seed БД (seed ідемпотентний: очищує таблиці + детерміновані дані:
 *      60 заявок, 30 клієнтів, 45 пристроїв, 14 робіт);
 *   1. запуск createApp() на ефемерному порту (незалежно від dev-сервера);
 *   2. строгі асерції: каркас, списки (абсолютні лічильники), картки,
 *      створення (валідація/транзакція/номер), переходи статусів, редагування.
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

function req(method: string, path: string, form?: Record<string, string>): Promise<Resp> {
 const { promise, resolve, reject } = Promise.withResolvers<Resp>();
 const data = form ? new URLSearchParams(form).toString() : undefined;
 const r = http.request(
  {
   host: "127.0.0.1",
   port,
   path,
   method,
   headers: data
    ? { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(data) }
    : {},
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
 if (data) r.write(data);
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
 check("C2 /requests/:id/edit → 200 + форма",
  (await req("GET", `/requests/${firstReq}/edit`)).code === 200);
 check("C3 /requests/new → 200 + форма створення",
  (await req("GET", "/requests/new")).code === 200);

 const clientIds = idsFrom(cList.body, "clients");
 const cCard = await req("GET", `/clients/${clientIds[0]}`);
 check("C4 /clients/:id → 200 + історія", cCard.code === 200 && cCard.body.includes("Історія заявок"));
 const deviceIds = idsFrom(dList.body, "devices");
 const dCard = await req("GET", `/devices/${deviceIds[0]}`);
 check("C5 /devices/:id → 200 + власник", dCard.code === 200 && dCard.body.includes("Власник"));
 check("C6 /requests/відсутній → 404", (await req("GET", "/requests/nonexistent")).code === 404);
 check("C7 /clients/відсутній → 404", (await req("GET", "/clients/nonexistent")).code === 404);

 // ---------------- D. Створення ----------------
 section("D. Створення заявки");
 const badCreate = await req("POST", "/requests", {});
 check("D1 порожня форма → 400 + список помилок",
  badCreate.code === 400 &&
  badCreate.body.includes("Оберіть тип заявки") &&
  badCreate.body.includes("Вкажіть опис проблеми") &&
  badCreate.body.includes("Оберіть існуючого клієнта"));

 // клієнт = власник обраного пристрою (сервер перевіряє належність)
 const clientId = (dCard.body.match(/href="\/clients\/([a-z0-9]+)"/) ?? [])[1] ?? clientIds[0];
 const deviceId = deviceIds[0];
 const okCreate = await req("POST", "/requests", {
  clientMode: "existing", clientId,
  deviceMode: "existing", deviceId,
  type: "REPAIR", priority: "HIGH",
  description: "web-check: створення з існуючими",
 });
 const newReqId = (okCreate.location ?? "").split("/").pop() ?? "";
 check("D2 створення (існуючі) → 302 на картку",
  okCreate.code === 302 && okCreate.location === `/requests/${newReqId}` && newReqId.length > 0);
 const newCard = await req("GET", `/requests/${newReqId}`);
 check("D3 нова заявка: номер R-2026-0061 (max+1), статус NEW",
  newCard.body.includes("R-2026-0061") && newCard.body.includes("badge-status-new"),
  newCard.body.match(/R-\d{4}-\d{4}/)?.[0] ?? "номер не знайдено");

 const okCreate2 = await req("POST", "/requests", {
  clientMode: "new", newClientName: "WebCheck Клієнт", newClientPhone: "+380123456789",
  newClientEmail: "webcheck@example.com", newClientAddress: "м. Київ",
  deviceMode: "new", newDeviceBrand: "WebCheck", newDeviceModel: "WC-1",
  newDeviceType: "PC", newDeviceSerial: "WC-SN-1",
  type: "MAINTENANCE", priority: "LOW",
  description: "web-check: новий клієнт + новий пристрій",
 });
 const newReqId2 = (okCreate2.location ?? "").split("/").pop() ?? "";
 const newCard2 = await req("GET", `/requests/${newReqId2}`);
 check("D4 новий клієнт + новий пристрій → 302 + відображено",
  okCreate2.code === 302 && newCard2.body.includes("WebCheck Клієнт") && newCard2.body.includes("WebCheck WC-1"));
 const cFound = await req("GET", "/clients?q=WebCheck");
 check("D5 новий клієнт знаходиться пошуком", rows(cFound.body).length === 1);
 const dFound = await req("GET", "/devices?q=WebCheck");
 check("D6 новий пристрій знаходиться пошуком", rows(dFound.body).length === 1);

 const wBad = await req("POST", "/requests", {
  clientMode: "existing", clientId,
  deviceMode: "existing", deviceId,
  type: "WARRANTY_CLAIM", priority: "NORMAL",
  description: "web-check: гарантія без оригіналу",
 });
 check("D7 WARRANTY_CLAIM без оригіналу → 400",
  wBad.code === 400 && wBad.body.includes("оберіть оригінальний завершений ремонт"));
 const compList = await req("GET", "/requests?status=COMPLETED");
 const compIds = idsFrom(compList.body, "requests");
 if (compIds.length > 0) {
  const wOk = await req("POST", "/requests", {
   clientMode: "existing", clientId,
   deviceMode: "existing", deviceId,
   type: "WARRANTY_CLAIM", priority: "NORMAL",
   description: "web-check: гарантія з оригіналом",
   originalRequestId: compIds[0],
  });
  const wCard = await req("GET", `/requests/${(wOk.location ?? "").split("/").pop()}`);
  check("D8 WARRANTY_CLAIM з COMPLETED-оригіналом → 302 + посилання",
   wOk.code === 302 && wCard.body.includes(`/requests/${compIds[0]}`));
 } else {
  check("D8 WARRANTY_CLAIM з оригіналом", false, "у seed немає COMPLETED-заявок");
 }

 // ---------------- E. Переходи статусів + редагування ----------------
 section("E. Переходи та редагування");
 const t1 = await req("POST", `/requests/${newReqId}/transition`, { status: "IN_DIAGNOSTICS" });
 const after1 = await req("GET", `/requests/${newReqId}`);
 check("E1 NEW → IN_DIAGNOSTICS: 302 + статус змінено",
  t1.code === 302 && after1.body.includes("badge-status-in_diagnostics") &&
  after1.body.includes("У діагностиці"));

 const t2 = await req("POST", `/requests/${newReqId}/transition`, { status: "COMPLETED" });
 const after2 = await req("GET", `/requests/${newReqId}`);
 check("E2 заборонений IN_DIAGNOSTICS → COMPLETED: ?error=transition, статус не змінився",
  t2.code === 302 && (t2.location ?? "").includes("error=transition") &&
  after2.body.includes("badge-status-in_diagnostics"));

 const t3 = await req("POST", `/requests/${newReqId}/transition`, { status: "ESTIMATE_READY" });
 const after3 = await req("GET", `/requests/${newReqId}`);
 check("E3 IN_DIAGNOSTICS → ESTIMATE_READY: 302 + «Оцінка готова»",
  t3.code === 302 && after3.body.includes("badge-status-estimate_ready"));

 const eBad = await req("POST", `/requests/${newReqId}/edit`, { description: "" });
 check("E4 редагування без опису/клієнта → 400",
  eBad.code === 400 && eBad.body.includes("Вкажіть опис"));
 const eOk = await req("POST", `/requests/${newReqId}/edit`, {
  description: "web-check: оновлений опис",
  priority: "URGENT",
  clientId, deviceId,
 });
 const after4 = await req("GET", `/requests/${newReqId}`);
 check("E5 редагування: 302 + опис/пріоритет змінено, статус зберігся",
  eOk.code === 302 && after4.body.includes("web-check: оновлений опис") &&
  after4.body.includes("badge-priority-urgent") &&
  after4.body.includes("badge-status-estimate_ready"));

 // ---------------- F. Форми, картки з оцінкою, межі (сліпі зони MED-6) ----------------
 section("F. Форми та повні картки");
 const newForm = await req("GET", "/requests/new");
 check("F1 форма: <form method=\"post\" action=\"/requests\"> (не class=\"method action\")",
  /<form[^>]*method="post"[^>]*action="\/requests"/.test(newForm.body) &&
  !newForm.body.includes('class="method action"'));
 check("F2 форма: name-атрибути select/textarea/input (не class=\"name\")",
  /<select[^>]*name="type"/.test(newForm.body) &&
  /<select[^>]*name="priority"/.test(newForm.body) &&
  /<textarea[^>]*name="description"/.test(newForm.body) &&
  /<select[^>]*name="clientId"/.test(newForm.body) &&
  /<select[^>]*name="deviceId"/.test(newForm.body) &&
  /<select[^>]*name="technicianId"/.test(newForm.body) &&
  /<input[^>]*type="date"[^>]*name="newDevicePurchasedAt"/.test(newForm.body) &&
  !newForm.body.includes('class="name"'));

 const filterForm = await req("GET", "/requests");
 check("F3 /requests: фільтр select name=\"status\"/\"type\"/\"priority\"",
  /<select[^>]*name="status"/.test(filterForm.body) &&
  /<select[^>]*name="type"/.test(filterForm.body) &&
  /<select[^>]*name="priority"/.test(filterForm.body));

 // до цього моменту створено 3 нові заявки (D2, D4, D8): 60 + 3 = 63
 const overPage = await req("GET", "/requests?page=999");
 check("F4 /requests?page=999 → clamp до останньої («Показано 61–63 з 63»)",
  overPage.body.includes("Показано 61–63 з 63"));

 // seed гарантує наявність (інваріанти); `!` — свідомо
 const est = (await prisma.estimate.findFirst())!;
 const estCard = await req("GET", `/requests/${est.requestId}`);
 check("F5 картка заявки з оцінкою → 200 + «Створив:» (не 500)",
  estCard.code === 200 && estCard.body.includes("Створив:"));

 const pay = (await prisma.payment.findFirst({ include: { invoice: true } }))!;
 const invCard = await req("GET", `/requests/${pay.invoice.requestId}`);
 check("F6 картка зі сплаченим рахунком: «Оплачено:»",
  invCard.code === 200 && invCard.body.includes("Оплачено:"));

 const att = (await prisma.fileAttachment.findFirst())!;
 const attCard = await req("GET", `/requests/${att.requestId}`);
 check("F7 картка з вкладенням: таблиця «Файл | Розмір | Тип | Завантажив»",
  attCard.code === 200 && attCard.body.includes(">Тип</th>") &&
  attCard.body.includes(">Завантажив</th>"));

 const wreq = (await prisma.request.findFirst({ where: { type: "WARRANTY_CLAIM" } }))!;
 const wCard = await req("GET", `/requests/${wreq.id}`);
 check("F8 гарантійна заявка: «статус:» оригінального ремонту",
  wCard.code === 200 && wCard.body.includes("статус:"));

 const devList = await req("GET", "/devices");
 check("F9 /devices: без «/clients/undefined» у посиланнях на власника",
  !devList.body.includes("/clients/undefined"));

 const errRender = await req("POST", "/requests", {
  type: "REPAIR", priority: "NORMAL", description: "web-check: re-render",
  clientMode: "new", newClientPhone: "+380111111111",
  deviceMode: "existing", deviceId,
 });
 check("F10 re-render з помилками: radio «Новий клієнт» checked + текст помилки",
  errRender.code === 400 &&
  /<input[^>]*name="clientMode"[^>]*value="new"[^>]*checked/.test(errRender.body) &&
  errRender.body.includes("Новий клієнт: оберіть «Новий пристрій»"));

 const okCreate3 = await req("POST", "/requests", {
  clientMode: "existing", clientId,
  deviceMode: "new",
  newDeviceBrand: "Purchased", newDeviceModel: "P-1",
  newDeviceType: "LAPTOP",
  newDevicePurchasedAt: "2025-12-01",
  type: "REPAIR", priority: "NORMAL",
  description: "web-check: дата покупки",
 });
 const newReqId3 = (okCreate3.location ?? "").split("/").pop() ?? "";
 const newCard3 = await req("GET", `/requests/${newReqId3}`);
 check("F11 новий пристрій з датою покупки: «куплений: 01.12.2025»",
  okCreate3.code === 302 && newCard3.body.includes("куплений: 01.12.2025"));

 // ---------------- Підсумок ----------------
 const failed = results.filter((r) => !r.ok);
 console.log(`\nПідсумок: ${results.length - failed.length}/${results.length} пройдено`);
 if (failed.length > 0) {
  console.log("Провали:");
  for (const f of failed) console.log(`  ❌ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
 }

 server.close();
 await prisma.$disconnect();
 process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
 console.error("web-check: інфраструктурна помилка:", e);
 process.exit(2);
});

# Agent.md — Lab 1 · Сервіс ремонту та обслуговування комп'ютерної техніки

> Керівництво для AI-агентів, що працюють у цьому репозиторії.
> Станом на **2026-09-14**. Мова проєкту — українська (комментарі, доки, демо-дані).

## 1. Що це за проєкт

Університетська лабораторна робота (курс «Веб-розробка»): **реляційна модель даних**
для сервісу ремонту та обслуговування комп'ютерної техніки + мінімум експлуатаційного коду
(Express-сервер із `GET /health`, seed-наповнення, перевірка бізнес-інваріантів).

Домен: клієнти, їхні пристрої, заявки на ремонт/обслуговування/гарантійне обслуговування,
діагностика, роботи, запчастини, оцінки, рахунки, оплати, гарантія, коментарі, вкладення файлів.

**Мета лаби — модель даних, а не повний продукт.** API наміreno мінімальний (тільки `/health`).
Не дописуйте CRUD-ендпоінти, якщо цього явно не попросили.

## 2. Tech stack (версії ЗАКРІПЛЕНІ жорстко — не піднімати без явної потреби)

| Компонент | Версія | Примітка |
|---|---|---|
| Node.js | **24 LTS** | `engines: >=24`, зафіксовано в `.nvmrc` |
| Express | **5.2.1** | останній стабільний major (6 не випущено) |
| Prisma ORM | **7.10.0** | ⚠️ npm-тег `latest` на CLI зараз → RC 8, тому версія закріплена вручну |
| @prisma/client | 7.10.0 | |
| @prisma/adapter-pg | 7.10.0 | driver adapter (Prisma 7 працює без старого binary engine) |
| TypeScript | **7.0.2** | fallback 5.9.x, якщо проблеми сумісності |
| tsx | 4.23.13 | запуск TS без окремої збірки |
| PostgreSQL | **18** | через Docker, **порт 5433** (не 5432) |
| dotenv | 17.4.2 | |

## 3. Швидкий старт

**Windows, one-click:** подвійний клік **`start.bat`** — перевіряє Node/Docker, створює `.env`
з `.env.example`, `npm ci`, піднімає Postgres, міграції, seed, запускає сервер.

**Ручна:**
```bash
cp .env.example .env          # або створить start.bat
docker compose up -d          # PostgreSQL 18 на localhost:5433
npm ci                        # залежності (за package-lock.json)
npx prisma migrate dev        # застосувати міграції
npm run seed                  # демо-дані (60 заявок)
npm start                     # сервер → http://localhost:3000/health
npm run check                 # звірка інваріантів моделі (exit 1 при порушенні)
```

Зупинити БД — `stop.bat`. Видалити БД з даними — `docker compose down -v`.

## 4. Команди (з `package.json`)

| Команда | Призначення |
|---|---|
| `npm run dev` | сервер у режимі watch (`tsx watch src/index.ts`) |
| `npm start` | запустити сервер (`tsx src/index.ts`) |
| `npm run seed` | наситити БД демо-даними (`prisma/seed.ts`) |
| `npm run check` | перевірити інваріанти І1–І10 (`scripts/check-invariants.ts`) |
| `npm run prisma:studio` | Prisma Studio (GUI до БД) |
| `npx prisma migrate dev` | створити / застосувати міграції |

## 5. Структура проєкту

```
Lab_1/
├── Agent.md                # цей файл — контекст для AI-агентів
├── README.md               # огляд, tech stack, quick start
├── PLAN.md                 # step-by-step план реалізації
├── .env                    # локально (у .gitignore): DATABASE_URL, PORT
├── .env.example            # шаблон .env
├── docker-compose.yml      # PostgreSQL 18 (host-порт 5433)
├── package.json            # жорстко закріплені версії + скрипти
├── prisma7.config.ts       # ⚠️ конфіг Prisma 7 (schema, migrations, seed, datasource.url)
├── tsconfig.json
├── start.bat / stop.bat    # one-click launch / stop (Windows)
├── .nvmrc / .gitignore
├── prisma/
│   ├── schema.prisma       # 9 enum + 15 сутностей (ДЖЕРЕЛО ІСТИНИ моделі)
│   ├── migrations/         # SQL-міграції (20260914092944_init)
│   └── seed.ts             # насичення реалістичними даними
├── src/
│   ├── index.ts            # Express: GET /health
│   └── prisma.ts           # singleton PrismaClient (driver adapter @prisma/adapter-pg)
├── scripts/
│   └── check-invariants.ts # перевірка бізнес-інваріантів І1–І10
├── docs/
│   ├── DATA_MODEL.md       # ПОВНА спека моделі (сутності, поля, інваріанти, seed)
│   ├── ER.md               # ER-діаграма (mermaid)
│   ├── DECISIONS.md        # журнал проєктних рішень (чому так)
│   └── TEST_PLAN.md        # план верифікації
├── generated/prisma/       # ⚠️ згенерований Prisma-клієнт (у .gitignore, відтворюваний)
└── node_modules/           # залежності (у .gitignore)
```

## 6. Модель даних — 15 сутностей, 9 enum

> Джерело істини: `prisma/schema.prisma`. Повна спека полів: `docs/DATA_MODEL.md`.

### Enums (9)
- `Role`: ADMIN, MANAGER, TECHNICIAN
- `DeviceType`: PC, LAPTOP, MONITOR, PHONE, TABLET, PRINTER, OTHER
- `RequestStatus`: NEW, IN_DIAGNOSTICS, ESTIMATE_READY, IN_REPAIR, READY, COMPLETED, CANCELED
- `RequestType`: REPAIR, MAINTENANCE, WARRANTY_CLAIM
- `Priority`: LOW, NORMAL, HIGH, URGENT
- `WorkStatus`: PENDING, IN_PROGRESS, DONE
- `EstimateStatus`: DRAFT, APPROVED, REJECTED
- `InvoiceStatus`: UNPAID, PARTIAL, PAID
- `PaymentMethod`: CASH, CARD, BANK_TRANSFER

### Сутності (15)
| Сутність | Роль | Ключові поля |
|---|---|---|
| `User` | співробітник (створює/виконує) | name, email (uniq), role, password |
| `Client` | клієнт (особа/компанія), **без акаунта** | name, phone, email?, address?, `deletedAt?` |
| `Device` | конкретний прилад клієнта (історія 1—N заявок) | type, brand, model, serialNumber?, ownerId, `deletedAt?` |
| `Request` | **центр моделі** — заявка | number (uniq, `R-YYYY-NNNN`), type, status, priority, clientId, deviceId, originalRequestId?, createdById, assignedToId?, `deletedAt?` |
| `Diagnostics` | діагностика (1—1 із заявкою) | requestId (uniq), technicianId?, findings, cost |
| `WorkCatalog` | прайс-лист робіт | name (uniq), basePrice, baseHours |
| `RequestWork` | робота в заявці (снапшот) | requestId, catalogId?, name, cost, hours, technicianId?, status |
| `Part` | каталог запчастин (**без складу**) | name, sku?, price |
| `RequestPart` | запчастини в заявці (снапшот ціни) | requestId, partId, quantity, unitPrice; `@@unique([requestId, partId])` |
| `Estimate` | оцінка (1—1 із заявкою) | requestId (uniq), status, totalWorks, totalParts, total, createdById, approvedAt? |
| `Invoice` | рахунок (1—1 із заявкою) | requestId (uniq), estimateId?, total, discount, finalTotal, status, issueDate, dueDate? |
| `Payment` | оплата (історичний запис) | invoiceId, amount, method, paidAt, note? |
| `Warranty` | гарантія на ремонт (1—1 із заявкою) | requestId (uniq), startDate, periodDays, endDate |
| `Comment` | коментар до заявки | requestId, userId, text, `internal?` |
| `FileAttachment` | вкладення (фото дефекту тощо) | requestId, userId, filename, path, mimeType?, size? |

### Ключові зв'язки (кардинальність)
- `Client` 1—N `Device` (owner, `onDelete: Restrict`)
- `Client` 1—N `Request`
- `Device` 1—N `Request`
- `User` 1—N `Request` (createdBy) та `User` 1—N `Request` (assignedTo, опц.)
- `Request` 1—0..1 `Diagnostics`, 1—0..1 `Estimate`, 1—0..1 `Invoice`, 1—0..1 `Warranty`
- `Request` 1—N `RequestWork`, 1—N `RequestPart`, 1—N `Comment`, 1—N `FileAttachment`
- `Request` 1—N `Request` (self: `originalRequest` ↔ `warrantyClaims`, для WARRANTY_CLAIM)
- `WorkCatalog` 1—N `RequestWork`; `Part` 1—N `RequestPart`
- `Estimate` 1—0..1 `Invoice`; `Invoice` 1—N `Payment`

### Ключові патерни
- **Snapshot:** `RequestWork.name/cost` та `RequestPart.unitPrice` — фіксовані значення на момент заявки; `catalogId`/`partId` — опційне посилання на каталог.
- **Computed totals:** `Estimate.total = totalWorks + totalParts`; `Invoice.finalTotal = total − discount`. Суми **раховуються з позицій**, не «від руки».
- **Soft delete:** `deletedAt DateTime?` на `Client`, `Device`, `Request`. Активні записи — `deletedAt = null`.
- **Гарантійне сам-посилання:** `Request.type = WARRANTY_CLAIM` → `originalRequestId` на завершений REPAIR/MAINTENANCE.

## 7. Бізнес-інваріанти (І1–І10) — перевірка `npm run check`

| # | Інваріант |
|---|---|
| І1 | `Estimate.total = totalWorks + totalParts` |
| І2 | `Estimate.totalWorks = Σ RequestWork.cost` |
| І3 | `Estimate.totalParts = Σ (RequestPart.quantity × unitPrice)` |
| І4 | `Invoice.finalTotal = total − discount` |
| І5 | `Invoice.status` узгоджений із сумою `Payment` (UNPAID/PARTIAL/PAID) |
| І6 | `Warranty.endDate = startDate + periodDays` |
| І7 | `WARRANTY_CLAIM ⇒ originalRequestId ≠ null` |
| І8 | `RequestPart.quantity ≥ 1` |
| І9 | `discount ≥ 0`, `finalTotal ≥ 0`, `Payment.amount > 0` |
| І10 | активні записи: `deletedAt = null`; `Request.number` унікальний |

При порушенні — `exit code 1`.

## 8. Конвенції

- **Гроші** — `Decimal @db.Decimal(10, 2)` (грн, 2 знаки). Ніяких `Float`/`Int` для сум.
- **ID** — `String @id @default(cuid())`.
- **Audit** — `createdAt @default(now())`, `updatedAt @updatedAt` на більшості сутностей.
- **Статуси** — нативні enum PostgreSQL (не String + валідація).
- **ESM** — `"type": "module"`; усі локальні імporti **з розширенням `.js`** (навіть для `.ts`): `./prisma.js`, `../generated/prisma/client.js`.
- **З'єднання з БД** — singleton у `src/prisma.ts` через driver adapter:
  `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`.

## 9. Пастки / Gotchas

- **Порт БД — 5433, не 5432.** 5432 часто зайнятий локальною PostgreSQL. `DATABASE_URL` вказує на `:5433`, база `lab1_service`.
- **Конфіг Prisma — `prisma7.config.ts`** (НЕ стандартний `prisma.config.ts`). У `schema.prisma` у блоці `datasource` **немає** `url` — з'єднання бере `prisma7.config.ts`, який читає `DATABASE_URL` з `.env`. Якщо Prisma CLI «не бачить» БД — перевірте, що `.env` існує та що конфіг завантажується.
- **Згенерований клієнт — `generated/prisma`** (custom `output`, у `.gitignore`). Імпорт: `import { PrismaClient } from "../generated/prisma/client.js"`. Після зміни схеми клієнт перегенерується при `prisma migrate dev`/`prisma generate`.
- **Версія Prisma закріплена** (7.10.0): npm-тег `latest` на CLI зараз вказує на RC 8 — не робіть `npm i prisma@latest`.
- **Prisma 7 = driver adapter**, не старий binary engine: з'єднання завжди через `@prisma/adapter-pg`.
- **Seed ідемпотентний**: спочатку чистить усі таблиці, потім 15 «ручних» + 45 згенерованих (детермінований PRNG mulberry32, seed=20260914) → повторний запуск дає однаковий набір (60 заявок, 30 клієнтів, 45 пристроїв).
- **WARRANTY_CLAIM** посилається **лише** на завершений REPAIR/MAINTENANCE, ніколи на іншу warranty-заявку (інакше порушується І7 + семантика).

## 10. Як змінити модель (workflow)

1. Правите **`prisma/schema.prisma`** (єдине джерело істини).
2. `npx prisma migrate dev` — створює SQL-міграцію та перегенерує клієнт у `generated/prisma`.
3. Оновлюєте **`docs/DATA_MODEL.md`** (спека) та, якщо змінили ER, **`docs/ER.md`**.
4. За потреби адаптуєте **`prisma/seed.ts`** та **`scripts/check-invariants.ts`** (нові поля/зв'язки/інваріанти).
5. Проганяєте: `npm run seed && npm run check` → має бути **10/10** та ідемпотентний seed.

## 11. Чекалист «готово»

- [ ] `npm run check` → `Усі інваріанти виконані (10/10)`
- [ ] `npm run seed` → ідемпотентний (повторний запуск → ті самі 60/30/45)
- [ ] `npm start` → `GET /health` повертає `200 { status: "ok", db: "up" }`
- [ ] `schema.prisma` ↔ `docs/DATA_MODEL.md` ↔ `prisma/seed.ts` узгоджені

## 12. Документація

| Документ | Зміст |
|---|---|
| [README.md](./README.md) | огляд, tech stack, quick start |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | **повна спека**: 15 сутностей, 9 enum, поля, зв'язки, статусна машина, інваріанти, seed-спека |
| [docs/ER.md](./docs/ER.md) | ER-діаграма (mermaid) + зв'язки з кардинальністю |
| [docs/DECISIONS.md](./docs/DECISIONS.md) | журнал проєктних рішень (чому саме так) |
| [docs/TEST_PLAN.md](./docs/TEST_PLAN.md) | чек-лист верифікації + тест переносності на інший ПК |
| [PLAN.md](./PLAN.md) | step-by-step план реалізації |

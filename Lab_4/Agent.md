# Agent.md — Lab 2–3 · Сервіс ремонту та обслуговування комп'ютерної техніки

> Керівництво для AI-агентів, що працюють у цьому репозиторії.
> Станом на **2026-09-21**. Мова проєкту — українська (комментарі, доки, демо-дані, UI).

## 1. Що це за проєкт

Університетська лабораторна робота (курс «Веб-розробка»).

- **Lab 1:** реляційна модель даних сервісу ремонту та обслуговування
  комп'ютерної техніки (15 сутностей, 9 enum, seed, інваріанти І1–І10).
- **Lab 2:** **контролери та представлення** — SSR-додаток на Express + Pug:
  13 сторінок (дашборд, заявки, клієнти, пристрої, каталог робіт, 404/500).
- **Lab 3 (теперішній фокус):** **форми та серверна валідація** — CRUD довідників
  (клієнти, пристрої, роботи) + каталог запчастин `/parts`; форми без `required`,
  усі правила валідації в контролерах. Детальна спека: `docs/PAGES.md` (розділ Lab 3).

Домен: клієнти, їхні пристрої, заявки на ремонт/обслуговування/гарантійне
звернення, діагностика, роботи, запчастини, оцінки, рахунки, оплати, гарантія,
коментарі, вкладення файлів.

**Межі Lab 2 (рішення D20–D21):** автентифікації немає. **Lab 3 (D30–D34):**
CRUD довідників (клієнти, пристрої, роботи, запчастини); **D42:** інтерактивні
секції картки заявки — діагностика, оцінка (затвердження/відхилення), рахунок
видати + платежі, гарантія, коментарі, вкладення-файли (`uploads/`). Не дописуйте
CRUD за межами `docs/PAGES.md`, якщо явно не попросили.

## 2. Tech stack (версії ЗАКРІПЛЕНІ жорстко — не піднімати без явної потреби)

| Компонент | Версія | Примітка |
|---|---|---|
| Node.js | **24 LTS** | `engines: >=24`, зафіксовано в `.nvmrc` |
| Express | **5.2.1** | останній стабільний major (6 не випущено) |
| **Pug** | **3.0.4** | шаблонізатор (Lab 2) |
| Prisma ORM | **7.10.0** | ⚠️ npm-тег `latest` на CLI зараз → RC 8, версія закріплена вручну |
| @prisma/client | 7.10.0 | |
| @prisma/adapter-pg | 7.10.0 | driver adapter (Prisma 7 без старого binary engine) |
| TypeScript | **7.0.2** | fallback 5.9.x |
| tsx | 4.23.13 | запуск TS без окремої збірки |
| PostgreSQL | **18** | через Docker, **порт 5433** (не 5432) |
| dotenv | 17.4.2 | |

## 3. Швидкий старт

**Windows, one-click:** подвійний клік **`start.bat`** — перевіряє Docker,
збирає образ додатка, піднімає PostgreSQL + додаток (`docker compose up --build`),
міграції + seed виконуються в контейнері → http://localhost:3000.

**Інший ПК:** потрібен лише Docker Desktop — `docker compose up -d --build`
(Node.js не встановлюється; образ: `Dockerfile`, база `node:24-bookworm-slim`).

**Ручна (розробка на хості, Node 24):**
```bash
cp .env.example .env          # або створить start.bat
docker compose up -d db       # PostgreSQL 18 на localhost:5433
npm ci
npx prisma migrate dev
npm run seed                  # демо-дані (60 заявок)
npm start                     # сервер → http://localhost:3000
npm run check                 # інваріанти І1–І10 (exit 1 при порушенні)
```

Зупинити все — `stop.bat`. Видалити БД з даними — `docker compose down -v`.

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
Lab_2/
├── Agent.md                # цей файл — контекст для AI-агентів
├── README.md               # огляд, tech stack, сторінки, quick start
├── PLAN.md                 # step-by-step план Lab 2 (фази, кроки, критерії)
├── .env                    # локально (у .gitignore): DATABASE_URL, PORT
├── .env.example
├── docker-compose.yml      # PostgreSQL 18 (host-порт 5433) + app (3000)
├── Dockerfile              # образ додатка (node:24-bookworm-slim)
├── .dockerignore
├── package.json            # жорстко закріплені версії + скрипти
├── prisma7.config.ts       # ⚠️ конфіг Prisma 7 (schema, migrations, seed, datasource.url)
├── tsconfig.json
├── start.bat / stop.bat    # one-click launch / stop (Windows)
├── .nvmrc / .gitignore
├── prisma/
│   ├── schema.prisma       # 9 enum + 15 сутностей (ДЖЕРЕЛО ІСТИНИ моделі)
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── index.ts            # тонкий шар: view engine (pug), static, urlencoded,
│   │                       #   /health, mount роутерів, 404/500
│   ├── prisma.ts           # singleton PrismaClient (driver adapter)
├── controllers/        # dashboard.ts, requests.ts, clients.ts, devices.ts, works.ts, parts.ts
│   ├── routes/             # express.Router() на модуль (ти самі назви)
│   └── lib/                # labels.ts (UA-словники enum), format.ts (UAH/дати),
│                           #   transitions.ts (машина станів), validate.ts (Lab 3: хелпери валідації)
├── views/                  # Pug-шаблони (конвенція Express: корінь проєкту)
│   ├── layout.pug          # html/head/css + block content
│   ├── partials/           # header (навігація), footer, flash (помилки)
│   ├── dashboard/index.pug
│   ├── requests/{index,show,create,edit}.pug
│   ├── clients/{index,show}.pug
│   ├── devices/{index,show}.pug
│   ├── works/index.pug
│   └── errors/{404,500}.pug
├── public/css/style.css    # власні стилі, БЕЗ CDN
├── scripts/
│   └── check-invariants.ts
├── docs/
│   ├── DATA_MODEL.md       # ПОВНА спека моделі (Lab 1)
│   ├── PAGES.md            # ПОВНА спека сторінок і контролерів (Lab 2)
│   ├── ER.md
│   ├── DECISIONS.md        # D1–D18 (Lab 1), D19–D29 (Lab 2)
│   └── TEST_PLAN.md        # чек-листи Lab 1 + Lab 2
├── generated/prisma/       # ⚠️ згенерований Prisma-клієнт (у .gitignore)
└── node_modules/
```

## 6. Модель даних — 15 сутностей, 9 enum

> Джерело істини: `prisma/schema.prisma`. Повна спека полів: `docs/DATA_MODEL.md`.
> У Lab 2 модель **не змінюється**.

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

### Статусна машина (використовується в `src/lib/transitions.ts`)

```
NEW → IN_DIAGNOSTICS → ESTIMATE_READY → IN_REPAIR → READY → COMPLETED
(з будь-якого некінцевого стану можна → CANCELED; COMPLETED/CANCELED — кінцеві)
```

### Ключові патерни
- **Snapshot:** `RequestWork.name/cost`, `RequestPart.unitPrice` — фіксовані значення на момент заявки.
- **Computed totals:** суми рахуються з позицій, не «від руки» (інваріанти І1–І4).
- **Soft delete:** `deletedAt` на `Client`, `Device`, `Request`; веб-шар показує тільки `deletedAt = null`.
- **Гарантія:** `WARRANTY_CLAIM ⇒ originalRequestId` на COMPLETED-заявку (інваріант І7).
- **Номер заявки:** `R-YYYY-NNNN` (4 цифри), max+1 за поточний рік — формат seed (`R-2026-0001`).

## 7. Бізнес-інваріанти (І1–І10) — перевірка `npm run check`

| # | Інваріант |
|---|---|
| І1 | `Estimate.total = totalWorks + totalParts` |
| І2 | `Estimate.totalWorks = Σ RequestWork.cost` |
| І3 | `Estimate.totalParts = Σ (RequestPart.quantity × unitPrice)` |
| І4 | `Invoice.finalTotal = total − discount` |
| І5 | `Invoice.status` узгоджений із сумою `Payment` |
| І6 | `Warranty.endDate = startDate + periodDays` |
| І7 | `WARRANTY_CLAIM ⇒ originalRequestId ≠ null` |
| І8 | `RequestPart.quantity ≥ 1` |
| І9 | `discount ≥ 0`, `finalTotal ≥ 0`, `Payment.amount > 0` |
| І10 | активні записи: `deletedAt = null`; `Request.number` унікальний |

**Веб-шар Lab 2 не повинен порушувати інваріанти:** створення/редагування
заявок торкаються тільки `Request` (+ нові `Client`/`Device`); грошові сутності
не змінюються. Після змін — `npm run check` має бути 10/10.

## 8. Конвенції

**Lab 1 (ядро):**
- Гроші — `Decimal @db.Decimal(10,2)` (UAH); ID — `cuid()`; audit — `createdAt`/`updatedAt`;
  статуси — нативні enum PostgreSQL.
- **ESM:** усі локальні імporti **з розширенням `.js`** (навіть для `.ts`).
- З'єднання з БД — singleton `src/prisma.ts` через `@prisma/adapter-pg`.

**Lab 2 (веб-шар):**
- **Шаровість:** `routes/` (декларація маршрутів) → `controllers/` (логіка + Prisma)
  → `views/` (тільки рендер). Бізнес-логіки в шаблонах бути не має.
- **PRG:** кожен POST → `res.redirect(...)`; форми — `method="post"` + `action`.
- **Помилки форм:** зібрати ВСІ помилки → `res.status(400).render(view, { errors, values, ... })`.
- **Помилки переходів статусів:** `redirect('/requests/:id?error=transition')` → банер у картці.
- **UA-назви enum** — тільки через `src/lib/labels.ts` (raw-значення в UI не показуються).
- **Форматування** — тільки через `src/lib/format.ts` (`uah`, `dateOnly`, `dateTime`, `bytes`);
  Decimal перед рендером завжди приводити (Pug не друкує Decimal «красиво»).
- **Пагінація:** 20/стор., `?page=N`, фільтри зберігаються в URL.
- **Автор нових заявок:** `createdById` = User з роллю ADMIN (автентифікації немає).
- **CSS:** один файл `public/css/style.css`, без CDN/збірки.
- **Версії:** точні pin без `^`/`~` (як у всьому проєкті).

**Lab 3 (форми та валідація):**
- **Без `required`:** жодної атрибута `required` у шаблонах — валідація тільки
  на сервері (інакше браузер не дає відправити невалідну форму і серверна
  логіка не демонструється).
- **Помилки:** зібрати ВСІ → `400` + той самий view з `errors` та `values`
  (старі значення). Тексти помилок — UA, точні рядки зафіксовані в
  `docs/PAGES.md` (L3-1…L3-4) і в `scripts/lab3-e2e.sh`.
- **Хелпери — `src/lib/validate.ts`:** `clean`, `toNumber` (крапка або кома),
  `tooLong`, `isEmail`, `isPhone`, `isUaPhone`, `maxDecimals`, `MIN_DATE`, `parseDateOnly`, `isUniqueViolation`.
- **Унікальність:** email (клієнти), назва (роботи), SKU (запчастини) —
  `findFirst` з self-exclusion `id: { not: id }` у edit + fallback
  `isUniqueViolation` (P2002) у try/catch.
- **Redirects:** create/edit клієнта/пристрою → картка `/:id`; роботи/запчастини
  → список (карток немає).
- **Date-only:** `purchasedAt` — `parseDateOnly` → **UTC-опівночі** (D34);
  рендер у формі — `toISOString().slice(0, 10)`.

## 9. Пастки / Gotchas

- **Порт БД — 5433, не 5432.** `DATABASE_URL` → `:5433`, база `lab1_service`.
- **Конфіг Prisma — `prisma7.config.ts`** (НЕ `prisma.config.ts`); в `schema.prisma`
  у `datasource` немає `url`.
- **Згенерований клієнт — `generated/prisma`** (у .gitignore). Імпорт:
  `import { PrismaClient } from "../generated/prisma/client.js"`.
- **Prisma 7 = driver adapter** (`@prisma/adapter-pg`), не binary engine.
- **Версії pin:** `npm i pug@latest` НЕ робити — тільки точна версія (pug 3.0.4).
- **Pug:** compile-time помилки (вкладеність, пробіли, `extends`/`block`);
  після зміни `views/` сервер (tsx watch) підхоплює на лету, але при ручному
  `npm start` — рестарт. У Pug `{{ }}` не існує — тільки `#{}`/`!{}`.
- **Decimal у Pug:** перед рендером — `String()`/`format.uah()`, інакше на сторінці
  буде `[object Object]`-подібний вивід.
- **`groupBy` + enum** у Prisma 7: якщо типізація капризує — fallback на окремі `count`.
- **Seed ідемпотентний** (PRNG mulberry32, seed=20260914): повторний запуск → ті самі
  60 заявок / 30 клієнтів / 45 пристроїв.
- **WARRANTY_CLAIM** — тільки на COMPLETED REPAIR/MAINTENANCE, ніколи на іншу warranty.
- **Docker:** у compose-мережі `DATABASE_URL` додатка → `db:5432` (не `localhost:5433`);
  `.env` в образ НЕ потрапляє (`.dockerignore`), згенерований клієнт збирається
  в образі (`prisma generate`), бо `generated/` у .gitignore.
- **Docker Hub може бути недоступний** (registry-1.docker.io блокується на деяких
  мережах): тоді базовий образ тягнеться з дзеркала —
  `docker pull mirror.gcr.io/library/node:24-bookworm-slim` і
  `docker tag ... node:24-bookworm-slim`.
- **Date-only ≠ datetime:** зберігати тільки як UTC-опівночі (`parseDateOnly`);
  локальне опівночі дає зсув на день назад після `toISOString()` у UTC+ (D34).
- **Pug друкує сторінку одним рядком** (без pretty-print): парсинг HTML у
  скриптах — `grep -o` по зразках, НЕ `grep -c` по рядках.
- **curl `%{redirect_url}`** без `-L` — порожній; для 302 парсити заголовок
  `Location` (`scripts/lab3-e2e.sh`: функція `postloc`).

## 10. Як змінити модель (workflow)

1. Правите **`prisma/schema.prisma`** (єдине джерело істини).
2. `npx prisma migrate dev` — SQL-міграція + перегенерація клієнта.
3. Оновлюєте **`docs/DATA_MODEL.md`** та, за потреби, **`docs/ER.md`**.
4. Адаптуєте **`prisma/seed.ts`** та **`scripts/check-invariants.ts`**.
5. `npm run seed && npm run check` → 10/10.
6. Якщо зміни торкаються полів, що показуються в UI — оновити `docs/PAGES.md`
   та відповідні контролери/шаблони.

## 11. Чекалист «готово»

**Lab 1 (регресія):**
- [x] `npm run check` → `Усі інваріанти виконані (10/10)`
- [x] `npm run seed` → ідемпотентний (60/30/45)
- [x] `GET /health` → `200 { status: "ok", db: "up" }`

**Lab 2:**
- [x] Усі сторінки з `docs/PAGES.md` рендеряться (перелік у README)
- [x] Фільтри/пошук/пагінація списку заявок працюють
- [x] Створення/редагування/переходи статусів — за `docs/TEST_PLAN.md` (L2.5–L2.6)
- [x] 404/500 сторінки; `npm run check` → 10/10
- [x] `docs/PAGES.md` ↔ реалізація узгоджені

**Lab 3:**
- [x] CRUD клієнтів/пристроїв/робіт + каталог `/parts` — за `docs/TEST_PLAN.md` (L3.1–L3.4, L3.7 — видалення, L3.8 — заявки: рядки/фільтр/повне редагування)
- [x] «Розумні» валідатори полів (D36: телефон UA, ціни/години > 0 з ≤2 знаками, дати ≥1990 і не в майбутньому, min 2 символи назви/бренди, SKU)
- [x] Жодного `required` у HTML форм (L3.5)
- [x] `scripts/lab3-e2e.sh` → 129/129 на свіжій БД
- [x] `tsc --noEmit` → без помилок

## 12. Документація

| Документ | Зміст |
|---|---|
| [README.md](./README.md) | огляд, tech stack, сторінки, quick start |
| [PLAN.md](./PLAN.md) | step-by-step план Lab 2 |
| [docs/PAGES.md](./docs/PAGES.md) | **спека сторінок і контролерів** (роут-мапа, запити, розкладки, валідація) |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | повна спека моделі (15 сутностей, 9 enum, інваріанти) |
| [docs/ER.md](./docs/ER.md) | ER-діаграма (mermaid) |
| [docs/DECISIONS.md](./docs/DECISIONS.md) | журнал рішень: D1–D18 (Lab 1), D19–D29 (Lab 2), D30–D41 (Lab 3) |
| [docs/TEST_PLAN.md](./docs/TEST_PLAN.md) | чек-листи верифікації Lab 1 + Lab 2 + Lab 3 |

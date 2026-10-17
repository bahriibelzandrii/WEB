# PLAN — Step-by-step план реалізації

Робота йде фазами. Кожен крок має **команди** та **критерій приймання** —
крок вважається завершеним, лише коли критерій виконано.

---

## Фаза 0. Ініціалізація проєкту

### Крок 0.1 — Каркас файлів
Створити: `.gitignore` (`node_modules/`, `.env`, `uploads/`, `dist/`, `*.log`),
`.nvmrc` (`24`), `tsconfig.json`.

`tsconfig.json`: `strict: true`, `module: NodeNext`, `target: ES2023`,
`moduleResolution: NodeNext`, `outDir: dist`, `skipLibCheck: true`.

**Приймання:** файли на місці, синтаксис JSON/TS валідний.

### Крок 0.2 — `package.json`
- `"type": "module"`, `engines.node: ">=24"`.
- Залежності **закріплені точними версіями** (без `^`/`~`):
  - `express@5.2.1`, `@prisma/client@7.10.0`
  - dev: `prisma@7.10.0`, `typescript@7.0.2`, `tsx@4.23.13`,
    `@types/express@5.x`, `@types/node@24.x`
- Скрипти:
  ```json
  {
    "dev":   "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "seed":  "tsx prisma/seed.ts",
    "check": "tsx scripts/check-invariants.ts",
    "prisma:studio": "prisma studio"
  }
  ```

**Приймання:** `npm install` ставляється без помилок; `npm ls express @prisma/client`
показує рівно 5.2.1 / 7.10.0.

### Крок 0.3 — `docker-compose.yml`
`postgres:18`, user/pass/db = `postgres/postgres/lab1_service`, порт `5432:5432`,
номинальний том `db_data`, healthcheck `pg_isready -U postgres -d lab1_service`.

**Приймання:** `docker compose up -d` → контейнер `healthy`
(`docker compose ps`), `pg_isready` зсередини контейнера — OK.

### Крок 0.4 — `.env.example` / `.env`
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lab1_service?schema=public"
PORT=3000
```

**Приймання:** `.env` скопійовано з `.env.example`, `.env` у `.gitignore`.

### Крок 0.5 — `prisma/schema.prisma`
- `datasource db { provider = "postgresql", url = env("DATABASE_URL") }`
- `generator client` — **новий генератор Prisma 7** `prisma-client` з `output`
  (очікуваний синтаксис; точний варіант звірити з `npx prisma init` / доком Prisma 7
  на момент реалізації — це єдиний момент, де синтаксис може відрізнятися від спеки).
- 9 enum та 15 моделей **рівно** за `docs/DATA_MODEL.md`.

**Приймання:** `npx prisma validate` → «schema is valid».

### Крок 0.6 — `prisma/prisma.config.ts`
Конфіг Prisma 6+/7 для seed:
```ts
import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { seed: 'node prisma/seed.ts' }, // запуск через tsx
});
```
(точний формат `defineConfig` звірити з виводом `npx prisma init` для Prisma 7.10).

**Приймання:** `npx prisma db seed` знаходить і запускає seed-команду
(на цьому кроці seed ще не існує — достатньо, що команда розпізнана).

---

## Фаза 1. База даних

### Крок 1.1 — Міграція
`npx prisma migrate dev --name init`

**Приймання:**
- створено `prisma/migrations/0001_init/` з SQL;
- у БД 15 таблиць + 9 enum-типів (`\dt`, `\dT` у psql або Prisma Studio);
- `prisma migrate status` → «up to date».

### Крок 1.2 — Візуальна перевірка
`npx prisma studio` → всі сутності відкриті, зв'язки працюють.

**Приймання:** можна проклікати зв'язок Request → Client/Device/Estimate.

---

## Фаза 2. Seed-дані

### Крок 2.1 — `prisma/seed.ts`
Створення даних за спекою з `docs/DATA_MODEL.md` (розділ «Seed»):
4 User, 8 Client, 12 Device, 14 WorkCatalog, 15 Part, 15 Request
(всі 7 статусів, 3 типи, 4 пріоритети), Diagnostics, RequestWork, RequestPart,
Estimate, Invoice, Payment, Warranty, Comment, FileAttachment.

Вимоги до коду seed:
- **ідемпотентність**: початок — видалення за FK-порядком (Payment→Invoice→…→User);
- **інваріанти будуються в коді**: суми Estimate/Invoice рахуються з позицій,
  `endDate = startDate + periodDays`, статус Invoice по сумах платежів;
- гарантійні заявки (`WARRANTY_CLAIM`) мають `originalRequestId`
  на завершений ремонт.

**Приймання:** `npm run seed` завершується 0; повторний запуск теж (ідемпотентність);
лічильники збігаються зі спекою.

---

## Фаза 3. Каркас додатка (Express)

### Крок 3.1 — `src/prisma.ts`
Singleton `PrismaClient` (імпортується з output-папки генератора Prisma 7).

### Крок 3.2 — `src/index.ts`
Express 5: `app.get('/health')` → `{ status: 'ok', db: 'up' | 'down', time }`
(`db` — через `$queryRaw\`SELECT 1\``). `listen(PORT)`.

**Приймання:** `npm start` → `GET /health` → HTTP 200, `db: "up"`.

> CRUD API **не входить** в завдання (узгоджено: «Повний пакет» без API).
> Каркас — щоб проєкт запускався як застосування.

---

## Фаза 4. Якість та верифікація

### Крок 4.1 — `scripts/check-invariants.ts`
Скрипт на Prisma: перевіряє інваріанти І1–І10 з `docs/DATA_MODEL.md`
на всій вибіркої, друкує звіт, `process.exitCode = 1` при порушенні.

### Крок 4.2 — Прогнати `docs/TEST_PLAN.md`
Всі пункти чек-листа, включно з «тестом іншого ПК» (чиста установка).

**Приймання:** 100% чек-листа зелених.

---

## Фаза 5. Фіналізація

### Крок 5.1 — Оновити README
Структуру/команди — якщо змінилися під час реалізації.

### Крок 5.2 — git
`git init` (якщо ще не ініціалізовано), початковий коміт з усіма артефактами
(без `.env`).

**Приймання:** проєкт у стані «можно здавати»: compose up → migrate → seed → start → check.

---

## Ризики та плани «Б»

| Ризик | Ймовірність | План «Б» |
|---|---|---|
| Prisma 7: npm-тег `latest` = RC 8 | факт | точний pin `7.10.0` в `package.json` (крок 0.2) |
| Синтаксис генератора `prisma-client` відрізняється | середня | звірити з `npx prisma init` / доком на кроці 0.5; фінальна модель не змінюється |
| TypeScript 7 (Go-компілятор) несподіванки | низька | fallback `typescript@5.9.x` (tsx не залежить від tsc) |
| Порт 5432 зайнятий на іншому ПК | середня | змінити мапінг у compose на `5433:5432` + `DATABASE_URL` |
| Docker недоступний на іншому ПК | низька | замість Postgres — SQLite (Prisma це підтримує), але enum-типи стануть String — **не рекомендовано** |

# Lab 1. Модель даних: «Сервіс ремонту та обслуговування комп'ютерної техніки»

Університетська лабораторна робота: проєктування та реалізація реляційної моделі даних
для сервісу ремонту та обслуговування комп'ютерної техніки.

## Tech stack (найновіший стабільний станом на 2026-09-14)

| Компонент | Версія | Примітка |
|---|---|---|
| Node.js | **24 LTS** | Active LTS; зафіксовано в `.nvmrc` та `engines` |
| Express | **5.2.1** | останній стабільний major (6 не випущено) |
| Prisma ORM | **7.10.0** | ⚠️ npm-тег `latest` на CLI зараз вказує на RC 8 — версія **закріплена жорстко** |
| TypeScript | **7.0.2** | fallback: 5.9.x, якщо будуть проблеми сумісності |
| PostgreSQL | **18** (18.6) | через Docker; 19-та ще в бета |
| tsx | 4.23.13 | запуск TS без окремого збірки |

## Структура проєкту

```
Lab_1/
├── README.md               # цей файл
├── PLAN.md                 # детальний step-by-step план реалізації
├── docs/
│   ├── DATA_MODEL.md       # повна спека моделі даних (сутності, поля, інваріанти)
│   ├── ER.md               # ER-діаграма (mermaid)
│   ├── DECISIONS.md        # журнал проєктних рішень
│   └── TEST_PLAN.md        # план верифікації
├── docker-compose.yml      # PostgreSQL 18 (host-порт 5433)
├── package.json            # жорстко закріплені версії
├── prisma7.config.ts       # конфіг Prisma 7 (міграції + seed)
├── tsconfig.json
├── prisma/
│   ├── schema.prisma       # 9 enum + 15 сутностей
│   ├── migrations/         # SQL-міграції
│   └── seed.ts             # насичення реалістичними даними
├── src/
│   ├── index.ts            # Express-додаток: GET /health
│   └── prisma.ts           # singleton PrismaClient (driver adapter)
├── scripts/
│   └── check-invariants.ts # перевірка бізнес-інваріантів моделі
├── start.bat               # one-click launch (Windows)
├── stop.bat                # stop the database
├── .env.example
├── .env                    # локально (у .gitignore)
├── .nvmrc
└── .gitignore
```

## One-click launch (Windows)

Double-click **`start.bat`** — the script will:
1. Check Node.js and Docker (with a clear error if anything is missing)
2. Create `.env` from `.env.example`
3. Install dependencies (`npm ci`) — on first launch
4. Start PostgreSQL 18 (Docker, port 5433) and wait until it's ready
5. Apply migrations and load demo data (60 requests, all statuses)
6. Start the server → **http://localhost:3000/health**

To stop the database — **`stop.bat`** (to delete the data along with it: `docker compose down -v`).

## Quick start (manual)

```bash
# 1. База даних
docker compose up -d
# БД доступна на localhost:5433 (порт 5432 може бути зайнятий локальною PostgreSQL)

# 2. Залежності
npm ci

# 3. Міграції
npx prisma migrate dev

# 4. Seed-дані
npm run seed

# 5. Димовий тест: запуск + перевірка інваріантів
npm start            # http://localhost:3000/health
npm run check        # звірка інваріантів моделі
```

## Документація

| Документ | Зміст |
|---|---|
| [PLAN.md](./PLAN.md) | Step-by-step план: фази, кроки, команди, критерії приймання, ризики |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | 15 сутностей, 9 enum, поля, зв'язки, статусна машина, інваріанти, seed-спека |
| [docs/ER.md](./docs/ER.md) | ER-діаграма (mermaid) + список зв'язків із кардинальністю |
| [docs/DECISIONS.md](./docs/DECISIONS.md) | Чому обрано саме так (18 рішень) |
| [docs/TEST_PLAN.md](./docs/TEST_PLAN.md) | Чек-лист верифікації, включно з тестом переносності на інший ПК |

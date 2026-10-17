# Lab 2. Контролери та представлення: «Сервіс ремонту та обслуговування комп'ютерної техніки»

Університетська лабораторна робота: реалізація **контролерів та представлень**
(server-side рендеринг із шаблонізатором) на базі моделі даних із Lab 1.

- **Lab 1** — реляційна модель даних (15 сутностей, 9 enum, seed, інваріанти І1–І10).
- **Lab 2** — веб-шар: Pug-шаблони, шарова архітектура контролерів, 13 сторінок.

## Tech stack (найновіший стабільний станом на 2026-09-14)

| Компонент | Версія | Примітка |
|---|---|---|
| Node.js | **24 LTS** | Active LTS; зафіксовано в `.nvmrc` та `engines` |
| Express | **5.2.1** | останній стабільний major |
| **Pug** | **3.0.4** | шаблонізатор (Lab 2), точний pin |
| Prisma ORM | **7.10.0** | pin (npm-тег `latest` → RC 8) |
| TypeScript | **7.0.2** | fallback 5.9.x |
| PostgreSQL | **18** | через Docker, порт **5433** |
| tsx | 4.23.13 | запуск TS без збірки |

## Структура проєкту

```
Lab_2/
├── README.md               # цей файл
├── PLAN.md                 # step-by-step план Lab 2 (фази, кроки, критерії)
├── Agent.md                # контекст для AI-агентів
├── docs/
│   ├── DATA_MODEL.md       # повна спека моделі даних (Lab 1)
│   ├── PAGES.md            # спека сторінок і контролерів (Lab 2)
│   ├── ER.md               # ER-діаграма (mermaid)
│   ├── DECISIONS.md        # журнал рішень (D1–D18 Lab 1, D19–D29 Lab 2)
│   └── TEST_PLAN.md        # верифікація (Lab 1 + Lab 2)
├── docker-compose.yml      # PostgreSQL 18 (5433) + app (3000)
├── Dockerfile              # образ додатка (node:24-bookworm-slim)
├── .dockerignore
├── package.json            # жорстко закріплені версії
├── prisma7.config.ts       # конфіг Prisma 7
├── tsconfig.json
├── prisma/
│   ├── schema.prisma       # 9 enum + 15 сутностей
│   ├── migrations/
│   └── seed.ts             # 60 заявок, 30 клієнтів, 45 пристроїв
├── src/
│   ├── index.ts            # тонкий шар: view engine, static, роутери, 404/500, /health
│   ├── prisma.ts           # singleton PrismaClient (driver adapter)
│   ├── controllers/        # dashboard, requests, clients, devices, works
│   ├── routes/             # express.Router() на модуль
│   └── lib/                # labels.ts (UA-словники), format.ts, transitions.ts
├── views/                  # Pug-шаблони
│   ├── layout.pug
│   ├── partials/           # header, footer, flash
│   ├── dashboard/  requests/  clients/  devices/  works/
│   └── errors/             # 404, 500
├── public/css/style.css    # власні стилі, без CDN
├── scripts/
│   └── check-invariants.ts # перевірка інваріантів І1–І10
├── start.bat / stop.bat    # one-click launch / stop (Windows)
└── .env.example / .nvmrc / .gitignore
```

## Сторінки

| Маршрут | Сторінка |
|---|---|
| `GET /` | дашборд: картки за статусами + 10 останніх заявок |
| `GET /requests` | список заявок: фільтри (статус/тип/пріоритет), пошук, пагінація 20/стор. |
| `GET /requests/:id` | картка заявки: 13 секцій (read-only) |
| `GET /clients`, `GET /clients/:id` | клієнти: список з пошуком + картка з історією |
| `GET /devices`, `GET /devices/:id` | пристрої: список з пошуком + картка з історією |
| `GET /works` | каталог робіт (прайс-лист, read-only) |
| `GET /health` | JSON health-check (Lab 1, без змін) |
| 404 / 500 | стилізовані сторінки помилок |

> **Lab 2 — read-only режим.** Форми створення/редагування заявки та переходи статусів
> (усі POST-роуты) перенесено у наступну лабораторну роботу; спека збережена
> в [docs/PAGES.md §4.4–4.6](./docs/PAGES.md).

Детальна спека кожної сторінки (запити, розкладки, крайові випадки) —
[docs/PAGES.md](./docs/PAGES.md).

## One-click launch (Windows)

Подвійний клік **`start.bat`** — перевіряє Docker, збирає образ додатка
(перший раз — кілька хвилин), піднімає PostgreSQL 18 і додаток
(`docker compose up --build`), застосовує міграції, насичує демо-даними
(60 заявок), запускає сервер → **http://localhost:3000**.

Зупинити все — **`stop.bat`** (видалити дані: `docker compose down -v`).

## Запуск на іншому ПК (Docker)

Потрібен лише **Docker Desktop** — Node.js не встановлюється,
додаток працює в контейнері:

```bash
git clone <репозиторій> && cd Lab_2
docker compose up -d --build   # збірка образу + PostgreSQL + додаток
# → http://localhost:3000
```

При кожному старті контейнера: `prisma migrate deploy` → `npm run seed`
(ідемпотентний, 60 заявок / 30 клієнтів / 45 пристроїв) → сервер.
Скинути до демо-стану: `docker compose down -v` і запустити знову.

## Quick start (ручний, на хості)

Розробка напряму на хості (Node 24; PostgreSQL — в Docker):

```bash
cp .env.example .env
docker compose up -d db       # PostgreSQL 18 на localhost:5433
npm ci
npx prisma migrate dev
npm run seed
npm start                     # http://localhost:3000
npm run check                 # інваріанти моделі І1–І10 (Lab 1)
```

## Документація

| Документ | Зміст |
|---|---|
| [PLAN.md](./PLAN.md) | step-by-step план Lab 2: фази, кроки, команди, критерії приймання, ризики |
| [docs/PAGES.md](./docs/PAGES.md) | **спека сторінок і контролерів**: роут-мапа, запити, розкладки, валідація, крайові випадки |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | модель даних: 15 сутностей, 9 enum, статусна машина, інваріанти, seed-спека |
| [docs/ER.md](./docs/ER.md) | ER-діаграма (mermaid) + зв'язки з кардинальністю |
| [docs/DECISIONS.md](./docs/DECISIONS.md) | журнал проєктних рішень: D1–D18 (Lab 1), D19–D29 (Lab 2) |
| [docs/TEST_PLAN.md](./docs/TEST_PLAN.md) | чек-лист верифікації: Lab 1 + Lab 2 (E2E) |
| [Agent.md](./Agent.md) | контекст для AI-агентів |

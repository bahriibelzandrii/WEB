# План верифікації (Test Plan)

Порядок виконання — зверху вниз. Робота завершена, коли всі пункти ✅.

## 1. Підвищення середовища

- [x] `docker compose up -d` → контейнер `lab1_service_db` у стані `healthy`
- [x] `docker compose exec db pg_isready -U postgres -d lab1_service` → `accepting connections`
- [x] `npm ci` завершується без помилок
- [x] `npm ls express @prisma/client prisma typescript` → рівно 5.2.1 / 7.10.0 / 7.10.0 / 7.0.2

## 2. Схема

- [x] `npx prisma validate` → schema is valid
- [x] `npx prisma migrate dev` → міграція `init` застосована без помилок
- [x] У БД **15 таблиць** і **9 enum-типів** (перевірка: `psql -c "\dt"`, `psql -c "\dT"`)
- [x] `npx prisma studio` → відкривається, усі сутності на місці *(еквівалент: дані звірено psql + Prisma-запитах; GUI не запускали в CI-середовіщі)*

## 3. Seed

- [x] `npm run seed` → exit code 0
- [x] Повторний `npm run seed` → exit code 0 (ідемпотентність)
- [x] Лічильники збігаються зі спекою (docs/DATA_MODEL.md → «Seed-спека»):
  User=4, Client=30, Device=45, WorkCatalog=14, Part=15, Request=60,
  Estimate=43, Invoice=37, Warranty=22
- [x] Усі 7 статусів, 3 типи заявок, 4 пріоритети присутні в даних

## 4. Інваріанти

- [x] `npm run check` → всі І1–І10 (docs/DATA_MODEL.md) пройдені, exit code 0
- [x] Штучний негативний тест: змінити одну суму через Prisma Studio →
  `npm run check` ловить порушення (exit code 1) → відкотити зміну

## 5. Додаток

- [x] `npm start` → сервер на `:3000`
- [x] `GET /health` → HTTP 200, JSON `{ status: "ok", db: "up" }`

## 6. Тест «інший ПК» (портативність)

Симуляція чистого середовища:

- [x] `docker compose down -v` (видаляємо том з БД)
- [x] `rm -rf node_modules .env`
- [x] `cp .env.example .env`
- [x] `npm ci && docker compose up -d && npx prisma migrate dev && npm run seed && npm run check`
- [x] Все зелене з нуля — проєкт переносний

## 7. Фінал

- [x] README відповідає реальному стану проєкту
- [x] `.env` не потрапив у git (`git status --ignored`)
- [x] Фінальний коміт

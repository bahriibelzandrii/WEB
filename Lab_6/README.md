# Lab 6. RESTful API: «Сервіс ремонту та обслуговування комп'ютерної техніки»

Університетська лабораторна робота: **RESTful API для доступу до даних
системи та управління ними** (JSON, автентифікація за сесією, матриця ролей)
на базі Lab 5.

Ланцюг розробки (кожна лаба — продовження попередньої, оригінальні папки
не змінюються):

- **Lab 1** — реляційна модель даних (15 сутностей, 9 enum, seed, інваріанти І1–І10).
- **Lab 2** — веб-шар: Pug-шаблони, MVC, 13 сторінок.
- **Lab 3** — форми та серверна валідація: CRUD довідників, каталог запчастин.
- **Lab 4** — авторизація: 4 ролі, вхід/вихід/реєстрація, `requireRole`, 403.
- **Lab 5** — захищена область керування: модуль користувачів, role-aware UI,
  CRUD всіх 15 таблиць за матрицею дозволів.
- **Lab 6** — **RESTful API `/api`**: ті самі правила/валідація/інваріанти
  через JSON-інтерфейс (без подвійної логіки — API викликає web-контролери).

## Tech stack

| Компонент | Версія | Примітка |
|---|---|---|
| Node.js | **24 LTS** | зафіксовано в `.nvmrc` та `engines` |
| Express | **5.2.1** | фреймворк |
| Pug | **3.0.4** | шаблонізатор (Web-шар) |
| Prisma ORM | **7.10.0** | + PostgreSQL **18** (Docker, порт 5433) |
| TypeScript | **7.0.2** (`tsx` 4.23.13) | запуск TS без збірки |
| Passport.js / passport-local | 0.7 / 1.0 | авторизація (Lab 4) |
| express-session + bcryptjs | 1.19 / 3.0.3 | сесії, паролі (Lab 4) |

## REST API `/api` (нове, Lab 6)

Один додаток, два інтерфейси над одним шаром: Web (Pug, `/`) і REST
(`/api`). **REST не дублює бізнес-логіку** — мутації викликають ті самі
web-контролери (Lab 3–5), тож валідація, статусна машина, інваріанти
і обмеження цілісності однаково застосовуються до Web і до API
(D53). Читання реалізовано окремими JSON-хендлерами з пагінацією.

### Аутентифікація та помилки

| Ситуація | Код | Тіло |
|---|---|---|
| Гість на захищеній точці | `401` | `{"error":"Authentication required"}` |
| Неповноважена роль | `403` | `{"error":"Forbidden","requiredRoles":["MANAGER","ADMIN"]}` |
| Запис не знайдено | `404` | `{"error":"Not found"}` |
| Помилка валідації | `400` | `{"error":"…","errors":["поле: опис"]}` |
| Унікальність / FK-обмеження | `400` | `{"error":"Unique constraint violation"}` та ін. |
| Внутрішня помилка | `500` | `{"error":"Internal server error"}` |

Сесія та для Web і для API — одна (Passport + `express-session`, Lab 4):
достатньо увійти через `POST /login` (або `/api`-клієнт зі стікер-контейнєром),
і далі `Cookie: connect.sid` приймається на всіх точках.

### Формат списків

Усі `GET`-списки підтримують `?page=1&pageSize=20&<фільтри>` (pageSize до 100)
і повертають:

```json
{ "data": [ … ], "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 }
```

Картки (`GET /api/<entity>/<id>`) — `{"data": …}` з повними зв'язками.
Створення — `201 {"data": …}`; оновлення — `200 {"data": …}`; видалення — `204`.

### Матриця дозволів (дзеркало Web-маршрутів, Lab 4–5)

| Рівень ролей | Точки |
|---|---|
| **публічні** (гость) | `GET /api/clients*`, `/devices*`, `/works*`, `/parts*`, `/requests*` |
| **МЕНЕДЖЕР+** | CRUD `clients`, `devices`, `works`, `parts`; `POST/PUT/DELETE /api/requests`, оцінки (`estimate`, `approve`, `reject`), `invoice`, `payments`, `warranty` |
| **МАЙСТЕР+** | `transition`, рядки `works`/`parts` заявки, `diagnostics`, `comments`, `attachments` |
| **АДМІН** | `GET/POST/PUT/DELETE /api/users*` (пароль у відповідях не повертається) |

### Повний список точок

| Метод | Точка | Ролі | Опис |
|---|---|---|---|
| GET | `/api/clients` | — | список клієнтів (`q`, пагінація) |
| GET | `/api/clients/:id` | — | картка: контакти, пристрої, історія заявок |
| POST | `/api/clients` | MANAGER+ | створити клієнта |
| PUT | `/api/clients/:id` | MANAGER+ | оновити |
| DELETE | `/api/clients/:id` | MANAGER+ | м'яке видалення (`deletedAt`) |
| GET | `/api/devices` / `/api/devices/:id` | — | список / картка (+власник, історія) |
| POST/PUT/DELETE | `/api/devices…` | MANAGER+ | CRUD пристроїв |
| GET | `/api/works` / `/api/works/:id` | — | каталог робіт (прайс) |
| POST/PUT/DELETE | `/api/works…` | MANAGER+ | CRUD прайсу |
| GET | `/api/parts` / `/api/parts/:id` | — | каталог запчастин |
| POST/PUT/DELETE | `/api/parts…` | MANAGER+ | CRUD запчастин |
| GET | `/api/requests` | — | список заявок (`status`, `type`, `priority`, `q`) |
| GET | `/api/requests/:id` | — | картка: усі секції (діагностика, роботи, запчастини, оцінка, рахунок, оплати, гарантія, коментарі, вкладення) |
| POST | `/api/requests` | MANAGER+ | створити заявку (новий/існуючий клієнт і пристрій, I4, WARRANTY_CLAIM) |
| PUT | `/api/requests/:id` | MANAGER+ | редагувати |
| DELETE | `/api/requests/:id` | MANAGER+ | м'яке видалення |
| POST | `/api/requests/:id/transition` | TECH+ | `{"status":"IN_PROGRESS"}` — статусна машина |
| POST | `/api/requests/:id/works` | TECH+ | додати роботу з каталогу (`workId`, `cost`, `hours`) |
| DELETE | `/api/requests/:id/works/:lineId` | TECH+ | прибрати рядок роботи |
| POST | `/api/requests/:id/parts` | TECH+ | додати запчастину (`partId`, `quantity`, `unitPrice`) |
| DELETE | `/api/requests/:id/parts/:lineId` | TECH+ | прибрати рядок запчастини |
| POST | `/api/requests/:id/diagnostics` | TECH+ | upsert діагностики |
| POST | `/api/requests/:id/estimate` | MANAGER+ | оформити/оновити оцінку (суми робіт+запчастин) |
| POST | `/api/requests/:id/estimate/approve` | MANAGER+ | затвердити (DRAFT/REJECTED → APPROVED) |
| POST | `/api/requests/:id/estimate/reject` | MANAGER+ | відхилити |
| POST | `/api/requests/:id/invoice` | MANAGER+ | видати рахунок (з затвердженої оцінки, 1 раз) |
| POST | `/api/requests/:id/payments` | MANAGER+ | оплата (`amount ≤` залишок; статус UNPAID/PARTIAL/PAID) |
| POST | `/api/requests/:id/warranty` | MANAGER+ | оформити гарантію (upsert) |
| POST | `/api/requests/:id/comments` | TECH+ | коментар (`text`, `isInternal`) |
| POST | `/api/requests/:id/attachments` | TECH+ | `multipart/form-data`, файл до 10 МБ |
| GET | `/api/users` | ADMIN | список (`password` не повертається) |
| GET | `/api/users/:id` | ADMIN | картка |
| POST | `/api/users` | ADMIN | створити (`name`, `email`, `phone`, `role`, `password ≥6`) |
| PUT | `/api/users/:id` | ADMIN | оновити (новий пароль — необов'язковий) |
| DELETE | `/api/users/:id` | ADMIN | видалити (400: власний акаунт / FK `Restrict`) |

### Приклади (curl)

```bash
BASE=http://localhost:3000

# 1) Вхід (сесія — для Web і API однакова)
curl -c jar.txt -d 'email=admin@service.ua&password=secret' $BASE/login \
  -o /dev/null -w '%{http_code}\n'            # 302

# 2) Публічне читання (гостю теж можна)
curl $BASE/api/requests?page=1\&pageSize=5    # {"data":[...],"page":1,...}
curl $BASE/api/requests/<id>                  # картка з усіма секціями

# 3) Захист: 401 без сесії, 403 за роллю
curl $BASE/api/users                          # 401 {"error":"Authentication required"}
curl -b jar.txt $BASE/api/users               # ADMIN: 200
# для tech1@service.ua:                        # 403 {"error":"Forbidden",...}

# 4) Мутації (MANAGER+)
curl -b jar.txt -H 'Content-Type: application/json' \
  -d '{"name":"API Client","phone":"0670001112","email":"api@client.ua"}' \
  $BASE/api/clients                           # 201 {"data":{...}}
curl -b jar.txt -H 'Content-Type: application/json' \
  -d '{"status":"IN_PROGRESS"}' \
  $BASE/api/requests/<id>/transition          # 200 {"data":{...,"status":"IN_PROGRESS"}}

# 5) Валідація = як у Web (400 + список)
curl -b jar.txt -H 'Content-Type: application/json' \
  -d '{"name":"A","phone":"","email":""}' \
  $BASE/api/clients                           # 400 {"error":"Validation failed","errors":[...]}
```

### Структура коду (нове, Lab 6)

| Файл | Призначення |
|---|---|
| `src/api/routes.ts` | роутер `/api`: точок 36, `apiAuth` за матрицею, JSON 404/500 |
| `src/api/lists.ts` | публічні читання: пошук, фільтри, пагінація, include |
| `src/api/mutations.ts` | мутації через web-контролери (`runWeb`) + до-відправка сущності |
| `src/api/http.ts` | `apiAuth` (401/403), `parsePageQuery`, `prismaError`, `wrap`, `runWeb` |
| `src/app.ts` | `express.json()` + `app.use("/api", apiRouter)` (до HTML-404) |
| `scripts/lab6-smoke.ps1` | smoke-тест API (curl + cookie-jars) |

## Акаунти (seed)

| Email | Роль | Назва |
|---|---|---|
| `admin@service.ua` | Адміністратор | Адміністратор Системи |
| `manager@service.ua` | Менеджер | Олена Коваленко |
| `tech1@service.ua` | Майстер | Ігор Мельник |
| `tech2@service.ua` | Майстер | Сергій Бондар |
| `visitor@service.ua` | Відвідувач | Відвідувач Сервісу |

Пароль у всіх демонстраційних акаунтів: **`secret`**
(детермінований bcrypt-хеш у `prisma/seed.ts`).

## One-click launch (Windows)

Подвійний клік **`start.bat`** — перевіряє Docker, збирає образ, піднімає
PostgreSQL 18 + додаток, застосовує міграції, насичує демо-даними,
запускає сервер → **http://localhost:3000** (Web) та **http://localhost:3000/api** (REST).

Зупинити все — **`stop.bat`** (скинути дані: `docker compose down -v`).

## Тест-план (ручна/автоматична перевірка)

Автоматичний smoke: `scripts/lab6-smoke.ps1` (35+ перевірок: 401/403/404,
CRUD, пагінація, валідація, статусна машина, фінансовий цикл, FK-обмеження).

1. **Гість**: `GET /api/requests` → 200 JSON; `GET /api/users` → 401;
   `POST /api/clients` → 401.
2. **Відвідувач** (`visitor@service.ua`): `POST /api/clients` → 403;
   `GET /api/users` → 403.
3. **Майстер** (`tech1@service.ua`): `POST /api/requests/:id/works` → 201;
   `POST /api/requests/:id/invoice` → 403; `POST /api/clients` → 403.
4. **Менеджер** (`manager@service.ua`): повний цикл заявки через API —
   створити → статуси → роботи/запчастини → оцінка → approve → рахунок →
   оплата → `invoice.status = "PAID"`.
5. **Адмін** (`admin@service.ua`): `GET /api/users` → список без полів
   `password`; створення/редагування/видалення користувача; видалення
   власного акаунту → 400.
6. Валідація API = валідація Web (той самий код: `400` зі списком помилок;
   FK-порушення — `400` «Reference constraint violation» / специфічні 400
   web-контролерів).
7. Незмінність Web-шару (регресія Lab 4–5): вхід/вихід, role-aware UI,
   модуль користувачів.

## Документація

| Документ | Зміст |
|---|---|
| [docs/PAGES.md](./docs/PAGES.md) | спека сторінок і контролерів (Lab 2/3) + доповнення Lab 4 |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | модель даних: 15 сутностей, 9 enum, статусна машина, інваріанти |
| [docs/DECISIONS.md](./docs/DECISIONS.md) | журнал рішень: D1–D18 (Lab 1), D19–D29 (Lab 2), D30–D43 (Lab 3), D44–D48 (Lab 4), D49–D52 (Lab 5), **D53–D56 (Lab 6)** |
| [docs/TEST_PLAN.md](./docs/TEST_PLAN.md) | чек-лист верифікації |
| [Agent.md](./Agent.md) | контекст для AI-агентів |

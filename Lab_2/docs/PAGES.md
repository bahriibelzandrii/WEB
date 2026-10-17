# Специфікація сторінок і контролерів (Lab 2)

Детальна спека веб-шару: кожна сторінка — маршрут, дані (Prisma-запит),
розкладка, поведінка, крайові випадки. Документ є джерелом правди для
реалізації; разом із `DATA_MODEL.md` (модель) і `PLAN.md` (кроки) замикає
завдання «контролери та представлення».

## 1. Загальні конвенції

| Конвенція | Правило |
|---|---|
| Шаблонізатор | **Pug 3.0.4** (точний pin), `app.set('view engine', 'pug')`, каталог `views/` у корені проєкту |
| Патерн POST | **PRG** (Post/Redirect/Get): кожен POST-контролер закінчується `res.redirect(...)` |
| Помилки форм | Повторний `res.render` тієї ж форми зі статусом **400**, locals: `errors: string[]`, `values` (старі значення) |
| Помилки переходів | `res.redirect('/requests/:id?error=transition')` — картка показує банер |
| 404 / 500 | `app.use(notFound)` та error-handler у `index.ts`; стилізовані сторінки |
| Soft delete | Усі списки/картки — тільки `deletedAt = null`; інакше 404 |
| Мова | Українська. Назви enum — через словники `src/lib/labels.ts` (raw-значення в UI не показуються) |
| Форматування | Гроші: `Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' })` → `1 234,56 ₴`; дати: `dd.mm.yyyy` (через `src/lib/format.ts`) |
| Пагінація | `?page=N`, **20 записів/сторінку**, номери сторінок зберігають фільтри в URL |
| Автор заявки | Без автентифікації: `createdById` = користувач із роллю `ADMIN` (перший за `createdAt`) |
| Номер заявки | `R-YYYY-NNNN` (4 цифри): `max(номерів поточного року) + 1`, `padStart(4, '0')` — як у seed (`R-2026-0001`) |

### Роут-мапа (повна)

| Метод | Шлях | Контролер | Призначення |
|---|---|---|---|
| GET | `/` | `dashboard.index` | дашборд |
| GET | `/requests` | `requests.index` | список + фільтри + пагінація |
| GET/POST | `/requests/new`, `/requests/:id/edit`, `/requests/:id/transition` | — | **перенесено у наступну ЛР** — у Lab 2 додаток read-only (§4.4–4.6) |
| GET | `/requests/:id` | `requests.show` | картка заявки |
| GET | `/clients` | `clients.index` | список клієнтів |
| GET | `/clients/:id` | `clients.show` | картка клієнта |
| GET | `/devices` | `devices.index` | список пристроїв |
| GET | `/devices/:id` | `devices.show` | картка пристрою |
| GET | `/works` | `works.index` | каталог робіт |
| GET | `/health` | (Lab 1, без змін) | JSON health-check |
| — | інше | 404 / 500 | стилізовані сторінки |

## 2. Модулі `src/lib/`

### 2.1 `labels.ts` — словники UA-назв для 9 enum

```ts
STATUS:     NEW→«Нова», IN_DIAGNOSTICS→«У діагностиці», ESTIMATE_READY→«Оцінка готова»,
            IN_REPAIR→«У ремонті», READY→«Готова», COMPLETED→«Завершена», CANCELED→«Скасована»
TYPE:       REPAIR→«Ремонт», MAINTENANCE→«Обслуговування», WARRANTY_CLAIM→«Гарантійне звернення»
PRIORITY:   LOW→«Низький», NORMAL→«Звичайний», HIGH→«Високий», URGENT→«Терміновий»
DEVICE_TYPE:PC→«ПК», LAPTOP→«Ноутбук», MONITOR→«Монітор», PHONE→«Телефон»,
            TABLET→«Планшет», PRINTER→«Друкар», OTHER→«Інше»
WORK_STATUS: PENDING→«Очікує», IN_PROGRESS→«Виконується», DONE→«Виконано»
ESTIMATE_STATUS: DRAFT→«Чорновик», APPROVED→«Затверджена», REJECTED→«Відхилена»
INVOICE_STATUS: UNPAID→«Не сплачено», PARTIAL→«Частково», PAID→«Сплачено»
PAYMENT_METHOD: CASH→«Готівка», CARD→«Картка», BANK_TRANSFER→«Банківський переказ»
ROLE:       ADMIN→«Адміністратор», MANAGER→«Менеджер», TECHNICIAN→«Майстер»
```

Кожен словник — `Record<EnumValue, string>` + типізована функція
`label(map, value)` (fallback — raw-значення, щоб UI не ламався).

### 2.2 `format.ts`

- `uah(value: Decimal | number | string): string` — `1 234,56 ₴`
- `dateOnly(iso: string | Date): string` — `14.09.2026`
- `dateTime(iso: string | Date): string` — `14.09.2026, 15:30`
- `bytes(n: number | null): string` — `1,2 МБ` / `840 КБ` / `—`

### 2.3 `transitions.ts` — машина станів (з DATA_MODEL.md)

```ts
ALLOWED: {
  NEW:            [IN_DIAGNOSTICS, CANCELED],
  IN_DIAGNOSTICS: [ESTIMATE_READY, CANCELED],
  ESTIMATE_READY: [IN_REPAIR, CANCELED],
  IN_REPAIR:      [READY, CANCELED],
  READY:          [COMPLETED, CANCELED],
  COMPLETED:      [],
  CANCELED:       [],
}
nextStatuses(current): RequestStatus[]   // [] для кінцевих
canTransition(from, to): boolean
```

## 3. Layout і partials

```
views/
├── layout.pug            # html(lang=uk), head (title=block, /css/style.css), header, main, footer
├── partials/
│   ├── header.pug        # логотип-назва + навігація: Головна | Заявки | Клієнти | Пристрої | Роботи
│   ├── footer.pug        # «Сервіс ремонту та обслуговування комп'ютерної техніки · Lab 2»
│   └── flash.pug         # банер помилок (locals.error / locals.errors)
├── dashboard/index.pug
├── requests/{index,show,create,edit}.pug
├── clients/{index,show}.pug
├── devices/{index,show}.pug
├── works/index.pug
└── errors/{404,500}.pug
```

- Активний пункт навігації — жирний (передається через `locals.nav`).
- Усі `include partials/header` / `footer` через `layout.pug` (Pug `block`).

## 4. Сторінки

### 4.1 Дашборд — `GET /`

**Дані:**
- `prisma.request.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true })` → 7 рядків
- `prisma.request.count({ where: { deletedAt: null } })`
- `prisma.request.findMany({ where: { deletedAt: null }, include: { client: true, device: true }, orderBy: { createdAt: 'desc' }, take: 10 })`

**Розкладка:**
1. `h1` «Сервіс ремонту техніки» + підзаголовок.
2. Сітка карток (8): «Всього: N» (→ `/requests`) + по картці на кожен статус
   (назва UA + кількість, → `/requests?status=X`).
3. Блок «Останні заявки»: таблиця `Номер | Клієнт | Пристрій | Тип | Пріоритет | Статус | Дата`
   (номер/клієнт — посилання на картку).
4. Кнопок немає: створення заявки перенесено у наступну ЛР (read-only дашборд).

**Крайові випадки:** порожня БД → картки з 0, блок «Поки немає заявок».

### 4.2 Список заявок — `GET /requests`

**Query-параметри:** `status`, `type`, `priority` (enum або порожньо), `q` (текст), `page` (≥1, default 1).

**Запит:**
```ts
where = {
  deletedAt: null,
  ...(status && { status }), ...(type && { type }), ...(priority && { priority }),
  ...(q && { OR: [
    { number: { contains: q, mode: 'insensitive' } },
    { description: { contains: q, mode: 'insensitive' } },
    { client: { name: { contains: q, mode: 'insensitive' } } },
  ]}),
}
findMany({ where, include: { client: true, device: true }, orderBy: { createdAt: 'desc' }, skip: (page-1)*20, take: 20 })
count({ where })
```

**Розкладка:**
1. `h1` «Заявки» + кнопка «Створити заявку».
2. Форма фільтрів (GET, рядком): select Статус (7 + «Всі»), select Тип (3 + «Всі»),
   select Пріоритет (4 + «Всі»), input Пошук (номер/опис/клієнт), кнопка «Застосувати».
   Значення — з поточного URL.
3. Таблиця: `Номер` (посилання), `Клієнт`, `Пристрій` (brand model), `Тип`, `Пріоритет`,
   `Статус` (бейдж), `Дата`.
4. Пагінація: `‹ 1 2 3 … ›` + «Показано X–Y з N»; всі посилання несуть поточні фільтри.

**Крайові випадки:** 0 результатів → «Нічого не знайдено» + посилання «скинути фільтри».
Некоректний `page`/`status` → ігнорується (default).

### 4.3 Картка заявки — `GET /requests/:id`

**Запит (один, з повним include):**
```ts
prisma.request.findUnique({
  where: { id },
  include: {
    client: true, device: true,
    createdBy: true, assignedTo: true,
    diagnostics: true,
    works:  { include: { technician: true }, orderBy: { createdAt: 'asc' } },
    parts:  { include: { part: true }, orderBy: { createdAt: 'asc' } },
    estimate: true,
    invoice: { include: { payments: { orderBy: { paidAt: 'asc' } } } },
    warranty: true,
    comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
    attachments: { include: { uploadedBy: true } },
    originalRequest: { select: { id: true, number: true, status: true, client: { select: { name: true } } } },
  },
})
```
Не знайдено або `deletedAt ≠ null` → 404.

**Розкладка (секції, усі read-only; переходи статусів і редагування — у наступній ЛР):**
1. **Шапка:** `h1` номер; бейджі статус/тип/пріоритет; мета: створено (дата, менеджер
   `createdBy`), майстер `assignedTo` (або «не призначено»); кнопок немає —
   переходи статусів і «Редагувати» перенесено у наступну ЛР.
2. **Клієнт:** ім'я (посилання `/clients/:id`), телефон, email, адреса.
3. **Пристрій:** тип (UA), brand model (посилання `/devices/:id`), серійний №, характеристики, дата покупки.
4. **Опис:** `description` або «—».
5. **Гарантійне посилання** (тільки якщо `originalRequest`): посилання на оригінальний ремонт (номер, статус).
6. **Діагностика** (якщо є): дата, висновки, вартість (UAH), майстер, нотатки.
7. **Роботи:** таблиця `Назва | Ціна | Години | Майстер | Статус` + рядок «Разом: Σ cost».
8. **Запчастини:** таблиця `Назва | К-сть | Ціна | Сума` + «Разом: Σ qty×price».
9. **Оцінка:** статус, Σ робіт, Σ запчастин, **разом**, дата затвердження.
10. **Рахунок:** сума, знижка, **до сплати**, статус, дата видачі, термін оплати;
    таблиця платежів `Дата | Сума | Метод | Нотатка` + «Оплачено: Σ amount».
11. **Гарантія:** строк (днів), період (startDate — endDate), що покриває.
12. **Коментарі:** список (автор, дата, текст; внутрішні — бейдж «внутрішній»).
13. **Вкладення:** таблиця `Файл | Розмір | Тип | Завантажив` (без завантаження — файлів на диску немає).

**Крайові випадки:** відсутня секція (напр., немає діагностики) → показується
«Немає діагностики» (сірим) — секції завжди на місці, стан порожнечі видимий.

### 4.4 Створення заявки — `GET/POST /requests/new`

> **⚠️ Перенесено у наступну ЛР** — у Lab 2 не реалізовано (read-only).

**GET (форма):**
- Тип (3), Пріоритет (4, default NORMAL), Опис (textarea, required).
- **Клієнт:** radio «Існуючий» (select з 30, `name — phone`) / «Новий»
  (ім'я*, телефон*, email, адреса).
- **Пристрій:** radio «Існуючий» (select з 45, `brand model — serial — власник`) / «Новий»
  (тип*, бренд*, модель*, серійний №, характеристики, дата покупки).
- **Майстер:** optional select (4 User) + «Не призначено».
- **Гарантійне посилання** (видиме, тільки якщо тип = WARRANTY_CLAIM): select
  завершених заявок (`status = COMPLETED`, `number — client.name`).
- Маленький vanilla JS (в самому шаблоні, ~20 рядків): показ/сховання блоків
  «новий клієнт/новий пристрій/гарантія» за radio/select. Без фреймворків.

**POST — валідація (контролер, по черзі, збирає ВСІ помилки):**
1. `type`, `priority` — коректні enum.
2. Опис — непорожній (trim).
3. Клієнт: «існуючий» → id існує (і не soft-deleted); «новий» → ім'я + телефон непорожні,
   email — формат, якщо задан.
4. Пристрій: «існуючий» → id існує; «новий» → тип/бренд/модель непорожні.
5. `WARRANTY_CLAIM` → вибрано `originalRequestId`, заявка існує і `COMPLETED`.
6. Майстер (якщо заданий) → існує.

Помилки → `400` + рендер форми з `errors[]` (червоний блок зверху) і `values` (старі дані).

**POST — успіх (транзакція):**
```ts
prisma.$transaction(async (tx) => {
  const clientId  = mode === 'new' ? (await tx.client.create({...})).id : existingClientId;
  const deviceId  = mode === 'new' ? (await tx.device.create({ ..., ownerId: clientId })).id : existingDeviceId;
  const number    = await nextNumber(tx);            // R-YYYY-NNNN
  return tx.request.create({ data: { number, type, priority, description,
    clientId, deviceId, originalRequestId?, assignedToId?, createdById: adminId, status: 'NEW' } });
})
```
→ `redirect('/requests/:id')`.

**Крайові випадки:** новий пристрій прив'язується до створеного/обраного клієнта
(`ownerId`); повторний подвійний submit — не критичний (номер унікальний, гіпотетичний
конфлікт → 500, для ЛР достатньо).

### 4.5 Редагування заявки — `GET/POST /requests/:id/edit`

> **⚠️ Перенесено у наступну ЛР** — у Lab 2 не реалізовано (read-only).

**Поля форми:** Опис (required), Пріоритет, Майстер (optional), Клієнт (select існуючих),
Пристрій (select існуючих). **Не змінюються:** номер, тип, статус, дати.

**Валідація:** опис непорожній; обрані клієнт/пристрій/майстер існують.
Помилки → 400 + повторний рендер зі старими значеннями.
Успіх → `prisma.request.update` → `redirect('/requests/:id')`.

### 4.6 Перехід статусу — `POST /requests/:id/transition`

> **⚠️ Перенесено у наступну ЛР** — у Lab 2 не реалізовано (read-only).

- Тіло: `status` (RequestStatus).
- Заявка не знайдена → 404. `canTransition(current, to)` = false →
  `redirect('/requests/:id?error=transition')`.
- Успіх → `update({ status })` → `redirect('/requests/:id')`.

### 4.7 Клієнти — `GET /clients`

**Query:** `q` (name/phone/email, insensitive), `page`.
**Запит:** `findMany({ where: { deletedAt: null, ...(q && { OR: [...] }) }, include: { _count: { select: { requests: true, devices: true } } }, orderBy: { name: 'asc' }, skip/take })`.
**Таблиця:** `Ім'я` (посилання) | `Телефон` | `Email` | `Адреса` | `Заявок` | `Пристроїв`.
Порожньо → «Клієнтів не знайдено».

### 4.8 Картка клієнта — `GET /clients/:id`

**Запит:** клієнт + `devices` (include `_count.requests`) + `requests`
(include `device: { select: { brand, model } }`, `orderBy createdAt desc`).
**Розкладка:** блок контактів (ім'я, телефон, email, адреса, нотатки, дата реєстрації);
таблиця пристроїв (`Тип | Бренд/Модель | Серійний № | Заявок | → картка`);
таблиця історії заявок (`Номер | Пристрій | Тип | Статус | Дата | → картка`).
Не знайдено/soft-deleted → 404.

### 4.9 Пристрої — `GET /devices`

**Query:** `q` (brand/model/serialNumber, insensitive), `page`.
**Таблиця:** `Тип` | `Бренд/Модель` | `Серійний №` | `Власник` (посилання) | `Заявок` | `→ картка`.

### 4.10 Картка пристрою — `GET /devices/:id`

**Запит:** пристрій + `owner` + `requests` (desc).
**Розкладка:** блок характеристик (тип, бренд/модель, серійний №, specs, дата покупки);
власник (посилання на картку клієнта); історія заявок (таблиця як у 4.8).

### 4.11 Каталог робіт — `GET /works`

**Запит:** `prisma.workCatalog.findMany({ orderBy: { name: 'asc' } })` (14 рядків, без пагінації).
**Таблиця:** `Назва` | `Опис` | `Базова ціна` (UAH) | `Години`.
Підзаголовок: «Прайс-лист робіт (read-only)».

### 4.12 404 / 500

- `notFound`: великий код, «Сторінку не знайдено», посилання на головну.
- `500`: «Щось пішло не так (500)», посилання на головну; `console.error(err)` у логах.
- Обидві — через `layout.pug` (навігація доступна).

## 5. Стилі — `public/css/style.css`

Один файл, без CDN, без збірки. Структура:
1. **База:** system-font stack, `body` max-width 1100px по центру, сірий фон, картки-білі.
2. **Header:** липка навігація, активний пункт жирний.
3. **Картки дашборда:** CSS grid `repeat(auto-fit, minmax(140px, 1fr))`.
4. **Таблиці:** повна ширина, стрічка заголовка, hover-рядок, правий вирівнювання для сум.
5. **Бейджі статусів** (кольори): NEW — сірий, IN_DIAGNOSTICS — синій, ESTIMATE_READY —
   бурштиновий, IN_REPAIR — помаранчевий, READY — зелений, COMPLETED — темно-зелений,
   CANCELED — червоний. Пріоритети: LOW — сірий, NORMAL — синій, HIGH — помаранчевий,
   URGENT — червоний (жирний).
6. **Форми:** label зверху, input/select/textarea 100%, червоний блок помилок,
   radio-групи клієнт/пристрій.
7. **Пагінація:** рядок кнопок, активна сторінка підсвічена.
8. **Порожні стани:** центрований сірий текст.

## 6. Зміни в `src/index.ts` (тонкий шар)

```
express() → app.set('view engine','pug')
→ express.static('public')
→ express.urlencoded({ extended: false })
→ /health (без змін)
→ mount: /, /requests, /clients, /devices, /works (роутери)
→ 404 handler → 500 handler
→ listen(PORT)
```

## 7. package.json

`"dependencies"`: `+ "pug": "3.0.4"` (точний pin, як решта). Інше — без змін.

# Специфікація сторінок і контролерів (Lab 2)

Детальна спека веб-шару: кожна сторінка — маршрут, дані (Prisma-запит),
розкладка, поведінка, крайові випадки. Документ є джерелом правди для
реалізації; разом із `DATA_MODEL.md` (модель) і `PLAN.md` (кроки) замикає
завдання «контролери та представлення».


> **Аудит 2026-10-18:** поведінкові виправлення (HTTP-статуси помилок, автор дії = виконавець, 400 на заборонений перехід, дата за моментом запиту) — див. `DECISIONS.md`, розділ «Аудит коректності»; автотести — `scripts/lab5-smoke.ps1`.
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
| GET | `/requests/new` | `requests.createForm` | форма створення |
| POST | `/requests` | `requests.create` | створення (транзакція) |
| GET | `/requests/:id` | `requests.show` | картка заявки |
| POST | `/requests/:id/transition` | `requests.transition` | перехід статусу |
| GET | `/requests/:id/edit` | `requests.editForm` | форма редагування |
| POST | `/requests/:id/edit` | `requests.edit` | збереження |
| GET | `/requests/:id/delete` | `requests.confirmRemove` | сторінка підтвердження видалення |
| POST | `/requests/:id/delete` | `requests.remove` | soft delete → `/requests` |
| POST | `/requests/:id/works` | `requests.addWork` | додати роботу з каталогу |
| POST | `/requests/:id/works/:lineId/delete` | `requests.removeWork` | видалити рядок роботи |
| POST | `/requests/:id/parts` | `requests.addPart` | додати запчастину з каталогу |
| POST | `/requests/:id/parts/:lineId/delete` | `requests.removePart` | видалити рядок запчастини |
| POST | `/requests/:id/diagnostics` | `requests.saveDiagnostics` | upsert діагностики (Lab 3) |
| POST | `/requests/:id/estimate` | `requests.saveEstimate` | створити/оновити оцінку (Lab 3) |
| POST | `/requests/:id/estimate/approve` | `requests.approveEstimate` | затвердити оцінку (Lab 3) |
| POST | `/requests/:id/estimate/reject` | `requests.rejectEstimate` | відхилити оцінку (Lab 3) |
| POST | `/requests/:id/invoice` | `requests.createInvoice` | видати рахунок (Lab 3) |
| POST | `/requests/:id/payments` | `requests.addPayment` | додати платіж (Lab 3) |
| POST | `/requests/:id/warranty` | `requests.saveWarranty` | upsert гарантії (Lab 3) |
| POST | `/requests/:id/comments` | `requests.addComment` | додати коментар (Lab 3) |
| POST | `/requests/:id/attachments` | `requests.addAttachment` | завантажити вкладення (Lab 3) |
| GET | `/uploads/*` | (статика, `express.static`) | збережені вкладення (Lab 3) |
| GET | `/clients` | `clients.index` | список клієнтів |
| GET | `/clients/:id` | `clients.show` | картка клієнта |
| GET | `/clients/new` | `clients.createForm` | форма створення (Lab 3) |
| POST | `/clients` | `clients.create` | створення → картка (Lab 3) |
| GET | `/clients/:id/edit` | `clients.editForm` | форма редагування (Lab 3) |
| POST | `/clients/:id/edit` | `clients.edit` | збереження → картка (Lab 3) |
| GET | `/devices` | `devices.index` | список пристроїв |
| GET | `/devices/:id` | `devices.show` | картка пристрою |
| GET | `/devices/new` | `devices.createForm` | форма створення (Lab 3) |
| POST | `/devices` | `devices.create` | створення → картка (Lab 3) |
| GET | `/devices/:id/edit` | `devices.editForm` | форма редагування (Lab 3) |
| POST | `/devices/:id/edit` | `devices.edit` | збереження → картка (Lab 3) |
| GET | `/works` | `works.index` | каталог робіт |
| GET | `/works/new` | `works.createForm` | форма створення (Lab 3) |
| POST | `/works` | `works.create` | створення → список (Lab 3) |
| GET | `/works/:id/edit` | `works.editForm` | форма редагування (Lab 3) |
| POST | `/works/:id/edit` | `works.edit` | збереження → список (Lab 3) |
| GET | `/parts` | `parts.index` | каталог запчастин (Lab 3) |
| GET | `/parts/new` | `parts.createForm` | форма створення (Lab 3) |
| POST | `/parts` | `parts.create` | створення → список (Lab 3) |
| GET | `/parts/:id/edit` | `parts.editForm` | форма редагування (Lab 3) |
| POST | `/parts/:id/edit` | `parts.edit` | збереження → список (Lab 3) |
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
- **Scroll-restore (D43):** кінець `layout.pug` — inline-script: при submit будь-якої форми
  зберігає в `sessionStorage` URL + viewport-offset цієї форми; після повернення
  (redirect/re-render) на ту саму сторінку (≤60 с) прокручує до тієї ж позиції —
  без стрибка на початок.

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
4. Кнопка «Створити заявку» → `/requests/new`.

**Крайові випадки:** порожня БД → картки з 0, блок «Поки немає заявок» + кнопка створення.

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

**Розкладка (секції, D42 — інтерактивні форми прямо на картці):**
1. **Шапка:** `h1` номер; бейджі статус/тип/пріоритет; мета: створено (дата, менеджер
   `createdBy`), майстер `assignedTo` (або «не призначено»); кнопки:
   - «Редагувати» (primary) → `/requests/:id/edit`;
   - «Статус:» + по кнопці на кожен `nextStatuses(status)` → форма POST `/requests/:id/transition` (схований `status`);
   - «Видалити» (червона, `margin-left:auto`) → `GET /requests/:id/delete` (сторінка підтвердження).
   - банер, якщо `?error=transition`: «Недозволений перехід статусів».
2. **Клієнт:** ім'я (посилання `/clients/:id`), телефон, email, адреса.
3. **Пристрій:** тип (UA), brand model (посилання `/devices/:id`), серійний №, характеристики, дата покупки.
4. **Опис:** `description` або «—».
5. **Гарантійне посилання** (тільки якщо `originalRequest`): всередині картки-секції —
   «Оригінальний ремонт: [номер] · статус: … · клієнт: …» (номер — посилання; D43).
6. **Діагностика** (1—1 із заявкою, upsert): таблиця `Дата | Висновки | Вартість, ₴`
   (якщо є) + форма: майстер (select техніків), дата (default today), висновки*, вартість,
   нотатки → `POST /requests/:id/diagnostics` (валідація: висновки ≥ 2 символи; cost ≥ 0, ≤ 2 знака).
7. **Роботи:** форма-рядок `select#newWork` (роботи каталогу, в опціях `data-price`/`data-hours`)
    + поля «Сума, ₴» / «Години» (JS-префіл з каталогу) + кнопка «Додати роботу»
    (POST `/requests/:id/works`); таблиця `Робота | Години | Майстер | Статус | Сума | ×`
    + «Разом за роботи: Σ cost»; × — форма POST `/requests/:id/works/:lineId/delete`.
8. **Запчастини:** форма-рядок `select#newPart` (запчастини каталогу, `data-price`)
    + «К-сть» / «Ціна, ₴» + кнопка «Додати запчастину» (POST `/requests/:id/parts`);
    таблиця `Запчастина | SKU | К-сть | Ціна | Сума | ×`
    + «Разом за запчастини: Σ qty×price»; × — POST `/requests/:id/parts/:lineId/delete`.
9. **Оцінка** (1—1): бейдж статусу (Чорновик/Затверджена/Відхилена), Σ робіт, Σ запчастин,
   **разом**, дата/автор затвердження. Кнопки (поки не APPROVED): «Затвердити»
   (`POST /requests/:id/estimate/approve`), «Відхилити» (`POST /requests/:id/estimate/reject`),
   «Оновити суми» (`POST /requests/:id/estimate` — перерахунок з рядків). Порожня (рядків немає)
   → підказка «Додайте роботи або запчастини».
10. **Рахунок** (1—1): сума, знижка, **до сплати**, статус (Не сплачено/Частково сплачено/Сплачено),
    дата видачі, термін оплати; таблиця платежів `Дата | Сума | Метод | Нотатка`
    + «Оплачено: Σ amount» + форма платежа (amount, method CASH/CARD/BANK) — доки `status ≠ PAID`
    (`POST /requests/:id/payments`; валідація: amount ≤ залишок). Порожня: якщо оцінка APPROVED →
    форма «Видати рахунок» (знижка, термін оплати; `POST /requests/:id/invoice`), інакше —
    підказка «Для рахунку потрібна затверджена оцінка».
11. **Гарантія** (1—1, upsert): строк (днів), період (startDate — endDate), що покриває.
    Форма: термін (select 30/60/90/180/365, default 90), дата початку (default today),
    обсяг → `POST /requests/:id/warranty`.
12. **Коментарі:** список (автор, дата, текст; внутрішні — бейдж «внутрішній»)
    + форма (textarea, checkbox «Внутрішній») → `POST /requests/:id/comments` (text ≥ 2 символи).
13. **Вкладення:** таблиця `Файл | Розмір | Тип | Завантажив` — «Файл» = посилання
    `/uploads/<збережене_имя>`; форма-рядок (file input, `enctype=multipart/form-data`)
    → `POST /requests/:id/attachments` (busboy, ліміт `MAX_UPLOAD_BYTES`, ім'я санітується,
    конфлікт імен → суфікс з часовою міткою).

**Крайові випадки:** відсутня секція → показується стан порожнечі (сірим) або
підказка, чому дію неможливо виконати (напр., рахунок без затвердженої оцінки).
**Обробка 400:** кожна форма секції при помилках сервера ре-рендерить картку з банером помилок,
значення форм зберігаються (D42).

**Видалення заявки** (`GET/POST /requests/:id/delete`):
- GET — окрема сторінка підтвердження: «Видалити заявку <номер>?», кнопки
  «Так, видалити» (POST) та «Скасувати» (→ назад на картку).
- POST — **soft delete** (`deletedAt = now`), заявка зникає зі списків і стає 404;
  `302 → /requests`.
- Не знайдено / вже видалено → 404.

### 4.4 Створення заявки — `GET/POST /requests/new`

**GET (форма):**
- Тип (3), Пріоритет (4, default NORMAL), Опис (textarea, required).
- **Клієнт:** radio «Існуючий» (select з 30, `name — phone`) / «Новий»
  (ім'я*, телефон*, email, адреса).
- **Пристрій:** radio «Існуючий» (select з 45, `brand model — власник.name`,
  кожен option має `data-owner=<client id>`) / «Новий»
  (тип*, бренд*, модель*, серійний №, характеристики, дата покупки).
- **Майстер:** optional select (тільки `role = TECHNICIAN`) + «Не призначено».
- **Гарантійне посилання** (видиме, тільки якщо тип = WARRANTY_CLAIM): select
  завершених заявок (`status = COMPLETED`, `number — client.name`).
- Vanilla JS (в самому шаблоні, ~60 рядків), без фреймворків:
  - показ/сховання блоків «новий клієнт / новий пристрій / гарантія» за radio/select;
  - **фільтр пристроїв за клієнтом**: при виборі клієнта ховаються option'и,
    де `data-owner ≠ clientId`; якщо виділений option сховано — скидає
    `selectedIndex = 0` («Оберіть пристрій…»);
  - **лок для нового клієнта**: при «Новий клієнт» радіо «Існуючий пристрій»
    ховається і вимикається, автоматично стає «Новий пристрій»
    (новий клієнт пристроїв ще не має).

**POST — валідація (контролер, по черзі, збирає ВСІ помилки):**
1. `type`, `priority` — коректні enum.
2. Опис — непорожній (trim).
3. Клієнт: «існуючий» → id існує (і не soft-deleted); «новий» → ім'я + телефон непорожні,
   email — формат, якщо задан.
4. Пристрій: «існуючий» → id існує; «новий» → тип/бренд/модель непорожні,
   дата покупки — минула, не раніше 1990.
5. **Власність:** «новий клієнт» + «існуючий пристрій» → 400
   («Новий клієнт: оберіть «Новий пристрій»»); існуючий пристрій
   → `device.ownerId === clientId`, інакше 400 («Пристрій не належить обраному клієнту»).
6. `WARRANTY_CLAIM` → вибрано `originalRequestId`, заявка існує і `COMPLETED`.
7. Майстер (якщо заданий) → існує.

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
(`ownerId`); новий клієнт завжди лише з новим пристроєм (лок у JS + серверний 400);
двійний submit — не критичний (номер унікальний, гіпотетичний конфлікт → 500,
для ЛР достатньо).

### 4.5 Редагування заявки — `GET/POST /requests/:id/edit`

**Поля форми (редагуються всі суттєві):** Тип (3), Пріоритет (4), Опис (required, 5..500),
Клієнт (select існуючих), Пристрій (select існуючих, `data-owner` + фільтр за клієнтом,
як у 4.4), Майстер (optional, тільки TECHNICIAN), Гарантійне посилання
(видиме, тільки якщо тип = WARRANTY_CLAIM; список — завершених, **крім цієї заявки**
(`NOT: { id }`)).
**Не змінюються:** номер, статус (змінюється кнопками на картці), дати, `createdBy`.

**Валідація (збирає ВСІ помилки):** тип — коректний enum (якщо порожній, зберігається
поточний `r.type`); опис 5..500; пріоритет — enum; клієнт і пристрій обов'язкові
(існують і не soft-deleted); **власність**: `device.ownerId === client.id`, інакше
«Пристрій не належить обраному клієнту»; WARRANTY_CLAIM → вибрано оригінальний ремонт,
той існує, `COMPLETED` і це не сама заявка; майстер (якщо заданий) існує.
Помилки → 400 + повторний рендер зі старими значеннями всіх полів.
Успіх → `prisma.request.update` (type, description, priority, clientId, deviceId,
originalRequestId, assignedToId) → `redirect('/requests/:id')`.
На сторінці форми — кнопка «Видалити» (червона) → `/requests/:id/delete`.

### 4.6 Перехід статусу — `POST /requests/:id/transition`

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
---

# Lab 3 — форми та серверна валідація

Принцип: **жодної атрибута `required`** — браузер не блокує відправку,
валідація виконується виключно в контролерах. Помилки → `400` + повторний
рендер тієї ж форми з `errors: string[]` та `values` (старі значення).
Спільні хелпери — `src/lib/validate.ts`:

| Хелпер | Поведінка |
|---|---|
| `clean(v)` | trim + `String()`; `null`/`undefined` → `""` |
| `toNumber(v)` | число (крапка **або** кома як десятковий роздільник); інакше `null` |
| `tooLong(v, n)` | `true`, якщо довжина > n |
| `isEmail(v)` | regex-перевірка email |
| `isPhone(v)` | базова regex-перевірка (10–15 цифр) |
| `isUaPhone(v)` | телефон UA: `+380` + 9 цифр (12) або `0` + 9 цифр (10), роздільники `( ) - . \t` |
| `maxDecimals(v, max)` | `true`, якщо після коми/крапки не більше `max` знаків (default 2) |
| `MIN_DATE` | константа `1990-01-01` (дати раніше 1990 року неприпустимі) |
| `parseDateOnly(v)` | `YYYY-MM-DD` → **UTC-опівночі** (D34); інакше `null` |
| `isUniqueViolation(err)` | `P2002` (Prisma) — fallback на race-умови |

## L3-1. Клієнти — `GET/POST /clients/new`, `GET/POST /clients/:id/edit`

**Поля:** Ім'я/назва (обов'язкове, 2–100), Телефон (обов'язковий, UA-формат),
Email (опц., ≤320, формат + унікальність), Адреса (опц., ≤200), Нотатки (опц., ≤500).

**Помилки:** «Вкажіть ім'я / назву», «Ім'я / назва: мінімум 2 символи», «Вкажіть телефон»,
«Телефон: +380 + 9 цифр (напр., +380671234501) або 0 + 9 цифр (напр., 0671234501)»,
«Email: некоректний формат», «Email: до 320 символів», «Email вже використовується іншим клієнтом».

**Унікальність email** — `findFirst({ where: { email: { equals: email, mode: "insensitive" }, deletedAt: null, ...(id && { id: { not: id } }) } })`.

**Успіх:** create → `redirect('/clients/:id')`; edit → `redirect('/clients/:id')`.

## L3-2. Пристрої — `GET/POST /devices/new`, `GET/POST /devices/:id/edit`

**Поля:** Тип (select з 8 значень, обов'язковий), Бренд (обов'язковий, 2–100),
Модель (обов'язкова, 2–100), Серійний № (опц., ≤100), Specs (опц., ≤200),
Дата покупки (опц., `YYYY-MM-DD`, не в майбутньому, не раніше 1990), Власник (select клієнтів, обов'язковий).

**Помилки:** «Оберіть тип пристрою», «Вкажіть бренд», «Бренд: мінімум 2 символи»,
«Вкажіть модель», «Модель: мінімум 2 символи», «Оберіть власника (клієнта)»,
«Дата покупки: не може бути в майбутньому», «Дата покупки: не може бути раніше 1990 року»,
«Дата покупки: некоректний формат (YYYY-MM-DD)».

**Дата:** `parseDateOnly` → UTC-опівночі (D34); форма редагування рендерить
`toISOString().slice(0, 10)` — round-trip без зсуву.

**Успіх:** create → `redirect('/devices/:id')` (картка, D33); edit → `redirect('/devices/:id')`.

## L3-3. Роботи — `GET/POST /works/new`, `GET/POST /works/:id/edit`

**Поля:** Назва (обов'язкова, 2–100, **унікальна**), Базова ціна (обов'язкова,
число > 0, ≤ 99 999 999.99, до 2 знаків після коми), Години (обов'язкові, число > 0, ≤ 1000, до 2 знаків після коми), Опис (опц., ≤500).

**Помилки:** «Вкажіть назву роботи», «Назва: мінімум 2 символи», «Вкажіть базову ціну (число)»,
«Базова ціна має бути більшою за 0», «Базова ціна: не більше 2 знаків після коми», «Базова ціна: занадто велика»,
«Вкажіть тривалість у годинах (число)», «Тривалість має бути більшою за 0», «Тривалість: не більше 2 знаків після коми», «Тривалість: занадто велика»,
«Робота з такою назвою вже існує» (і create, і edit; у edit — self-exclusion по id).

**Успіх:** create → `redirect('/works')`; edit → `redirect('/works')` (карток немає).

## L3-4. Запчастини — `GET /parts`, `GET/POST /parts/new`, `GET/POST /parts/:id/edit`

**Список:** `findMany({ orderBy: { name: "asc" } })` (15 рядків у seed, без пагінації).
Таблиця: `Запчастина | SKU | Ціна | Дії (Редагувати, Видалити)`.

**Поля:** Назва (обов'язкова, 2–100), SKU (опц., 2–50, латиниця/цифри/«-», перший символ — літера або цифра, **унікальний**),
Ціна (обов'язкова, число > 0, ≤ 99 999 999.99, до 2 знаків після коми).

**Помилки:** «Вкажіть назву запчастини», «Назва запчастини: мінімум 2 символи», «Вкажіть ціну (число)»,
«Ціна має бути більшою за 0», «Ціна: не більше 2 знаків після коми», «Ціна: занадто велика»,
«SKU: 2–50 символів, латинські літери/цифри/«-», перший — літера або цифра», «SKU вже використовується» (і create, і edit; у edit — self-exclusion по id).

**Успіх:** create → `redirect('/parts')`; edit → `redirect('/parts')`.

## L3-5. Навігація

У шапці (partials/header) — пункти: Головна, Заявки, Клієнти, Пристрої, Роботи,
**Запчастини** (`nav="parts"`). Кнопки «Нова запчастина» / «Додати роботу» /
«Новий клієнт» / «Новий пристрій» — на відповідних списках.

## L3-6. Видалення — `POST /:id/delete` (клієнти, пристрої, роботи, запчастини)

UI: кнопка `Видалити` (`.btn-danger`) — у списках (колонка «Дії») і на картках/формах
редагування; це посилання на **сторінку підтвердження** `GET /modul/:id/delete`
(спільний шаблон `confirm-delete.pug`: підсумок запису, кнопка «Так, видалити» —
POST без даних, «Скасувати»). Браузерного `confirm()` немає (D39).

| Модуль | Стратегія | Успіх | Помилки |
|---|---|---|---|
| Клієнти | **soft delete** (`deletedAt`): рядок лишається в БД, зникає зі всіх списків/карток; зв'язані пристрої/заявки зберігаються | `302` → `/clients` | `404` — не існує або вже видалений |
| Пристрої | **soft delete** (`deletedAt`) | `302` → `/devices` | `404` — не існує або вже видалений |
| Роботи | **hard delete**; `RequestWork.catalogId` → `null` (snapshot `name/price/hours` у заявках зберігається) | `302` → `/works` | `404` — не існує |
| Запчастини | **hard delete**; якщо `RequestPart` посилається на запчастину → відмова | `302` → `/parts` | `400` + рендер `/parts` із повідомленням «Запчастину не можна видалити, бо вона використовується в заявках»; `404` — не існує |

Soft delete клієнтів/пристроїв обирається тому, що це — учасники історії заявок:
видалення не повинне ламати `Request.clientId`/`Device.ownerId` (NULL-заборона в моделі,
D2). Hard delete каталогів — безпечний, бо snapshot'и значень у `RequestWork`/`RequestPart`
не залежать від довідника.

## L3-7. Секції картки заявки та вкладення (D42)

Дев'ять нових POST-роутів на картці заявки (подробиці розкладки — у §4.3):
`/diagnostics`, `/estimate`, `/estimate/approve`, `/estimate/reject`, `/invoice`,
`/payments`, `/warranty`, `/comments`, `/attachments` (префікс `/requests/:id`).

- **Діагностика** — upsert 1—1: висновки ≥ 2 символи, вартість ≥ 0 (до 2 знаків),
  майстер (select техніків, порожньо = не вказано), дата (default today, `parseDateOnly`).
- **Оцінка** — створюється/оновлюється з рядків заяви (Σ робіт + Σ запчастин, `round2`);
  approve/reject — лише доки не APPROVED / не REJECTED; повторна дія → 400.
- **Рахунок** — тільки з затвердженої оцінки; знижка ≤ total оцінки; повторна видача → 400.
  Платежі: `amount > 0`, `amount ≤ залишок` (finalTotal − Σ оплат); статус рахунку
  переглядається при кожному платежі (UNPAID/PARTIAL/PAID, І5).
- **Гарантія** — upsert 1—1: термін з `{30, 60, 90, 180, 365}`, дата початку
  (default today), endDate = start + periodDays (І6).
- **Коментарі** — text ≥ 2 символи, флаг `isInternal`.
- **Вкладення** — `busboy` (multipart, `limits.fileSize = MAX_UPLOAD_BYTES`); без файлу → 400;
  ім'я санітується (без шляхів/пробілів), конфлікт → суфікс `-HHMMSSxxx`; файл — у каталозі
  `uploads/` (named volume в Docker), віддається статикою `GET /uploads/*`
  (заголовок `Content-Disposition: attachment` не потрібен — це матеріали заявки).
- **Обробка 400 в усіх формах:** `renderShow` з банером помилок; значення форм
  (`diagValues` та ін.) зберігаються; рядки/оцінка/рахунок — без змін.
- **D43 (картка):** текст «Оригінальний ремонт: …» рендериться всередині секції
  «Гарантійне посилання» (був сестринським елементом `</section>` — виправлено indent pug);
  scroll-restore після submit форми (inline-script у `layout.pug`, sessionStorage).

**Docker:** `uploads/` створюється в образі (`RUN mkdir -p` + `chown node:node` **до**
`USER node`) і прив'язується named volume — власність сідає з образу. `.dockerignore`
виключає `uploads/` з контексту збірки.

Усі правила валідації, секції картки та операції видалення повністю покриті автоматизованим E2E-тестом `scripts/lab3-e2e.sh` (186/186 перевірок; percent-encoding даних — argv-транскодування Git-Bash ламає raw UTF-8 в `curl -d`).

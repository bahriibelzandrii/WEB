# Модель даних: Сервіс ремонту та обслуговування комп'ютерної техніки

Повна спека: 9 enum, 15 сутностей, зв'язки, статусна машина, інваріанти, seed-спека.
Реалізація — Prisma 7 + PostgreSQL 18.

## Конвенції

| Конвенція | Правило |
|---|---|
| Ідентифікатори | `String @id @default(cuid())` |
| Гроші | `Decimal @db.Decimal(10,2)`, валюта — UAH (валюта окремо не моделюється) |
| Аудит | `createdAt DateTime @default(now())` скрізь; `updatedAt DateTime @updatedAt` — на «живих» сутностях (не на історичних записів: Payment, Comment, RequestPart, FileAttachment) |
| Soft delete | `deletedAt DateTime?` **лише** на `Client`, `Device`, `Request` |
| Enum | нативні enum PostgreSQL |
| FK-поведінка | `onDelete: Restrict` (без каскадів — захист від випадкового видалення) |
| Спрощення | назви полів/таблиць — англійською, описи — українською |

---

## Enum (9)

| Enum | Значення | Призначення |
|---|---|---|
| `Role` | `ADMIN`, `TECHNICIAN`, `CLIENT`, `VISITOR` | ролі користувачів (Lab 4: `MANAGER` → `CLIENT`, додано `VISITOR`) |
| `DeviceType` | `PC`, `LAPTOP`, `MONITOR`, `PHONE`, `TABLET`, `PRINTER`, `OTHER` | типи техніки |
| `RequestStatus` | `NEW`, `IN_DIAGNOSTICS`, `ESTIMATE_READY`, `IN_REPAIR`, `READY`, `COMPLETED`, `CANCELED` | життєвий цикл заявки |
| `RequestType` | `REPAIR`, `MAINTENANCE`, `WARRANTY_CLAIM` | ремонт / обслуговування / гарантійне звернення |
| `Priority` | `LOW`, `NORMAL`, `HIGH`, `URGENT` | пріоритет виконання |
| `WorkStatus` | `PENDING`, `IN_PROGRESS`, `DONE` | статус роботи в заявці |
| `EstimateStatus` | `DRAFT`, `APPROVED`, `REJECTED` | статус оцінки |
| `InvoiceStatus` | `UNPAID`, `PARTIAL`, `PAID` | статус оплати рахунку |
| `PaymentMethod` | `CASH`, `CARD`, `BANK_TRANSFER` | спосіб оплати |

---

## Сутності (15)

### 1. User — користувач (персонал, клієнт, відвідувач)

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| name | String | NOT NULL | ПІБ |
| email | String | NOT NULL, UNIQUE | логін |
| password | String | NOT NULL | bcrypt-хеш |
| phone | String | NULL | |
| role | Role | NOT NULL, default `CLIENT` | |
| createdAt / updatedAt | DateTime | NOT NULL | аудит |

**Зв'язки:** створює `Request` (createdBy), призначений на `Request` (assignedTo),
виконує `RequestWork`, `Diagnostics`, автор `Comment`, завантажує `FileAttachment`,
створює `Estimate`.

### 2. Client — клієнт (особа чи компанія)

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| name | String | NOT NULL | ім'я / назва компанії |
| phone | String | NOT NULL | основний контакт |
| email | String | NULL, UNIQUE | |
| address | String | NULL | |
| notes | String | NULL | |
| userId | String | NULL, UNIQUE, FK→User, `ON DELETE SET NULL` | Lab 4: акаунт власника («мої замовлення») |
| createdAt / updatedAt | DateTime | NOT NULL | |
| deletedAt | DateTime | NULL | soft delete |

**Зв'язки:** володіє `Device` (1—N), має `Request` (1—N), необов'язково має акаунт `User` (1—0..1, Lab 4).

### 3. Device — конкретний прилад клієнта

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| type | DeviceType | NOT NULL | |
| brand | String | NOT NULL | |
| model | String | NOT NULL | |
| serialNumber | String | NULL, index | серійний номер |
| specs | String | NULL | характеристики текстом (CPU/RAM/…) |
| purchasedAt | DateTime | NULL | дата покупки клієнтом |
| ownerId | String | NOT NULL, FK→Client | власник |
| createdAt / updatedAt | DateTime | NOT NULL | |
| deletedAt | DateTime | NULL | soft delete |

**Зв'язки:** `owner → Client` (N—1), `requests: Request[]` (1—N) — **історія приладу**.

### 4. Request — заявка (центр моделі)

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| number | String | NOT NULL, UNIQUE | формат `R-YYYY-NNNN`, генерується в шарі додатка |
| type | RequestType | NOT NULL | |
| status | RequestStatus | NOT NULL, default `NEW`, index | |
| priority | Priority | NOT NULL, default `NORMAL` | |
| description | String | NULL | опис проблеми / що обслуговати |
| clientId | String | NOT NULL, FK→Client, index | |
| deviceId | String | NOT NULL, FK→Device, index | **одна заявка = один прилад** |
| originalRequestId | String | NULL, FK→Request (self) | для `WARRANTY_CLAIM`: на який ремонт скаржимося |
| createdById | String | NOT NULL, FK→User | автор заявки |
| assignedToId | String | NULL, FK→User | головний майстер |
| createdAt / updatedAt | DateTime | NOT NULL | |
| deletedAt | DateTime | NULL | soft delete |

**Зв'язки (1—N, якщо не вказано інше):** `client`, `device`, `originalRequest` (self, N—1),
`diagnostics` (1—1), `works: RequestWork[]`, `parts: RequestPart[]`, `estimate` (1—1),
`invoice` (1—1), `warranty` (1—1), `comments: Comment[]`, `attachments: FileAttachment[]`.

> Обмеження «`WARRANTY_CLAIM` ⇒ `originalRequestId ≠ null`» — на рівні додатка
> (Prisma не підтримує умовні NOT NULL).

### 5. Diagnostics — діагностика (1—1 із заявкою)

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| requestId | String | NOT NULL, UNIQUE, FK→Request | |
| technicianId | String | NULL, FK→User | хто діагностував |
| date | DateTime | NOT NULL, default now | |
| findings | String | NOT NULL | виявлені несправності |
| cost | Decimal(10,2) | NOT NULL, default 0 | вартість діагностики |
| notes | String | NULL | |
| createdAt / updatedAt | DateTime | NOT NULL | |

### 6. WorkCatalog — прайс-лист робіт

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| name | String | NOT NULL, UNIQUE | назва роботи |
| description | String | NULL | |
| basePrice | Decimal(10,2) | NOT NULL | базова ціна |
| baseHours | Float | NOT NULL, default 1 | орієнтовний час, год |
| createdAt / updatedAt | DateTime | NOT NULL | |

**Зв'язки:** `requestWorks: RequestWork[]` (1—N).

### 7. RequestWork — робота в заявці

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| requestId | String | NOT NULL, FK→Request, index | |
| catalogId | String | NULL, FK→WorkCatalog | зв'язок із прайсом |
| name | String | NOT NULL | **снапшот** назви |
| cost | Decimal(10,2) | NOT NULL | **снапшот** ціни |
| hours | Float | NOT NULL | фактичний/плановий час |
| technicianId | String | NULL, FK→User | хто виконує |
| status | WorkStatus | NOT NULL, default `PENDING` | |
| createdAt / updatedAt | DateTime | NOT NULL | |

### 8. Part — каталог запчастин (без складу)

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| name | String | NOT NULL | |
| sku | String | NULL, UNIQUE | артикул |
| price | Decimal(10,2) | NOT NULL | поточна ціна |
| createdAt / updatedAt | DateTime | NOT NULL | |

**Зв'язки:** `requestParts: RequestPart[]` (1—N).

### 9. RequestPart — запчастини в заявці

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| requestId | String | NOT NULL, FK→Request, index | |
| partId | String | NOT NULL, FK→Part | |
| quantity | Int | NOT NULL, default 1, **≥ 1** | |
| unitPrice | Decimal(10,2) | NOT NULL | **снапшот** ціни на момент заявки |
| createdAt | DateTime | NOT NULL | |

**Обмеження:** `UNIQUE(requestId, partId)` — одна позиція на запчастину в заявці.

### 10. Estimate — оцінка (1—1 із заявкою)

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| requestId | String | NOT NULL, UNIQUE, FK→Request | |
| status | EstimateStatus | NOT NULL, default `DRAFT` | |
| totalWorks | Decimal(10,2) | NOT NULL, default 0 | Σ робіт |
| totalParts | Decimal(10,2) | NOT NULL, default 0 | Σ запчастин |
| total | Decimal(10,2) | NOT NULL | загальна сума |
| createdById | String | NOT NULL, FK→User | |
| approvedAt | DateTime | NULL | |
| createdAt / updatedAt | DateTime | NOT NULL | |

**Зв'язки:** `invoice: Invoice?` (1—1).

### 11. Invoice — рахунок (1—1 із заявкою)

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| requestId | String | NOT NULL, UNIQUE, FK→Request | |
| estimateId | String | NULL, UNIQUE, FK→Estimate | з якої оцінки видано |
| total | Decimal(10,2) | NOT NULL | сума до знижки |
| discount | Decimal(10,2) | NOT NULL, default 0 | знижка (≥ 0) |
| finalTotal | Decimal(10,2) | NOT NULL | до сплати |
| status | InvoiceStatus | NOT NULL, default `UNPAID` | |
| issueDate | DateTime | NOT NULL, default now | |
| dueDate | DateTime | NULL | термін оплати |
| createdAt / updatedAt | DateTime | NOT NULL | |

**Зв'язки:** `payments: Payment[]` (1—N).

### 12. Payment — оплата (історичний запис)

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| invoiceId | String | NOT NULL, FK→Invoice, index | |
| amount | Decimal(10,2) | NOT NULL, **> 0** | |
| method | PaymentMethod | NOT NULL | |
| paidAt | DateTime | NOT NULL, default now | |
| note | String | NULL | |
| createdAt | DateTime | NOT NULL | |

> Часткові оплати дозволені; `Σ amount ≤ finalTotal` — інваріант на рівні додатка.

### 13. Warranty — гарантія на ремонт (1—1 із завершеною заявкою)

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| requestId | String | NOT NULL, UNIQUE, FK→Request | |
| periodDays | Int | NOT NULL, **> 0** | |
| startDate | DateTime | NOT NULL | |
| endDate | DateTime | NOT NULL | = startDate + periodDays |
| scope | String | NULL | що покриває гарантія |
| createdAt | DateTime | NOT NULL | |

### 14. Comment — коментар до заявки

| Поле | Тип | Обмеження | Опис |
|---||---|---|
| id | String | PK, cuid | |
| requestId | String | NOT NULL, FK→Request, index | |
| authorId | String | NOT NULL, FK→User | |
| text | String | NOT NULL | |
| isInternal | Boolean | NOT NULL, default `true` | видимість: службовий / клієнту |
| createdAt | DateTime | NOT NULL | |

### 15. FileAttachment — файл до заявки (фото дефектів, документи)

| Поле | Тип | Обмеження | Опис |
|---|---|---|---|
| id | String | PK, cuid | |
| requestId | String | NOT NULL, FK→Request, index | |
| fileName | String | NOT NULL | |
| filePath | String | NOT NULL | шлях до файлу на диску/в сховищі |
| mimeType | String | NULL | |
| size | Int | NULL | байти |
| uploadedById | String | NOT NULL, FK→User | |
| createdAt | DateTime | NOT NULL | |

---

## Зв'язки (повний список)

| Від | До | Кардинальність | Зміст |
|---|---|---|---|
| Client | Device | 1—N | власник приладу |
| Client | Request | 1—N | клієнт заявки |
| Device | Request | 1—N | історія приладу (кожна заявка — на один прилад) |
| User | Request | 1—N | createdBy / assignedTo (окремі FK) |
| Request | Diagnostics | 1—0..1 | |
| Request | RequestWork | 1—N | |
| WorkCatalog | RequestWork | 1—N | |
| Request | RequestPart | 1—N | |
| Part | RequestPart | 1—N | |
| Request | Estimate | 1—0..1 | |
| Request | Invoice | 1—0..1 | |
| Estimate | Invoice | 1—0..1 | |
| Invoice | Payment | 1—N | |
| Request | Warranty | 1—0..1 | |
| Request | Comment | 1—N | |
| User | Comment | 1—N | author |
| Request | FileAttachment | 1—N | |
| User | FileAttachment | 1—N | uploadedBy |
| Request | Request | N—1 (self) | originalRequest (гарантійні звернення) |

## Статусна машина заявки

```
NEW ──▶ IN_DIAGNOSTICS ──▶ ESTIMATE_READY ──▶ IN_REPAIR ──▶ READY ──▶ COMPLETED
 │            │                   │                │            │
 └────────────┴───────────────────┴────────────────┴────────────┴──▶ CANCELED
```

- Дозволені переходи: лише «вперед» по ланцюгу + `CANCELED` з будь-якого
  некінцевого стану.
- Кінцеві: `COMPLETED`, `CANCELED`.
- Типові бізнес-дії по статусах:
  - `NEW` → прийнято, призначено майстра;
  - `IN_DIAGNOSTICS` → створюється `Diagnostics`;
  - `ESTIMATE_READY` → створюється `Estimate` (DRAFT), чекаємо рішення клієнта;
  - `IN_REPAIR` → `Estimate.APPROVED`, видається `Invoice`, додаються `RequestWork`/`RequestPart`;
  - `READY` → роботи DONE, рахунок сплатжений;
  - `COMPLETED` → створюється `Warranty`.

## Інваріанти (перевіряє `scripts/check-invariants.ts`)

| # | Інваріант |
|---|---|
| І1 | `Estimate.total = Estimate.totalWorks + Estimate.totalParts` |
| І2 | `Estimate.totalWorks = Σ RequestWork.cost` по заявці |
| І3 | `Estimate.totalParts = Σ (RequestPart.quantity × RequestPart.unitPrice)` по заявці |
| І4 | `Invoice.finalTotal = Invoice.total − Invoice.discount` |
| І5 | `Invoice.status`: `UNPAID` ⇔ Σ Payment = 0; `PARTIAL` ⇔ 0 < Σ < finalTotal; `PAID` ⇔ Σ ≥ finalTotal |
| І6 | `Warranty.endDate = Warranty.startDate + periodDays` |
| І7 | `Request.type = WARRANTY_CLAIM` ⇒ `originalRequestId ≠ null` |
| І8 | `RequestPart.quantity ≥ 1` |
| І9 | `Invoice.discount ≥ 0`, `Invoice.finalTotal ≥ 0`, `Payment.amount > 0` |
| І10 | Активні записи мають `deletedAt = null`; `Request.number` унікальний |

## Seed-спека

| Сутність | Кількість | Примітки |
|---|---|---|
| User | 5 | 1 admin, 1 client, 2 technician, 1 visitor (пароль `Secret123`) |
| Client | 30 | 8 «ручних» (фізособи + компанії) + 22 згенерованих |
| Device | 45 | 12 «ручних» + 33 згенерованих; усі 7 типів DeviceType, у кожного — власник |
| WorkCatalog | 14 | діагностика, чистка від пилу, заміна термопасты, збірка ПК, встановлення ОС, заміна SSD/RAM, діагностика живлення тощо |
| Part | 15 | SSD, RAM, термопаста, БЖ, клавіатура, тачпад, екран, акумулятор, шнур тощо |
| Request | 60 | 15 «ручних» (покриття всіх статусів/типів/пріоритетів) + 45 згенерованих; усі 7 статусів, 3 типи, 4 пріоритети |
| Diagnostics | 49 | для всіх заявок, що пройшли стадію NEW |
| RequestWork | 134 | 0–4 на заявку |
| RequestPart | 52 | 0–3 на заявку |
| Estimate | 43 | для заявок від ESTIMATE_READY і далі; DRAFT для ESTIMATE_READY, APPROVED для решти |
| Invoice | 37 | для APPROVED-оцінок (IN_REPAIR/READY/COMPLETED) |
| Payment | 30 | поєднання повних і часткових оплат, усі 3 методи |
| Warranty | 22 | на COMPLETED-заявки (periodDays 30/60/90/180/365) |
| Comment | 68 | 0–2 на заявку, mix internal/клієнтських |
| FileAttachment | 21 | метадані (фото дефектів, акт приймання) |

Вимога: seed **будує** інваріанти І1–І10 у коді (суми — з позицій, не «від руки»). 45 додаткових заявок (крім 15 «ручних») генерує детермінований PRNG (mulberry32, seed=20260914) — повторний запуск дає однаковий набір даних.

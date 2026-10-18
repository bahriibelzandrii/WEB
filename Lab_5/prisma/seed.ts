/**
 * Seed: реалістичні дані сервісу ремонту комп'ютерної техніки.
 *
 * Ідемпотентний: на початку очищає таблиці у порядку FK.
 * Інваріанти І1–І10 (docs/DATA_MODEL.md) БУДУЮТЬСЯ в коді:
 *  - суми Estimate/Invoice — з позицій, а не «від руки»;
 *  - Warranty.endDate = startDate + periodDays;
 *  - Invoice.status — з сум платежів.
 *
 * Дані = 15 «ручних» заявок (покриття всіх статусів/типів/приоритетів)
 * + детермінований генератор (seeded PRNG) ще 45 заявок. Повторний запуск
 * дає однаковий результат.
 *
 * Кількості (приблизно, генератор детермінований):
 * User 4, Client 30, Device 45, WorkCatalog 14, Part 15,
 * Request 60, Diagnostics ~49, Estimate ~40, Invoice ~33,
 * Warranty ~23, Comment ~60, FileAttachment ~21.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// --------------------------- Справочники ---------------------------

// bcrypt("secret", 10) — демонстраційний пароль усього персоналу (Lab 4, README)
const BCRYPT_HASH = "$2b$10$cPgQ3oHXll8gUieZ4e3hp.ZVQUiGwX8a/NGaEsCvJeqPKHp8uXVLq";

const USERS = [
 { name: "Адміністратор Системи", email: "admin@service.ua", role: "ADMIN" as const, phone: "+380441000001" },
 { name: "Олена Коваленко", email: "manager@service.ua", role: "MANAGER" as const, phone: "+380441000002" },
 { name: "Ігор Мельник", email: "tech1@service.ua", role: "TECHNICIAN" as const, phone: "+380441000003" },
 { name: "Сергій Бондар", email: "tech2@service.ua", role: "TECHNICIAN" as const, phone: "+380441000004" },
 { name: "Відвідувач Сервісу", email: "visitor@service.ua", role: "VISITOR" as const, phone: "+380441000005" },
];

const CLIENTS = [
 { name: "Петро Шевченко", phone: "+380671234501", email: "p.shevchenko@example.com", address: "м. Київ, вул. Богатирська, 10" },
 { name: "Марія Гнатюк", phone: "+380671234502", email: "m.hnatyuk@example.com", address: "м. Київ, вул. Терещенка, 5" },
 { name: "Андрій Кравець", phone: "+380671234503", email: "a.kravets@example.com", address: "м. Київ, вул. Десняnska, 22" },
 { name: "Оксана Лисенко", phone: "+380671234504", email: "o.lysenko@example.com", address: "м. Бровари, вул. Садова, 3" },
 { name: "Тарас Романюк", phone: "+380671234505", email: "t.romaniuk@example.com", address: "м. Київ, вул. Січова, 14" },
 { name: "ТОВ «ТехноСфера»", phone: "+380442000006", email: "office@technosphere.ua", address: "м. Київ, вул. Промислова, 1" },
 { name: "Людмила Савчук", phone: "+380671234507", email: "l.savchuk@example.com", address: "м. Ірпінь, вул. Центральна, 8" },
 { name: "Володимир Полтавець", phone: "+380671234508", email: "v.poltavets@example.com", address: "м. Київ, вул. Солом'янська, 30" },
];

const DEVICES = [
 { type: "LAPTOP" as const, brand: "Lenovo", model: "ThinkPad T14", serialNumber: "LNV-T14-2023-001", specs: "i5-1235U, 16GB, SSD 512GB", ownerIdx: 0, purchasedAt: "2023-02-10" },
 { type: "PC" as const, brand: "ASUS", model: "ExpertCenter D7", serialNumber: "ASU-D7-2022-114", specs: "i7-11700, 32GB, SSD 1TB", ownerIdx: 1, purchasedAt: "2022-06-15" },
 { type: "LAPTOP" as const, brand: "Apple", model: "MacBook Air M1", serialNumber: "APL-MBA-2021-077", specs: "M1, 8GB, SSD 256GB", ownerIdx: 2, purchasedAt: "2021-11-01" },
 { type: "MONITOR" as const, brand: "LG", model: "27MP75Q-B", serialNumber: "LG-27MP75Q-2023-220", specs: '27" FullHD 75Hz', ownerIdx: 3, purchasedAt: "2023-01-20" },
 { type: "PHONE" as const, brand: "Apple", model: "iPhone 12", serialNumber: "APL-IP12-2022-301", specs: "128GB", ownerIdx: 4, purchasedAt: "2022-03-05" },
 { type: "LAPTOP" as const, brand: "Acer", model: "Aspire 5", serialNumber: "ACR-A5-2024-015", specs: "R5-5500U, 8GB, SSD 512GB", ownerIdx: 5, purchasedAt: "2024-01-12" },
 { type: "PC" as const, brand: "MSI", model: "Pro DP M2BE", serialNumber: "MSI-M2BE-2021-089", specs: "i5-10400, 16GB, SSD 512GB", ownerIdx: 6, purchasedAt: "2021-08-30" },
 { type: "TABLET" as const, brand: "Apple", model: "iPad 9", serialNumber: "APL-IPAD9-2023-140", specs: "64GB, Wi-Fi", ownerIdx: 7, purchasedAt: "2023-05-18" },
 { type: "LAPTOP" as const, brand: "HP", model: "Pavilion 15", serialNumber: "HP-PV15-2022-055", specs: "i5-1135G7, 16GB, SSD 512GB", ownerIdx: 1, purchasedAt: "2022-09-14" },
 { type: "PHONE" as const, brand: "Samsung", model: "Galaxy A54", serialNumber: "SAM-A54-2024-210", specs: "128GB", ownerIdx: 2, purchasedAt: "2024-04-02" },
 { type: "PRINTER" as const, brand: "Epson", model: "L3210", serialNumber: "EPS-L3210-2023-033", specs: "МФУ чорнильний", ownerIdx: 5, purchasedAt: "2023-03-22" },
 { type: "LAPTOP" as const, brand: "Dell", model: "Inspiron 15", serialNumber: "DELL-INS15-2021-066", specs: "i5-1035G1, 8GB, SSD 256GB", ownerIdx: 0, purchasedAt: "2021-04-11" },
];

const WORK_CATALOG = [
 { name: "Діагностика", basePrice: 500, baseHours: 1 },
 { name: "Чистка від пилу + заміна термопасты", basePrice: 800, baseHours: 1.5 },
 { name: "Заміна акумулятора", basePrice: 1200, baseHours: 1 },
 { name: "Заміна SSD", basePrice: 600, baseHours: 1 },
 { name: "Заміна RAM", basePrice: 500, baseHours: 0.5 },
 { name: "Встановлення ОС", basePrice: 700, baseHours: 1.5 },
 { name: "Заміна екрана/матриці", basePrice: 1500, baseHours: 2 },
 { name: "Заміна клавіатури", basePrice: 900, baseHours: 1 },
 { name: "Заміна блоку живлення", basePrice: 1000, baseHours: 1 },
 { name: "Заміна шлейфа", basePrice: 700, baseHours: 1 },
 { name: "Відновлення даних", basePrice: 2000, baseHours: 3 },
 { name: "Заміна матриці (швидка)", basePrice: 1300, baseHours: 1.5 },
 { name: "Настройка мережевого обладнання", basePrice: 850, baseHours: 1 },
 { name: "Установка драйверів та оновлення", basePrice: 450, baseHours: 1 },
];

const PARTS = [
 { name: "Акумулятор Lenovo T14", sku: "BAT-LNV-T14", price: 2500 },
 { name: "SSD Samsung 970 EVO 500GB", sku: "SSD-SAM-970-500", price: 2100 },
 { name: "RAM DDR4 16GB", sku: "RAM-DDR4-16", price: 1400 },
 { name: "SSD Kingston A400 256GB", sku: "SSD-KIN-A400-256", price: 950 },
 { name: "Термопаста Arctic MX-4", sku: "PST-ARC-MX4", price: 250 },
 { name: "Блок живлення 500W", sku: "PSU-500W", price: 1800 },
 { name: "Кліявський екран 15.6\"", sku: "SCR-156-FHD", price: 3200 },
 { name: "Клавіатура (модуль)", sku: "KBD-MOD-15", price: 1100 },
 { name: "Шлейф матриці", sku: "CBL-LCD-15", price: 600 },
 { name: "Акумулятор MacBook Air M1", sku: "BAT-APL-MBA", price: 4200 },
 { name: "Вентилятор охолодження", sku: "FAN-NB-STD", price: 700 },
 { name: "Блок живлення ноутбук 65W", sku: "PSU-NB-65W", price: 900 },
 { name: "Термопрокладки", sku: "THM-PRO-SET", price: 150 },
 { name: "Кнопка вмикача", sku: "BTN-POW-NB", price: 300 },
 { name: "SSD WD Blue 1TB", sku: "SSD-WD-1TB", price: 3400 },
];

// --------------------------- Заявки (ручні, 15) ---------------------------
// idx: 0..14 => R-2026-0001..R-2026-0015

interface SeedWork { workIdx: number; cost: number; hours: number; techIdx: number; status: "PENDING" | "IN_PROGRESS" | "DONE" }
interface SeedPart { partIdx: number; qty: number; unitPrice: number }

interface RequestSeed {
 type: "REPAIR" | "MAINTENANCE" | "WARRANTY_CLAIM";
 status: "NEW" | "IN_DIAGNOSTICS" | "ESTIMATE_READY" | "IN_REPAIR" | "READY" | "COMPLETED" | "CANCELED";
 priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
 clientIdx: number;
 deviceIdx: number;
 originalIdx: number | null;
 description: string;
 createdAt: string;
 assignedTechIdx: number | null; // 0/1 => users[2]/users[3]
 works: SeedWork[];
 parts: SeedPart[];
}

const HAND_REQUESTS: RequestSeed[] = [
 {
  type: "WARRANTY_CLAIM", status: "NEW", priority: "NORMAL", clientIdx: 7, deviceIdx: 7, originalIdx: 12,
  description: "Знову не тримає заряд після гарантійного ремонту",
  createdAt: "2026-09-02T10:00:00Z", assignedTechIdx: 0,
  works: [], parts: [],
 },
 {
  type: "MAINTENANCE", status: "NEW", priority: "LOW", clientIdx: 5, deviceIdx: 5, originalIdx: null,
  description: "Планове обслуговування офісного ПК",
  createdAt: "2026-09-10T09:00:00Z", assignedTechIdx: null,
  works: [], parts: [],
 },
 {
  type: "REPAIR", status: "IN_DIAGNOSTICS", priority: "HIGH", clientIdx: 1, deviceIdx: 8, originalIdx: null,
  description: "Розряджається за день, гріється",
  createdAt: "2026-09-08T09:30:00Z", assignedTechIdx: 0,
  works: [
   { workIdx: 0, cost: 500, hours: 1, techIdx: 0, status: "DONE" },
   { workIdx: 13, cost: 450, hours: 1, techIdx: 0, status: "IN_PROGRESS" },
  ],
  parts: [{ partIdx: 9, qty: 1, unitPrice: 350 }],
 },
 {
  type: "REPAIR", status: "IN_DIAGNOSTICS", priority: "NORMAL", clientIdx: 2, deviceIdx: 2, originalIdx: null,
  description: "Чорний екран, індикатор мерехтить",
  createdAt: "2026-09-09T11:00:00Z", assignedTechIdx: 1,
  works: [{ workIdx: 0, cost: 500, hours: 1, techIdx: 1, status: "DONE" }],
  parts: [],
 },
 {
  type: "MAINTENANCE", status: "ESTIMATE_READY", priority: "NORMAL", clientIdx: 3, deviceIdx: 3, originalIdx: null,
  description: "Мерехтить екран, іноді не виводить зображення",
  createdAt: "2026-09-05T13:00:00Z", assignedTechIdx: 0,
  works: [
   { workIdx: 1, cost: 800, hours: 1.5, techIdx: 0, status: "PENDING" },
   { workIdx: 3, cost: 600, hours: 1, techIdx: 0, status: "PENDING" },
  ],
  parts: [{ partIdx: 2, qty: 1, unitPrice: 1400 }],
 },
 {
  type: "REPAIR", status: "ESTIMATE_READY", priority: "HIGH", clientIdx: 4, deviceIdx: 4, originalIdx: null,
  description: "Не заряджається, гніздо не тримає",
  createdAt: "2026-09-06T10:00:00Z", assignedTechIdx: 0,
  works: [
   { workIdx: 0, cost: 500, hours: 1, techIdx: 0, status: "DONE" },
   { workIdx: 9, cost: 700, hours: 1, techIdx: 0, status: "PENDING" },
  ],
  parts: [{ partIdx: 11, qty: 1, unitPrice: 900 }],
 },
 {
  type: "REPAIR", status: "IN_REPAIR", priority: "URGENT", clientIdx: 5, deviceIdx: 5, originalIdx: null,
  description: "Обірваний шлейф клавіатури, потрібна заміна",
  createdAt: "2026-09-02T09:00:00Z", assignedTechIdx: 0,
  works: [
   { workIdx: 0, cost: 500, hours: 1, techIdx: 0, status: "DONE" },
   { workIdx: 8, cost: 1000, hours: 1, techIdx: 0, status: "IN_PROGRESS" },
   { workIdx: 3, cost: 600, hours: 1, techIdx: 0, status: "PENDING" },
  ],
  parts: [
   { partIdx: 7, qty: 1, unitPrice: 1100 },
   { partIdx: 8, qty: 1, unitPrice: 600 },
  ],
 },
 {
  type: "REPAIR", status: "IN_REPAIR", priority: "NORMAL", clientIdx: 6, deviceIdx: 6, originalIdx: null,
  description: "Не вмикається, іскріння живлення",
  createdAt: "2026-09-03T14:00:00Z", assignedTechIdx: 1,
  works: [
   { workIdx: 0, cost: 500, hours: 1, techIdx: 1, status: "DONE" },
   { workIdx: 6, cost: 1500, hours: 2, techIdx: 1, status: "IN_PROGRESS" },
  ],
  parts: [{ partIdx: 6, qty: 1, unitPrice: 3200 }],
 },
 {
  type: "MAINTENANCE", status: "IN_REPAIR", priority: "LOW", clientIdx: 0, deviceIdx: 0, originalIdx: null,
  description: "Планове обслуговування, гріється",
  createdAt: "2026-09-04T10:00:00Z", assignedTechIdx: 1,
  works: [
   { workIdx: 1, cost: 800, hours: 1.5, techIdx: 1, status: "DONE" },
   { workIdx: 13, cost: 450, hours: 1, techIdx: 1, status: "IN_PROGRESS" },
  ],
  parts: [{ partIdx: 4, qty: 1, unitPrice: 250 }],
 },
 {
  type: "REPAIR", status: "READY", priority: "HIGH", clientIdx: 1, deviceIdx: 8, originalIdx: null,
  description: "Заміна акумулятора ноутбука",
  createdAt: "2026-08-28T12:00:00Z", assignedTechIdx: 0,
  works: [
   { workIdx: 0, cost: 500, hours: 1, techIdx: 0, status: "DONE" },
   { workIdx: 2, cost: 1200, hours: 1, techIdx: 0, status: "DONE" },
  ],
  parts: [{ partIdx: 9, qty: 1, unitPrice: 4200 }],
 },
 {
  type: "REPAIR", status: "READY", priority: "NORMAL", clientIdx: 0, deviceIdx: 11, originalIdx: null,
  description: "Заміна SSD + встановлення ОС",
  createdAt: "2026-08-29T09:00:00Z", assignedTechIdx: 1,
  works: [
   { workIdx: 3, cost: 600, hours: 1, techIdx: 1, status: "DONE" },
   { workIdx: 5, cost: 700, hours: 1.5, techIdx: 1, status: "DONE" },
  ],
  parts: [{ partIdx: 3, qty: 1, unitPrice: 950 }],
 },
 {
  type: "REPAIR", status: "COMPLETED", priority: "NORMAL", clientIdx: 6, deviceIdx: 6, originalIdx: null,
  description: "Не вмикається, замінено БЖ",
  createdAt: "2026-08-15T10:00:00Z", assignedTechIdx: 0,
  works: [
   { workIdx: 0, cost: 500, hours: 1, techIdx: 0, status: "DONE" },
   { workIdx: 8, cost: 1000, hours: 1, techIdx: 0, status: "DONE" },
  ],
  parts: [{ partIdx: 5, qty: 1, unitPrice: 1800 }],
 },
 {
  type: "MAINTENANCE", status: "COMPLETED", priority: "LOW", clientIdx: 0, deviceIdx: 0, originalIdx: null,
  description: "Чистка + термопаста + оновлення",
  createdAt: "2026-08-10T11:00:00Z", assignedTechIdx: 1,
  works: [
   { workIdx: 1, cost: 800, hours: 1.5, techIdx: 1, status: "DONE" },
   { workIdx: 13, cost: 450, hours: 1, techIdx: 1, status: "DONE" },
  ],
  parts: [{ partIdx: 4, qty: 1, unitPrice: 250 }],
 },
 {
  type: "REPAIR", status: "COMPLETED", priority: "HIGH", clientIdx: 4, deviceIdx: 4, originalIdx: null,
  description: "Заміна акумулятора iPhone",
  createdAt: "2026-08-05T15:00:00Z", assignedTechIdx: 0,
  works: [
   { workIdx: 0, cost: 500, hours: 1, techIdx: 0, status: "DONE" },
   { workIdx: 2, cost: 1200, hours: 1, techIdx: 0, status: "DONE" },
  ],
  parts: [{ partIdx: 9, qty: 1, unitPrice: 4200 }],
 },
 {
  type: "REPAIR", status: "CANCELED", priority: "LOW", clientIdx: 3, deviceIdx: 3, originalIdx: null,
  description: "Клієнт відкликав техніку",
  createdAt: "2026-09-05T16:00:00Z", assignedTechIdx: null,
  works: [{ workIdx: 0, cost: 500, hours: 1, techIdx: 0, status: "DONE" }],
  parts: [],
 },
];

const HAND_DIAGNOSTICS: Array<{ reqIdx: number; techIdx: number; date: string; findings: string; cost: number }> = [
 { reqIdx: 2, techIdx: 0, date: "2026-09-09T12:00:00Z", findings: "Акумулятор деградований (412 циклів). Рекомендована заміна.", cost: 500 },
 { reqIdx: 3, techIdx: 1, date: "2026-09-10T12:00:00Z", findings: "Шлейф цілий, підозра на контролер яскравості. Потрібен замір живлення матриці.", cost: 500 },
 { reqIdx: 4, techIdx: 1, date: "2026-09-06T12:00:00Z", findings: "Система брудна, tCPU 89°C під навантаженням. SSD на 92% заповнений.", cost: 0 },
 { reqIdx: 5, techIdx: 0, date: "2026-09-06T15:00:00Z", findings: "Акумулятор не тримає заряд, контролер живлення працює.", cost: 500 },
 { reqIdx: 6, techIdx: 0, date: "2026-09-02T13:00:00Z", findings: "Шлейф клавіатури обірваний, потрібна заміна модуля. RAM і SSD працюють.", cost: 500 },
 { reqIdx: 7, techIdx: 1, date: "2026-09-03T14:00:00Z", findings: "Ємність акумулятора 87%. Заміна бажана.", cost: 500 },
 { reqIdx: 8, techIdx: 1, date: "2026-09-04T16:00:00Z", findings: "Засмічення каналів охолодження, засохла термопаста.", cost: 0 },
 { reqIdx: 9, techIdx: 0, date: "2026-08-28T15:00:00Z", findings: "Акумулятор знос 64%, контролери живлення цілі.", cost: 500 },
 { reqIdx: 10, techIdx: 1, date: "2026-08-29T12:00:00Z", findings: "SSD повільний (HDD), рекомендована заміна на SSD.", cost: 500 },
];

const HAND_ESTIMATES: Array<{ reqIdx: number; status: "DRAFT" | "APPROVED" | "REJECTED"; approvedAt: string | null }> = [
 { reqIdx: 4, status: "DRAFT", approvedAt: null },
 { reqIdx: 5, status: "DRAFT", approvedAt: null },
 { reqIdx: 6, status: "APPROVED", approvedAt: "2026-09-03T10:00:00Z" },
 { reqIdx: 7, status: "APPROVED", approvedAt: "2026-09-04T09:00:00Z" },
 { reqIdx: 8, status: "APPROVED", approvedAt: "2026-09-05T11:00:00Z" },
 { reqIdx: 9, status: "APPROVED", approvedAt: "2026-08-29T09:00:00Z" },
 { reqIdx: 10, status: "APPROVED", approvedAt: "2026-08-30T10:00:00Z" },
 { reqIdx: 11, status: "APPROVED", approvedAt: "2026-08-16T10:00:00Z" },
 { reqIdx: 12, status: "APPROVED", approvedAt: "2026-08-11T10:00:00Z" },
 { reqIdx: 13, status: "APPROVED", approvedAt: "2026-08-06T10:00:00Z" },
];

const HAND_INVOICES: Array<{
 reqIdx: number;
 discount: number;
 issueDate: string;
 payments: Array<{ amount: number; method: "CASH" | "CARD" | "BANK_TRANSFER"; paidAt: string }>;
}> = [
  { reqIdx: 6, discount: 0, issueDate: "2026-09-03T12:00:00Z", payments: [{ amount: 2000, method: "CARD", paidAt: "2026-09-03T13:00:00Z" }] },
  { reqIdx: 7, discount: 300, issueDate: "2026-09-04T12:00:00Z", payments: [{ amount: 4000, method: "CARD", paidAt: "2026-09-04T14:00:00Z" }] },
  { reqIdx: 8, discount: 0, issueDate: "2026-09-05T12:00:00Z", payments: [] },
  {
   reqIdx: 9, discount: 500, issueDate: "2026-08-30T12:00:00Z", payments: [
    { amount: 3000, method: "CARD", paidAt: "2026-08-30T15:00:00Z" },
    { amount: 2200, method: "CASH", paidAt: "2026-09-01T10:00:00Z" },
   ]
  },
  { reqIdx: 10, discount: 0, issueDate: "2026-08-31T12:00:00Z", payments: [{ amount: 2250, method: "CARD", paidAt: "2026-09-01T11:00:00Z" }] },
  { reqIdx: 11, discount: 0, issueDate: "2026-08-18T12:00:00Z", payments: [{ amount: 2800, method: "BANK_TRANSFER", paidAt: "2026-08-19T10:00:00Z" }] },
  { reqIdx: 12, discount: 200, issueDate: "2026-08-12T12:00:00Z", payments: [{ amount: 1050, method: "CASH", paidAt: "2026-08-13T09:00:00Z" }] },
  { reqIdx: 13, discount: 0, issueDate: "2026-08-08T12:00:00Z", payments: [{ amount: 5900, method: "CARD", paidAt: "2026-08-09T12:00:00Z" }] },
 ];

const HAND_WARRANTIES: Array<{ reqIdx: number; periodDays: number; startDate: string; scope: string }> = [
 { reqIdx: 11, periodDays: 90, startDate: "2026-08-20", scope: "Блок живлення та виконані роботи" },
 { reqIdx: 12, periodDays: 60, startDate: "2026-08-15", scope: "Виконані роботи (гарантія на роботу)" },
 { reqIdx: 13, periodDays: 180, startDate: "2026-08-10", scope: "Акумулятор та виконані роботи" },
];

const HAND_COMMENTS: Array<{ reqIdx: number; authorIdx: number; text: string; isInternal: boolean }> = [
 { reqIdx: 0, authorIdx: 0, text: "Гарантійна заявка, перевірити попередній ремонт (R-2026-0013).", isInternal: true },
 { reqIdx: 1, authorIdx: 1, text: "Заявку прийнято, техніку передано на обслуговування.", isInternal: false },
 { reqIdx: 2, authorIdx: 0, text: "Клієнт просив прискорити, пріоритет підвищено.", isInternal: false },
 { reqIdx: 2, authorIdx: 2, text: "Діагностика завершена, акумулятор під заміну.", isInternal: true },
 { reqIdx: 3, authorIdx: 3, text: "Потрібен замір живлення матриці, чекаю інструменти.", isInternal: true },
 { reqIdx: 4, authorIdx: 1, text: "Оцінку надіслано клієнту на затвердження.", isInternal: false },
 { reqIdx: 5, authorIdx: 0, text: "Очікуємо затвердження оцінки клієнтом.", isInternal: false },
 { reqIdx: 6, authorIdx: 2, text: "Замовлено запчастини (клавіатура, шлейф), очікування поставки.", isInternal: true },
 { reqIdx: 6, authorIdx: 1, text: "Клієнт затвердив оцінку, приступаємо до ремонту.", isInternal: false },
 { reqIdx: 7, authorIdx: 3, text: "Заміна екрана, матриця замовлена.", isInternal: true },
 { reqIdx: 8, authorIdx: 1, text: "Планове обслуговування, чистка виконана.", isInternal: false },
 { reqIdx: 9, authorIdx: 2, text: "Роботи виконано, тестування акумулятора.", isInternal: true },
 { reqIdx: 9, authorIdx: 1, text: "Готово до видачі, чекаємо оплату.", isInternal: false },
 { reqIdx: 10, authorIdx: 3, text: "SSD встановлено, ОС встановлена.", isInternal: true },
 { reqIdx: 11, authorIdx: 2, text: "БЖ замінено, тест під навантаженням пройшов.", isInternal: true },
 { reqIdx: 11, authorIdx: 1, text: "Ремонт завершено, надано гарантію 90 днів.", isInternal: false },
 { reqIdx: 12, authorIdx: 3, text: "Чистка та термопаста виконані, tCPU 62°C.", isInternal: true },
 { reqIdx: 13, authorIdx: 2, text: "Акумулятор замінено, циклість 0.", isInternal: true },
 { reqIdx: 13, authorIdx: 1, text: "Готово, клієнта повідомлено.", isInternal: false },
 { reqIdx: 14, authorIdx: 1, text: "Клієнт відкликав техніку, заявку скасовано.", isInternal: false },
 { reqIdx: 6, authorIdx: 2, text: "Залишок по роботі 1600 грн, чекаємо на частину платежу.", isInternal: true },
];

const HAND_ATTACHMENTS: Array<{ reqIdx: number; fileName: string; mimeType: string; size: number; uploadedByIdx: number }> = [
 { reqIdx: 2, fileName: "laptop_batter.jpg", mimeType: "image/jpeg", size: 245760, uploadedByIdx: 2 },
 { reqIdx: 3, fileName: "monitor_stripes.jpg", mimeType: "image/jpeg", size: 312320, uploadedByIdx: 3 },
 { reqIdx: 5, fileName: "ipad_charging.jpg", mimeType: "image/jpeg", size: 198656, uploadedByIdx: 2 },
 { reqIdx: 6, fileName: "keyboard_fail.jpg", mimeType: "image/jpeg", size: 276480, uploadedByIdx: 2 },
 { reqIdx: 11, fileName: "act_acceptance_0012.pdf", mimeType: "application/pdf", size: 87040, uploadedByIdx: 1 },
 { reqIdx: 14, fileName: "act_acceptance_0015.pdf", mimeType: "application/pdf", size: 78848, uploadedByIdx: 1 },
];

// --------------------------- Детермінований генератор ---------------------------

// mulberry32 — малий детермінований PRNG (однаковий seed => однакові дані).
function mulberry32(seed: number) {
 let a = seed | 0;
 return function() {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
 };
}
const rand = mulberry32(20260914);
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }
function randInt(min: number, max: number): number { return min + Math.floor(rand() * (max - min + 1)); }

const FIRST_NAMES = ["Володимир", "Ольга", "Дмитро", "Наталія", "Андрій", "Юлія", "Максим", "Ірина", "Олег", "Тетяна", "Сергій", "Катерина", "Олексій", "Світлана", "Роман", "Анна", "Віктор", "Марина", "Денис", "Оксана", "Павло", "Вікторія", "Микола", "Євгенія", "Богдан", "Софія", "Іван", "Аліна", "Григорій", "Лариса"];
const LAST_NAMES = ["Бондаренко", "Ткаченко", "Коваленко", "Шевченко", "Мельник", "Бойко", "Кравченко", "Петренко", "Гриценко", "Савченко", "Поліщук", "Литвин", "Дорошенко", "Савчук", "Козак", "Марченко", "Руденко", "Киселів", "Мороз", "Заруба", "Козловський", "Гнатюк", "Лисенко", "Романюк", "Терещенко", "Василенко", "Гаврилюк", "Соловей", "Кравчук", "Паламарчук"];
const CITIES = ["м. Київ", "м. Львів", "м. Дніпро", "м. Одеса", "м. Харків", "м. Вінниця", "м. Бровари", "м. Ірпінь", "м. Бориспіль", "м. Мостиська"];
const STREETS = ["вул. Шевська", "вул. Садова", "вул. Проспект Свободи", "вул. Лесі Українки", "вул. Грушевського", "вул. Чорновола", "вул. Франка", "вул. Січова", "вул. Хрещатик", "вул. Володимирська"];

const GEN_CLIENT_COUNT = 22;
const GEN_CLIENTS = Array.from({ length: GEN_CLIENT_COUNT }, (_, i) => ({
 name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
 phone: `+38067${String(1000000 + i * 7919)}`,
 email: `client${i + 9}@example.com`,
 address: `${pick(CITIES)}, ${pick(STREETS)}, ${randInt(1, 120)}`,
}));
const ALL_CLIENTS = [...CLIENTS, ...GEN_CLIENTS];

type DeviceType = "PC" | "LAPTOP" | "MONITOR" | "PHONE" | "TABLET" | "PRINTER" | "OTHER";
const DEVICE_TEMPLATES: Array<{ type: DeviceType; brands: Array<[string, string]>; specs: string[] }> = [
 { type: "PC", brands: [["ASUS", "ExpertCenter D5"], ["Dell", "OptiPlex 3080"], ["Lenovo", "V330"], ["HP", "ProDesk 400"], ["MSI", "Pro DP M2"]], specs: ["i5-12400, 16GB, SSD 512GB", "i3-10100, 8GB, SSD 256GB", "Ryzen 5, 16GB, SSD 512GB", "i7-11700, 32GB, SSD 1TB"] },
 { type: "LAPTOP", brands: [["Lenovo", "ThinkPad E14"], ["ASUS", "Vivobook 15"], ["Acer", "Aspire 5"], ["HP", "Pavilion 15"], ["Dell", "Inspiron 15"], ["MSI", "Thin 15"]], specs: ["i5-1135G7, 16GB, SSD 512GB", "Ryzen 7, 16GB, SSD 512GB", "i7-1260P, 16GB, SSD 1TB", "R5-5500U, 8GB, SSD 256GB"] },
 { type: "MONITOR", brands: [["LG", "27MP75Q"], ["Samsung", "C27G55"], ["Dell", "S2722D"], ["ASUS", "VA27EQE"], ["BenQ", "GW2755"]], specs: ['27" FullHD 75Hz', '27" 1440p 144Hz', '24" FullHD 100Hz', '32" 4K 60Hz'] },
 { type: "PHONE", brands: [["Apple", "iPhone 12"], ["Samsung", "Galaxy A54"], ["Xiaomi", "Redmi Note 12"], ["Apple", "iPhone 11"], ["Google", "Pixel 6"]], specs: ["128GB", "256GB", "64GB", "512GB"] },
 { type: "TABLET", brands: [["Apple", "iPad 9"], ["Samsung", "Galaxy Tab A8"], ["Lenovo", "Tab M10"]], specs: ["64GB, Wi-Fi", "128GB, Wi-Fi"] },
 { type: "PRINTER", brands: [["Epson", "L3210"], ["HP", "DeskJet 2720"], ["Canon", "MX494"], ["Brother", "DCP-T420W"]], specs: ["МФУ", "принтер", "МФУ чорнильний"] },
 { type: "OTHER", brands: [["Logitech", "K380"], ["Logitech", "Pebble 2"], ["Apple", "Magic Mouse"], ["Razer", "DeathAdder"]], specs: ["клавіатура", "миша", "бездротова миша", "ігрова миша"] },
];

const GEN_DEVICE_COUNT = 33;
const GEN_DEVICES = Array.from({ length: GEN_DEVICE_COUNT }, (_, i) => {
 const tpl = DEVICE_TEMPLATES[i % DEVICE_TEMPLATES.length];
 const [brand, model] = tpl.brands[(i * 3) % tpl.brands.length];
 return {
  type: tpl.type,
  brand,
  model,
  serialNumber: `${brand.slice(0, 3).toUpperCase()}-${tpl.type}-${2020 + (i % 6)}-${1000 + i * 37}`,
  specs: tpl.specs[(i * 7) % tpl.specs.length],
  ownerIdx: i % ALL_CLIENTS.length,
  purchasedAt: `${2021 + (i % 5)}-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + ((i * 5) % 28)).padStart(2, "0")}`,
 };
});
const ALL_DEVICES = [...DEVICES, ...GEN_DEVICES];

const DESCRIPTIONS = [
 "Не вмикається",
 "Сильно гріється і гальмує",
 "Не тримає заряд",
 "Чорний екран після увімкнення",
 "Шумлять вентилятори, іскріння",
 "Не знаходить Wi-Fi",
 "Смуги та тріщини на екрані",
 "Не читає SSD, втрачає дані",
 "Не працює клавіатура/тачпад",
 "Швидко сідає акумулятор",
 "Планове обслуговування, чистка",
 "Встановити нову ОС",
 "Не друкує, заклинило папір",
 "Не заряджається, гніздо не тримає",
 "Потрібне оновлення RAM/SSD",
 "Миготіння індикатора живлення",
 "Повільна робота, багато помилок",
 "Не вмикається після пострілу",
];

const FINDINGS = [
 "Апаратних несправностей не виявлено, рекомендовано заміну БЖ.",
 "Деградація акумулятора (високий % зносу), потрібна заміна.",
 "Перегрів: засохла термопаста, заблокований вентилятор пилом.",
 "SSD на межі зносу (S.M.A.R.T. WARNING), рекомендована заміна.",
 "Обірваний шлейф, потрібна заміна модуля.",
 "Блок живлення не тримає навантаження, заміна.",
 "RAM працює нестабільно, замінено планку на тестову.",
 "ОС нестабільна, рекомендовано чисту встановлення.",
 "Матриця ціла, проблема в контролері яскравості.",
 "Живлення стабільне, проблема в програмному забезпеченні.",
];

const WARRANTY_SCOPES = [
 "Замінений вузол та виконані роботи",
 "Акумулятор та виконані роботи",
 "Блок живлення та виконані роботи",
 "Екран/матриця та виконані роботи",
 "Виконані роботи (гарантія на роботу)",
];

const COMMENT_TEXTS = [
 "Заявку прийнято, техніку передано в роботу.",
 "Оцінку надіслано клієнту на затвердження.",
 "Клієнт затвердив оцінку, приступаємо до ремонту.",
 "Замовлено запчастини, очікування поставки.",
 "Роботи виконано, тестування.",
 "Готово до видачі, чекаємо оплату.",
 "Клієнта повідомлено про готовність.",
 "Ремонт завершено, надано гарантію.",
 "Клієнт просив прискорити, пріоритет підвищено.",
 "Очікуємо підтвердження клієнта.",
];

function pickType(): RequestSeed["type"] {
 const r = rand();
 return r < 0.7 ? "REPAIR" : r < 0.9 ? "MAINTENANCE" : "WARRANTY_CLAIM";
}
function pickStatus(): RequestSeed["status"] {
 const r = rand();
 if (r < 0.40) return "COMPLETED";
 if (r < 0.56) return "IN_REPAIR";
 if (r < 0.67) return "READY";
 if (r < 0.78) return "ESTIMATE_READY";
 if (r < 0.89) return "IN_DIAGNOSTICS";
 if (r < 0.98) return "NEW";
 return "CANCELED";
}
function pickPriority(): RequestSeed["priority"] {
 const r = rand();
 return r < 0.2 ? "LOW" : r < 0.7 ? "NORMAL" : r < 0.9 ? "HIGH" : "URGENT";
}
function pickMethod(): "CASH" | "CARD" | "BANK_TRANSFER" {
 const r = rand();
 return r < 0.4 ? "CASH" : r < 0.8 ? "CARD" : "BANK_TRANSFER";
}

function addDays(iso: string, days: number): string {
 const d = new Date(iso);
 d.setUTCDate(d.getUTCDate() + days);
 return d.toISOString();
}

function randDateForStatus(status: RequestSeed["status"]): string {
 let start: string, end: string;
 if (status === "COMPLETED") { start = "2026-01-05"; end = "2026-08-20"; }
 else if (status === "READY" || status === "IN_REPAIR") { start = "2026-08-01"; end = "2026-09-08"; }
 else if (status === "ESTIMATE_READY") { start = "2026-08-15"; end = "2026-09-10"; }
 else { start = "2026-09-01"; end = "2026-09-13"; }
 const s = new Date(start).getTime();
 const e = new Date(end).getTime();
 return new Date(s + rand() * (e - s)).toISOString();
}

function genWorks(status: RequestSeed["status"]): SeedWork[] {
 if (status === "NEW") return [];
 let count: number;
 if (status === "CANCELED") count = randInt(0, 1);
 else if (status === "IN_DIAGNOSTICS") count = randInt(1, 2);
 else if (status === "ESTIMATE_READY") count = randInt(2, 3);
 else count = randInt(2, 4);
 const works: SeedWork[] = [];
 const used = new Set<number>();
 for (let i = 0; i < count; i++) {
  let workIdx: number;
  do { workIdx = randInt(0, WORK_CATALOG.length - 1); } while (used.has(workIdx));
  used.add(workIdx);
  const w = WORK_CATALOG[workIdx];
  let wStatus: SeedWork["status"];
  if (status === "COMPLETED" || status === "READY" || status === "CANCELED") wStatus = "DONE";
  else if (status === "ESTIMATE_READY") wStatus = "PENDING";
  else {
   const r = rand();
   wStatus = r < 0.4 ? "DONE" : r < 0.7 ? "IN_PROGRESS" : "PENDING";
  }
  works.push({ workIdx, cost: w.basePrice, hours: w.baseHours, techIdx: randInt(0, 1), status: wStatus });
 }
 return works;
}

function genParts(status: RequestSeed["status"]): SeedPart[] {
 if (status === "NEW" || status === "CANCELED") return [];
 let count: number;
 if (status === "IN_DIAGNOSTICS") count = randInt(0, 1);
 else if (status === "ESTIMATE_READY") count = randInt(1, 3);
 else count = randInt(0, 2);
 const parts: SeedPart[] = [];
 const used = new Set<number>();
 for (let i = 0; i < count; i++) {
  let partIdx: number;
  do { partIdx = randInt(0, PARTS.length - 1); } while (used.has(partIdx));
  used.add(partIdx);
  parts.push({ partIdx, qty: randInt(1, 2), unitPrice: PARTS[partIdx].price });
 }
 return parts;
}

// Генерує 45 додаткових заявок (idx 15..59) + пов'язані записи.
// completedPool — індекси COMPLETED заявок, доступні як original для warranty_claim.
function generateRequests(startIdx: number, count: number, completedPool: number[]) {
 const requests: RequestSeed[] = [];
 const diagnostics: Array<{ reqIdx: number; techIdx: number; date: string; findings: string; cost: number }> = [];
 const estimates: Array<{ reqIdx: number; status: "DRAFT" | "APPROVED" | "REJECTED"; approvedAt: string | null }> = [];
 const invoices: Array<{ reqIdx: number; discount: number; issueDate: string; payments: Array<{ amount: number; method: "CASH" | "CARD" | "BANK_TRANSFER"; paidAt: string }> }> = [];
 const warranties: Array<{ reqIdx: number; periodDays: number; startDate: string; scope: string }> = [];
 const comments: Array<{ reqIdx: number; authorIdx: number; text: string; isInternal: boolean }> = [];
 const attachments: Array<{ reqIdx: number; fileName: string; mimeType: string; size: number; uploadedByIdx: number }> = [];

 for (let i = 0; i < count; i++) {
  const reqIdx = startIdx + i;
  const type = pickType();
  const status = pickStatus();
  const priority = pickPriority();
  const clientIdx = randInt(0, ALL_CLIENTS.length - 1);
  const ownedDeviceIdxs = ALL_DEVICES.map((d, j) => (d.ownerIdx === clientIdx ? j : -1)).filter((j) => j >= 0);
  const deviceIdx = ownedDeviceIdxs[randInt(0, ownedDeviceIdxs.length - 1)];
  const createdAt = randDateForStatus(status);
  const assignedTechIdx = (status === "NEW" || status === "CANCELED") ? (rand() < 0.5 ? null : randInt(0, 1)) : randInt(0, 1);
  const works = genWorks(status);
  const parts = genParts(status);

  let originalIdx: number | null = null;
  if (type === "WARRANTY_CLAIM" && completedPool.length > 0) {
   originalIdx = pick(completedPool);
  }

  requests.push({ type, status, priority, clientIdx, deviceIdx, originalIdx, description: pick(DESCRIPTIONS), createdAt, assignedTechIdx, works, parts });

  if (status === "COMPLETED" && type !== "WARRANTY_CLAIM") completedPool.push(reqIdx);

  // Діагностика: для всіх, крім NEW та CANCELED
  if (status !== "NEW" && status !== "CANCELED") {
   diagnostics.push({ reqIdx, techIdx: randInt(0, 1), date: addDays(createdAt, randInt(1, 2)), findings: pick(FINDINGS), cost: rand() < 0.5 ? 500 : 0 });
  }

  // Оцінка: ESTIMATE_READY (draft) або APPROVED для IN_REPAIR/READY/COMPLETED
  if (status === "ESTIMATE_READY" || status === "IN_REPAIR" || status === "READY" || status === "COMPLETED") {
   const approved = status !== "ESTIMATE_READY";
   estimates.push({ reqIdx, status: approved ? "APPROVED" : "DRAFT", approvedAt: approved ? addDays(createdAt, randInt(2, 4)) : null });
  }

  // Рахунок: IN_REPAIR/READY/COMPLETED (потребує APPROVED оцінки)
  if (status === "IN_REPAIR" || status === "READY" || status === "COMPLETED") {
   const total = works.reduce((s, w) => s + w.cost, 0) + parts.reduce((s, p) => s + p.qty * p.unitPrice, 0);
   const discount = rand() < 0.7 ? 0 : Math.min(total, Math.round((total * 0.1) / 50) * 50);
   const finalTotal = total - discount;
   const payments: Array<{ amount: number; method: "CASH" | "CARD" | "BANK_TRANSFER"; paidAt: string }> = [];
   if (finalTotal > 0) {
    const fullyPaid = status === "COMPLETED" || (status === "READY" && rand() < 0.6);
    if (fullyPaid) {
     payments.push({ amount: finalTotal, method: pickMethod(), paidAt: addDays(createdAt, randInt(5, 12)) });
    } else if (status === "IN_REPAIR" && rand() < 0.5 && finalTotal >= 2) {
     payments.push({ amount: Math.max(1, Math.min(finalTotal - 1, Math.round(finalTotal * 0.5))), method: pickMethod(), paidAt: addDays(createdAt, randInt(4, 10)) });
    }
   }
   invoices.push({ reqIdx, discount, issueDate: addDays(createdAt, randInt(3, 6)), payments });
  }

  // Гарантія: тільки COMPLETED
  if (status === "COMPLETED") {
   warranties.push({ reqIdx, periodDays: pick([30, 60, 90, 180, 365]), startDate: addDays(createdAt, randInt(6, 12)).slice(0, 10), scope: pick(WARRANTY_SCOPES) });
  }

  // Коментарі
  const nComments = randInt(0, 2);
  for (let c = 0; c < nComments; c++) {
   comments.push({ reqIdx, authorIdx: randInt(0, 3), text: pick(COMMENT_TEXTS), isInternal: rand() < 0.6 });
  }

  // Вкладення
  if (rand() < 0.35) {
   attachments.push({ reqIdx, fileName: `photo_${String(reqIdx).padStart(3, "0")}.jpg`, mimeType: "image/jpeg", size: randInt(100000, 900000), uploadedByIdx: randInt(0, 3) });
  }
 }

 return { requests, diagnostics, estimates, invoices, warranties, comments, attachments };
}

const GEN = generateRequests(HAND_REQUESTS.length, 45, [11, 12, 13]);

const ALL_REQUESTS = [...HAND_REQUESTS, ...GEN.requests];
const ALL_DIAGNOSTICS = [...HAND_DIAGNOSTICS, ...GEN.diagnostics];
const ALL_ESTIMATES = [...HAND_ESTIMATES, ...GEN.estimates];
const ALL_INVOICES = [...HAND_INVOICES, ...GEN.invoices];
const ALL_WARRANTIES = [...HAND_WARRANTIES, ...GEN.warranties];
const ALL_COMMENTS = [...HAND_COMMENTS, ...GEN.comments];
const ALL_ATTACHMENTS = [...HAND_ATTACHMENTS, ...GEN.attachments];

// --------------------------- Логіка ---------------------------

async function main() {
 console.log("Очищення даних...");
 await prisma.fileAttachment.deleteMany({});
 await prisma.comment.deleteMany({});
 await prisma.payment.deleteMany({});
 await prisma.invoice.deleteMany({});
 await prisma.estimate.deleteMany({});
 await prisma.requestPart.deleteMany({});
 await prisma.requestWork.deleteMany({});
 await prisma.diagnostics.deleteMany({});
 await prisma.warranty.deleteMany({});
 await prisma.request.deleteMany({});
 await prisma.device.deleteMany({});
 await prisma.part.deleteMany({});
 await prisma.workCatalog.deleteMany({});
 await prisma.client.deleteMany({});
 await prisma.user.deleteMany({});

 console.log("Співробітники...");
 const users = await Promise.all(
  USERS.map((u) =>
   prisma.user.create({ data: { ...u, password: BCRYPT_HASH } })
  )
 );
 const [admin, manager, tech1, tech2] = users;
 const techs = [tech1, tech2];

 console.log("Клієнти...");
 const clients = await Promise.all(
  ALL_CLIENTS.map((c) =>
   prisma.client.create({ data: { name: c.name, phone: c.phone, email: c.email, address: c.address } })
  )
 );

 console.log("Пристрої...");
 const devices = await Promise.all(
  ALL_DEVICES.map((d) =>
   prisma.device.create({
    data: {
     type: d.type,
     brand: d.brand,
     model: d.model,
     serialNumber: d.serialNumber,
     specs: d.specs,
     owner: { connect: { id: clients[d.ownerIdx].id } },
     purchasedAt: new Date(d.purchasedAt),
    },
   })
  )
 );

 console.log("Каталог робіт...");
 const catalog = await Promise.all(
  WORK_CATALOG.map((w) =>
   prisma.workCatalog.create({ data: { name: w.name, basePrice: w.basePrice, baseHours: w.baseHours } })
  )
 );

 console.log("Запчастини...");
 const parts = await Promise.all(
  PARTS.map((p) =>
   prisma.part.create({ data: { name: p.name, sku: p.sku, price: p.price } })
  )
 );

 console.log(`Заявки (${ALL_REQUESTS.length})...`);
 const requests = await Promise.all(
  ALL_REQUESTS.map((r, i) => {
   const data: Record<string, unknown> = {
    number: `R-2026-${String(i + 1).padStart(4, "0")}`,
    type: r.type,
    status: r.status,
    priority: r.priority,
    description: r.description,
    client: { connect: { id: clients[r.clientIdx].id } },
    device: { connect: { id: devices[r.deviceIdx].id } },
    createdBy: { connect: { id: manager.id } },
    createdAt: new Date(r.createdAt),
    works: {
     create: r.works.map((w) => ({
      catalog: { connect: { id: catalog[w.workIdx].id } },
      name: WORK_CATALOG[w.workIdx].name,
      cost: w.cost,
      hours: w.hours,
      technician: { connect: { id: techs[w.techIdx].id } },
      status: w.status,
     })),
    },
    parts: {
     create: r.parts.map((p) => ({
      part: { connect: { id: parts[p.partIdx].id } },
      quantity: p.qty,
      unitPrice: p.unitPrice,
     })),
    },
   };
   if (r.assignedTechIdx !== null) {
    data.assignedTo = { connect: { id: techs[r.assignedTechIdx].id } };
   }
   return prisma.request.create({ data: data as never });
  })
 );

 console.log("Діагностика...");
 for (const d of ALL_DIAGNOSTICS) {
  await prisma.diagnostics.create({
   data: {
    request: { connect: { id: requests[d.reqIdx].id } },
    technician: { connect: { id: techs[d.techIdx].id } },
    date: new Date(d.date),
    findings: d.findings,
    cost: d.cost,
   },
  });
 }

 console.log("Оцінки...");
 for (const e of ALL_ESTIMATES) {
  const req = ALL_REQUESTS[e.reqIdx];
  const totalWorks = req.works.reduce((s, w) => s + w.cost, 0);
  const totalParts = req.parts.reduce((s, p) => s + p.qty * p.unitPrice, 0);
  await prisma.estimate.create({
   data: {
    request: { connect: { id: requests[e.reqIdx].id } },
    status: e.status,
    totalWorks,
    totalParts,
    total: totalWorks + totalParts,
    createdBy: { connect: { id: manager.id } },
    approvedAt: e.approvedAt ? new Date(e.approvedAt) : null,
   },
  });
 }

 console.log("Рахунки...");
 for (const inv of ALL_INVOICES) {
  const req = ALL_REQUESTS[inv.reqIdx];
  const total = req.works.reduce((s, w) => s + w.cost, 0) + req.parts.reduce((s, p) => s + p.qty * p.unitPrice, 0);
  const finalTotal = total - inv.discount;
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
  const status = paid <= 0 ? (finalTotal <= 0 ? "PAID" : "UNPAID") : paid >= finalTotal ? "PAID" : "PARTIAL";
  await prisma.invoice.create({
   data: {
    request: { connect: { id: requests[inv.reqIdx].id } },
    estimate: { connect: { id: (await prisma.estimate.findUniqueOrThrow({ where: { requestId: requests[inv.reqIdx].id } })).id } },
    total,
    discount: inv.discount,
    finalTotal,
    status,
    issueDate: new Date(inv.issueDate),
    payments: { create: inv.payments.map((p) => ({ amount: p.amount, method: p.method, paidAt: new Date(p.paidAt) })) },
   },
  });
 }

 console.log("Гарантії...");
 for (const w of ALL_WARRANTIES) {
  const start = new Date(w.startDate);
  const end = new Date(start.getTime() + w.periodDays * 86400000);
  await prisma.warranty.create({
   data: {
    request: { connect: { id: requests[w.reqIdx].id } },
    periodDays: w.periodDays,
    startDate: start,
    endDate: end,
    scope: w.scope,
   },
  });
 }

 console.log("Коментарі...");
 for (const c of ALL_COMMENTS) {
  await prisma.comment.create({
   data: {
    request: { connect: { id: requests[c.reqIdx].id } },
    author: { connect: { id: users[c.authorIdx].id } },
    text: c.text,
    isInternal: c.isInternal,
   },
  });
 }

 console.log("Вкладення...");
 for (const a of ALL_ATTACHMENTS) {
  await prisma.fileAttachment.create({
   data: {
    request: { connect: { id: requests[a.reqIdx].id } },
    fileName: a.fileName,
    filePath: `/uploads/${a.fileName}`,
    mimeType: a.mimeType,
    size: a.size,
    uploadedBy: { connect: { id: users[a.uploadedByIdx].id } },
   },
  });
 }

 // Самозв'язок: WARRANTY_CLAIM -> originalRequestId
 for (let i = 0; i < ALL_REQUESTS.length; i++) {
  const r = ALL_REQUESTS[i];
  if (r.originalIdx !== null) {
   await prisma.request.update({
    where: { id: requests[i].id },
    data: { originalRequestId: requests[r.originalIdx].id },
   });
  }
 }

 console.log("\nГотово. Кількість записів:");
 const counts: Array<[string, number]> = [
  ["User", await prisma.user.count()],
  ["Client", await prisma.client.count()],
  ["Device", await prisma.device.count()],
  ["WorkCatalog", await prisma.workCatalog.count()],
  ["Part", await prisma.part.count()],
  ["Request", await prisma.request.count()],
  ["Diagnostics", await prisma.diagnostics.count()],
  ["RequestWork", await prisma.requestWork.count()],
  ["RequestPart", await prisma.requestPart.count()],
  ["Estimate", await prisma.estimate.count()],
  ["Invoice", await prisma.invoice.count()],
  ["Payment", await prisma.payment.count()],
  ["Warranty", await prisma.warranty.count()],
  ["Comment", await prisma.comment.count()],
  ["FileAttachment", await prisma.fileAttachment.count()],
 ] as const;
 for (const [name, n] of counts) console.log(` ${name}: ${n}`);
}

main()
 .catch((e) => {
  console.error("SEED FAILED:", e);
  process.exitCode = 1;
 })
 .finally(() => prisma.$disconnect());

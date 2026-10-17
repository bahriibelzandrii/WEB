/**
 * UA-назви для enum моделі (docs/PAGES.md §2.1).
 * Raw-значення enum в UI не показуються — тільки через ці словники.
 */

export const STATUS_LABELS: Record<string, string> = {
  NEW: "Нова",
  IN_DIAGNOSTICS: "У діагностиці",
  ESTIMATE_READY: "Оцінка готова",
  IN_REPAIR: "У ремонті",
  READY: "Готова",
  COMPLETED: "Завершена",
  CANCELED: "Скасована",
};

export const TYPE_LABELS: Record<string, string> = {
  REPAIR: "Ремонт",
  MAINTENANCE: "Обслуговування",
  WARRANTY_CLAIM: "Гарантійне звернення",
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Низький",
  NORMAL: "Звичайний",
  HIGH: "Високий",
  URGENT: "Терміновий",
};

export const DEVICE_TYPE_LABELS: Record<string, string> = {
  PC: "ПК",
  LAPTOP: "Ноутбук",
  MONITOR: "Монітор",
  PHONE: "Телефон",
  TABLET: "Планшет",
  PRINTER: "Друкар",
  OTHER: "Інше",
};

export const WORK_STATUS_LABELS: Record<string, string> = {
  PENDING: "Очікує",
  IN_PROGRESS: "Виконується",
  DONE: "Виконано",
};

export const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Чорновик",
  APPROVED: "Затверджена",
  REJECTED: "Відхилена",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Не сплачено",
  PARTIAL: "Частково сплачено",
  PAID: "Сплачено",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Готівка",
  CARD: "Картка",
  BANK_TRANSFER: "Банківський переказ",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Адміністратор",
  MANAGER: "Менеджер",
  TECHNICIAN: "Майстер",
};

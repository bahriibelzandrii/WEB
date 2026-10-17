/**
 * Статусна машина заявки (docs/DATA_MODEL.md, рішення D22).
 *
 *   NEW → IN_DIAGNOSTICS → ESTIMATE_READY → IN_REPAIR → READY → COMPLETED
 *   + CANCELED з будь-якого некінцевого стану.
 *   Кінцеві: COMPLETED, CANCELED.
 */

export const REQUEST_STATUSES = [
  "NEW",
  "IN_DIAGNOSTICS",
  "ESTIMATE_READY",
  "IN_REPAIR",
  "READY",
  "COMPLETED",
  "CANCELED",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_TYPES = ["REPAIR", "MAINTENANCE", "WARRANTY_CLAIM"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DEVICE_TYPES = ["PC", "LAPTOP", "MONITOR", "PHONE", "TABLET", "PRINTER", "OTHER"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/** Дозволені переходи: лише «вперед» по ланцюгу + CANCELED з некінцевого. */
export const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  NEW: ["IN_DIAGNOSTICS", "CANCELED"],
  IN_DIAGNOSTICS: ["ESTIMATE_READY", "CANCELED"],
  ESTIMATE_READY: ["IN_REPAIR", "CANCELED"],
  IN_REPAIR: ["READY", "CANCELED"],
  READY: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
};

export function nextStatuses(current: string): RequestStatus[] {
  return ALLOWED_TRANSITIONS[current as RequestStatus] ?? [];
}

export function canTransition(from: string, to: string): boolean {
  return nextStatuses(from).includes(to as RequestStatus);
}

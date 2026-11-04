// [PHASE4B] Logic tính hóa đơn — thuần, không phụ thuộc Firebase.
import type { BillingSettings, InvoiceItem } from "./types";

export const DEFAULT_BILLING: BillingSettings = { electricRate: 3500, waterRate: 15000, fixedFees: [] };

export const invoiceId = (contractId: string, month: string) => `inv_${contractId}_${month}`;
export const readingId = (roomId: string, month: string) => `${roomId}_${month}`;

/** Hạn thanh toán = ngày `dueDay` (1–28) của THÁNG SAU kỳ hóa đơn. "2026-12" + 5 → "2027-01-05". */
export function dueDateFor(month: string, dueDay?: number): string {
  const [y, m] = month.split("-").map(Number);
  const day = Math.min(28, Math.max(1, Math.round(Number(dueDay) || 5)));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface BillInput {
  rent: number;
  electricPrev: number; electricCurr: number;
  waterPrev: number; waterCurr: number;
  settings: BillingSettings;
}
export interface BillResult {
  ok: boolean;
  error?: string;
  electricUsage: number; waterUsage: number;
  items: InvoiceItem[];
  total: number;
}

const nonNeg = (n: number) => Number.isFinite(n) && n >= 0;

export function computeBill(i: BillInput): BillResult {
  const base = { electricUsage: 0, waterUsage: 0, items: [] as InvoiceItem[], total: 0 };
  if (![i.rent, i.electricPrev, i.electricCurr, i.waterPrev, i.waterCurr].every(nonNeg))
    return { ok: false, error: "Số liệu không hợp lệ", ...base };
  if (i.electricCurr < i.electricPrev) return { ok: false, error: "Chỉ số điện mới nhỏ hơn chỉ số cũ", ...base };
  if (i.waterCurr < i.waterPrev) return { ok: false, error: "Chỉ số nước mới nhỏ hơn chỉ số cũ", ...base };

  const electricUsage = round1(i.electricCurr - i.electricPrev);
  const waterUsage = round1(i.waterCurr - i.waterPrev);
  const items: InvoiceItem[] = [
    { label: "Tiền phòng", amount: Math.round(i.rent) },
    { label: `Điện (${electricUsage} kWh × ${fmt(i.settings.electricRate)})`, amount: Math.round(electricUsage * i.settings.electricRate) },
    { label: `Nước (${waterUsage} m³ × ${fmt(i.settings.waterRate)})`, amount: Math.round(waterUsage * i.settings.waterRate) },
    ...i.settings.fixedFees.filter((f) => f.label.trim() && f.amount > 0).map((f) => ({ label: f.label.trim(), amount: Math.round(f.amount) })),
  ];
  return { ok: true, electricUsage, waterUsage, items, total: items.reduce((s, x) => s + x.amount, 0) };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

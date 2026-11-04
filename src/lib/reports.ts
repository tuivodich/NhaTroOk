// [PHASE4D] Logic báo cáo — thuần, không phụ thuộc Firebase.
import type { InvoiceDoc, InvoiceStatus, PropertyDoc, RoomDoc } from "./types";

const DAY = 86400000;
const toDay = (s: string) => new Date(s + "T00:00:00").getTime();

/** Chưa trả mà quá hạn thì tính là "quá hạn" (chỉ để hiển thị/tính toán, không ghi DB). */
export function effectiveStatus(inv: Pick<InvoiceDoc, "status" | "dueDate">, today: string): InvoiceStatus {
  return inv.status === "unpaid" && inv.dueDate && inv.dueDate < today ? "overdue" : inv.status;
}

export interface MonthRow { month: string; billed: number; collected: number; outstanding: number; count: number; }

/** 12 dòng cho `year` (kỳ hóa đơn YYYY-MM): đã lập / đã thu / còn nợ. */
export function monthlySeries(invoices: InvoiceDoc[], year: number): MonthRow[] {
  const rows: MonthRow[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`, billed: 0, collected: 0, outstanding: 0, count: 0,
  }));
  for (const inv of invoices) {
    if (!inv.month || !inv.month.startsWith(String(year) + "-")) continue;
    const r = rows[Number(inv.month.slice(5, 7)) - 1];
    if (!r) continue;
    const t = Number(inv.total) || 0;
    r.billed += t; r.count++;
    if (inv.status === "paid") r.collected += t; else r.outstanding += t;
  }
  return rows;
}

export const yearsOf = (invoices: InvoiceDoc[], thisYear: number): number[] => {
  const set = new Set<number>([thisYear]);
  for (const i of invoices) { const y = Number((i.month || "").slice(0, 4)); if (y > 2000) set.add(y); }
  return [...set].sort((a, b) => b - a);
};

export interface AgingBucket { key: "current" | "d30" | "d60" | "d60p"; label: string; total: number; count: number; }
export interface DebtRow { roomId: string; tenantId?: string; total: number; count: number; oldestDays: number; }

/** Công nợ hiện tại theo tuổi nợ (số ngày quá hạn) + danh sách theo phòng. */
export function aging(invoices: InvoiceDoc[], today: string): { buckets: AgingBucket[]; rows: DebtRow[]; total: number } {
  const buckets: AgingBucket[] = [
    { key: "current", label: "Chưa đến hạn", total: 0, count: 0 },
    { key: "d30", label: "Quá hạn 1–30 ngày", total: 0, count: 0 },
    { key: "d60", label: "Quá hạn 31–60 ngày", total: 0, count: 0 },
    { key: "d60p", label: "Quá hạn trên 60 ngày", total: 0, count: 0 },
  ];
  const byRoom = new Map<string, DebtRow>();
  const t0 = toDay(today);
  for (const inv of invoices) {
    if (inv.status === "paid") continue;
    const amount = Number(inv.total) || 0;
    const late = inv.dueDate && inv.dueDate < today ? Math.round((t0 - toDay(inv.dueDate)) / DAY) : 0;
    const b = late <= 0 ? buckets[0] : late <= 30 ? buckets[1] : late <= 60 ? buckets[2] : buckets[3];
    b.total += amount; b.count++;
    const row = byRoom.get(inv.roomId) ?? { roomId: inv.roomId, tenantId: inv.tenantId, total: 0, count: 0, oldestDays: 0 };
    row.total += amount; row.count++; row.oldestDays = Math.max(row.oldestDays, late);
    byRoom.set(inv.roomId, row);
  }
  const rows = [...byRoom.values()].sort((a, b) => b.total - a.total);
  return { buckets, rows, total: buckets.reduce((s, b) => s + b.total, 0) };
}

export interface OccRow { propertyId: string; name: string; total: number; occupied: number; vacant: number; maintenance: number; rate: number; }
export function occupancy(rooms: RoomDoc[], properties: PropertyDoc[]): { rows: OccRow[]; all: OccRow } {
  const mk = (propertyId: string, name: string, rs: RoomDoc[]): OccRow => {
    const occupied = rs.filter((r) => r.status === "occupied").length;
    return {
      propertyId, name, total: rs.length, occupied,
      vacant: rs.filter((r) => r.status === "vacant").length,
      maintenance: rs.filter((r) => r.status === "maintenance").length,
      rate: rs.length ? Math.round((occupied / rs.length) * 100) : 0,
    };
  };
  return {
    rows: properties.map((p) => mk(p.id, p.name, rooms.filter((r) => r.propertyId === p.id))),
    all: mk("", "Tất cả", rooms),
  };
}

/** Làm tròn trần tới số "đẹp" để vẽ trục: 1, 2, 2.5, 5, 10 × 10^n. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * p;
}

/** Số tiền dạng gọn cho trục: 2,5 tr · 1,2 tỷ · 800 k */
export function compactVnd(n: number): string {
  const f = (x: number, u: string) => `${(Math.round(x * 10) / 10).toString().replace(".", ",")} ${u}`;
  if (n >= 1e9) return f(n / 1e9, "tỷ");
  if (n >= 1e6) return f(n / 1e6, "tr");
  if (n >= 1e3) return f(n / 1e3, "k");
  return String(Math.round(n));
}

const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv(header: string[], rows: (string | number)[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

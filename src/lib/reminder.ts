// [PHASE5] Nhắc nợ — logic thuần, dùng chung cho app và script email tự động (reminders/).
// KHÔNG import firebase ở đây.

export interface RemindItem { month: string; total: number; dueDate?: string; }

const DAY = 86400000;
const toDay = (s: string) => new Date(s + "T00:00:00Z").getTime();
export const daysBetween = (from: string, to: string) => Math.round((toDay(to) - toDay(from)) / DAY);

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";
const fmtMonth = (m: string) => m.split("-").reverse().join("/");
const fmtDate = (d: string) => d.split("-").reverse().join("/");

/** Tình trạng một khoản: số ngày tới hạn (âm = quá hạn). */
export function dueInfo(item: RemindItem, today: string): { daysToDue: number | null; late: number } {
  if (!item.dueDate) return { daysToDue: null, late: 0 };
  const d = daysBetween(today, item.dueDate);
  return { daysToDue: d, late: d < 0 ? -d : 0 };
}

export interface BuildInput {
  name?: string;
  roomCode: string;
  items: RemindItem[];
  paymentText?: string;
  today: string;
  portalUrl?: string;
}

/** Nội dung nhắc (dùng cho Zalo/SMS/sao chép và làm thân email). */
export function buildReminderText(i: BuildInput): string {
  const items = [...i.items].sort((a, b) => a.month.localeCompare(b.month));
  const total = items.reduce((s, x) => s + (Number(x.total) || 0), 0);
  const anyLate = items.some((x) => dueInfo(x, i.today).late > 0);
  const lines = items.map((x) => {
    const { daysToDue, late } = dueInfo(x, i.today);
    const when = x.dueDate
      ? late > 0 ? `hạn ${fmtDate(x.dueDate)}, quá hạn ${late} ngày`
        : daysToDue === 0 ? `hạn hôm nay (${fmtDate(x.dueDate)})`
        : `hạn ${fmtDate(x.dueDate)}`
      : "";
    return `- Kỳ ${fmtMonth(x.month)}: ${vnd(x.total)}${when ? ` (${when})` : ""}`;
  });
  const out = [
    `Chào ${i.name?.trim() || "bạn"}, chủ trọ nhắc ${anyLate ? "khoản tiền phòng đã quá hạn" : "khoản tiền phòng sắp đến hạn"} của phòng ${i.roomCode}:`,
    ...lines,
    ...(items.length > 1 ? [`Tổng cộng: ${vnd(total)}`] : []),
  ];
  if (i.paymentText?.trim()) out.push("", "Thông tin chuyển khoản:", i.paymentText.trim());
  out.push("", `Nếu bạn đã chuyển khoản, hãy báo trong cổng cư dân${i.portalUrl ? ` (${i.portalUrl})` : ""} bằng nút "Tôi đã chuyển khoản". Cảm ơn bạn!`);
  return out.join("\n");
}

export type RemindReason = "upcoming" | "due" | "overdue";

/**
 * Lịch nhắc tự động: trước hạn `daysBefore` ngày, đúng ngày hạn,
 * và sau hạn vào ngày 1, 3, 7, rồi mỗi 7 ngày. Hóa đơn đã trả hoặc không có hạn thì không nhắc.
 */
export function shouldRemind(inv: { status: string; dueDate?: string }, today: string, daysBefore: number): RemindReason | null {
  if (inv.status === "paid" || !inv.dueDate) return null;
  const d = daysBetween(today, inv.dueDate);
  if (d === 0) return "due";
  if (d > 0) return daysBefore > 0 && d === daysBefore ? "upcoming" : null;
  const late = -d;
  return late === 1 || late === 3 || late % 7 === 0 ? "overdue" : null;
}

export interface ReminderLogLite { roomId?: string; channel?: string; at?: { seconds?: number } | null; }
/** Lần nhắc gần nhất theo phòng. */
export function lastReminderByRoom(logs: ReminderLogLite[]): Map<string, { channel: string; seconds: number }> {
  const m = new Map<string, { channel: string; seconds: number }>();
  for (const l of logs) {
    if (!l.roomId) continue;
    const s = l.at?.seconds ?? 0;
    const cur = m.get(l.roomId);
    if (!cur || s > cur.seconds) m.set(l.roomId, { channel: l.channel ?? "", seconds: s });
  }
  return m;
}

export const CHANNEL_LABEL: Record<string, string> = { copy: "sao chép", zalo: "Zalo", sms: "SMS", email: "email", "email-auto": "email tự động" };

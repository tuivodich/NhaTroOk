export function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n || 0));
}

export const moneyText = (n: number): string => formatVnd(n) + " VND";

export function fmtDate(s?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? "");
  return m ? m[3] + "/" + m[2] + "/" + m[1] : s ?? "";
}

export const todayStr = () => toDateStr(new Date());

export function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

export const shortCode = (id: string): string =>
  id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();

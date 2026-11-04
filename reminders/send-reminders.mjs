// Gửi email nhắc nợ tự động. Chạy: node --experimental-strip-types reminders/send-reminders.mjs
// Biến môi trường: xem reminders/README.md. DRY_RUN=1 (mặc định) chỉ mô phỏng, không gửi, không ghi nhật ký.
import admin from "firebase-admin";
import nodemailer from "nodemailer";
import { buildReminderText, shouldRemind } from "../src/lib/reminder.ts";

const env = (k, d = "") => (process.env[k] ?? d).trim();
const DRY = env("DRY_RUN", "1") !== "0";
const SITE = env("SITE_URL", "https://nhatrook.web.app").replace(/\/$/, "");
const MAX = Number(env("MAX_EMAILS", "100")) || 100;
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;

// Nhật ký công khai trên GitHub Actions: không in email/tên đầy đủ.
const mask = (e) => e.replace(/^(.).*?(@.*)$/, "$1***$2");
const log = (...a) => console.log(...a);

function initFirebase() {
  if (emulator) { admin.initializeApp({ projectId: env("GCLOUD_PROJECT", "demo-test") }); return; }
  const raw = env("FIREBASE_ADMIN_KEY");
  if (!raw) throw new Error("Thiếu FIREBASE_ADMIN_KEY (JSON của service account).");
  let key;
  try { key = JSON.parse(raw); } catch { throw new Error("FIREBASE_ADMIN_KEY không phải JSON hợp lệ."); }
  admin.initializeApp({ credential: admin.credential.cert(key) });
}

function makeTransport() {
  if (env("MAIL_TRANSPORT") === "json") return nodemailer.createTransport({ jsonTransport: true });   // dùng khi kiểm thử
  const host = env("SMTP_HOST"), user = env("SMTP_USER"), pass = env("SMTP_PASS");
  if (!host || !user || !pass) throw new Error("Thiếu SMTP_HOST / SMTP_USER / SMTP_PASS.");
  const port = Number(env("SMTP_PORT", "587")) || 587;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

const escHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main() {
  initFirebase();
  const db = admin.firestore();
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);   // ngày theo giờ Việt Nam
  log(`Nhắc nợ tự động · ${today} · ${DRY ? "MÔ PHỎNG (không gửi)" : "GỬI THẬT"}`);

  const cfg = (await db.doc("settings/reminders").get()).data() ?? {};
  const enabled = cfg.enabled === true;
  const daysBefore = Math.min(14, Math.max(0, Number(cfg.daysBefore ?? 3) || 0));
  if (!enabled && !DRY) { log("Nhắc nợ tự động đang TẮT trong Cài đặt. Không làm gì."); return 0; }
  if (!enabled) log("Lưu ý: tính năng đang TẮT trong Cài đặt; chế độ mô phỏng vẫn chạy để bạn xem trước.");

  const [invSnap, tenSnap, roomSnap, payInfo, pendSnap, doneSnap] = await Promise.all([
    db.collection("invoices").where("status", "in", ["unpaid", "overdue"]).get(),
    db.collection("tenants").get(),
    db.collection("rooms").get(),
    db.doc("settings/payment").get(),
    db.collection("paymentReports").where("status", "==", "pending").get(),
    db.collection("reminderLogs").where("day", "==", today).get(),
  ]);
  const tenants = new Map(tenSnap.docs.map((d) => [d.id, d.data()]));
  const rooms = new Map(roomSnap.docs.map((d) => [d.id, d.data()]));
  const paymentText = String(payInfo.data()?.text ?? "");
  const pending = new Set(pendSnap.docs.map((d) => d.data().invoiceId));
  const doneToday = new Set(doneSnap.docs.flatMap((d) => d.data().invoiceIds ?? []));

  const groups = new Map();
  const skip = { khongDenLuot: 0, daBaoChuyenKhoan: 0, daNhacHomNay: 0, khongCoEmail: new Set() };
  for (const d of invSnap.docs) {
    const inv = { id: d.id, ...d.data() };
    if (!shouldRemind(inv, today, daysBefore)) { skip.khongDenLuot++; continue; }
    if (pending.has(inv.id)) { skip.daBaoChuyenKhoan++; continue; }
    if (doneToday.has(inv.id)) { skip.daNhacHomNay++; continue; }
    const tenant = tenants.get(inv.tenantId ?? "");
    const email = String(tenant?.email ?? "").trim();
    if (!tenant || !email.includes("@")) { skip.khongCoEmail.add(rooms.get(inv.roomId)?.code ?? inv.roomId); continue; }
    const key = `${inv.tenantId}|${inv.roomId}`;
    const g = groups.get(key) ?? { tenantId: inv.tenantId, roomId: inv.roomId, tenant, email, items: [] };
    g.items.push({ invoiceId: inv.id, month: inv.month, total: inv.total, dueDate: inv.dueDate });
    groups.set(key, g);
  }

  log(`Hóa đơn chưa trả: ${invSnap.size} · cần nhắc hôm nay: ${[...groups.values()].reduce((s, g) => s + g.items.length, 0)} (${groups.size} email)`);
  log(`Bỏ qua: chưa đến lượt ${skip.khongDenLuot}, khách đã báo chuyển khoản ${skip.daBaoChuyenKhoan}, đã nhắc hôm nay ${skip.daNhacHomNay}`);
  if (skip.khongCoEmail.size) log(`Không gửi được vì khách chưa có email (phòng): ${[...skip.khongCoEmail].join(", ")}`);

  const transporter = DRY ? null : makeTransport();
  const from = env("MAIL_FROM") || env("SMTP_USER") || "nhatro@example.com";
  let sent = 0, failed = 0;
  for (const g of [...groups.values()].slice(0, MAX)) {
    const roomCode = rooms.get(g.roomId)?.code ?? g.roomId;
    const text = buildReminderText({ name: g.tenant.name, roomCode, items: g.items, paymentText, today, portalUrl: `${SITE}/toi` });
    const subject = `Nhắc thanh toán tiền phòng ${roomCode}`;
    if (DRY) { log(`[mô phỏng] Phòng ${roomCode} → ${mask(g.email)} · ${g.items.length} hóa đơn`); continue; }
    try {
      await transporter.sendMail({ from, to: g.email, subject, text, html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;white-space:pre-wrap">${escHtml(text)}</div>` });
      await db.collection("reminderLogs").add({
        tenantId: g.tenantId ?? null, roomId: g.roomId, invoiceIds: g.items.map((x) => x.invoiceId),
        channel: "email-auto", day: today, at: admin.firestore.FieldValue.serverTimestamp(),
      });
      sent++; log(`Đã gửi: phòng ${roomCode} → ${mask(g.email)}`);
    } catch (e) { failed++; log(`LỖI gửi phòng ${roomCode} → ${mask(g.email)}: ${e.message}`); }
  }
  if (groups.size > MAX) log(`Đã giới hạn ${MAX} email mỗi lần chạy; còn ${groups.size - MAX} email chờ lần sau.`);
  log(DRY ? "Xong (mô phỏng)." : `Xong. Đã gửi ${sent}, lỗi ${failed}.`);
  return failed > 0 ? 1 : 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error("LỖI:", e.message); process.exit(1); });

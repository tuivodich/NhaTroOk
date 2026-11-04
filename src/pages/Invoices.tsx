import { useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type InvoiceDoc, type InvoiceStatus, type PaymentReport, type RoomDoc, type TenantDoc } from "../lib/types";
import MoneyText from "../components/MoneyText";
import NumInput from "../components/NumInput";
import { IcCal, IcDoor, IcPlus, IcUser, IcWarn } from "../components/Icons";

interface F {
  id?: string;
  roomId: string;
  tenantId: string;
  month: string;
  total: number | "";
  status: InvoiceStatus;
  dueDate: string;
  notes: string;
}
const empty = (): F => ({
  roomId: "", tenantId: "", month: new Date().toISOString().slice(0, 7),
  total: "", status: "unpaid", dueDate: "", notes: "",
});

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtMonth = (m: string) => (m ? m.split("-").reverse().join("/") : "");
const fmtDate = (d: string) => (d ? d.split("-").reverse().join("/") : "");

type Filter = "all" | InvoiceStatus;

export default function Invoices() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: invoices, loading } = useCollection<InvoiceDoc>("invoices");
  const { data: rooms } = useCollection<RoomDoc>("rooms");
  const { data: tenants } = useCollection<TenantDoc>("tenants");
  const { data: reports } = useCollection<PaymentReport>("paymentReports");
  const [form, setForm] = useState<F | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const roomCode = (id: string) => rooms.find((x) => x.id === id)?.code ?? id;
  const tenantName = (id?: string) => (id ? tenants.find((x) => x.id === id)?.name ?? id : "");

  // Trạng thái hiển thị: chưa trả mà quá hạn thì coi là "quá hạn" (chỉ hiển thị, không ghi DB)
  const eff = (x: InvoiceDoc): InvoiceStatus =>
    x.status === "unpaid" && x.dueDate && x.dueDate < todayStr() ? "overdue" : x.status;

  const s = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const open = invoices.filter((x) => eff(x) !== "paid");
    return {
      owed: open.reduce((sum, x) => sum + (Number(x.total) || 0), 0),
      overdueN: invoices.filter((x) => eff(x) === "overdue").length,
      unpaidN: invoices.filter((x) => eff(x) === "unpaid").length,
      collected: invoices.filter((x) => x.status === "paid" && x.month === month).reduce((sum, x) => sum + (Number(x.total) || 0), 0),
      paidN: invoices.filter((x) => x.status === "paid").length,
    };
  }, [invoices]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return invoices
      .filter((x) => filter === "all" || eff(x) === filter)
      .filter((x) => !needle || [roomCode(x.roomId), tenantName(x.tenantId), x.month].some((v) => v.toLowerCase().includes(needle)))
      .sort((a, b) => (b.month || "").localeCompare(a.month || ""));
  }, [invoices, filter, q, rooms, tenants]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErr(""); setBusy(true);
    try {
      if (!form.roomId) { setErr("Vui lòng chọn phòng."); return; }
      if (!form.month) { setErr("Vui lòng chọn kỳ hóa đơn."); return; }
      if (form.total === "" || +form.total < 0) { setErr("Tổng tiền phải là số không âm."); return; }

      // Chỉ thêm field có giá trị — KHÔNG đưa undefined vào payload
      const payload: Record<string, unknown> = {
        roomId: form.roomId, month: form.month, total: +form.total, status: form.status, items: [],
      };
      if (form.tenantId) payload.tenantId = form.tenantId;
      if (form.dueDate) payload.dueDate = form.dueDate;
      const notes = form.notes.trim();
      if (notes) payload.notes = notes;

      if (form.id) {
        await updateDoc(doc(db, "invoices", form.id), payload);
        audit("invoice.update", "Sua hoa don " + form.month, { type: "invoice", id: form.id });
      } else {
        const uid = tenants.find((x) => x.id === form.tenantId)?.userId;
        if (uid) payload.userId = uid; // [PHASE4C]
        const ref = await addDoc(collection(db, "invoices"), payload);
        audit("invoice.create", "Them hoa don " + form.month, { type: "invoice", id: ref.id });
      }
      setForm(null);
    } catch (ex) {
      console.error("invoice save failed", ex);
      setErr("Lỗi: " + ((ex as Error)?.message ?? String(ex)));
    } finally { setBusy(false); }
  };

  // [PHASE4D] Xác nhận / từ chối báo cáo chuyển khoản của khách (staff + admin)
  const pending = reports.filter((r) => r.status === "pending").sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
  const reviewReport = async (r: PaymentReport, ok: boolean) => {
    const inv = invoices.find((i) => i.id === r.invoiceId);
    if (!inv) return setErr("Không tìm thấy hóa đơn của báo cáo này.");
    let staffNote = "";
    if (ok) {
      if (!window.confirm(`Xác nhận đã nhận ${new Intl.NumberFormat("vi-VN").format(r.amount)} đ cho phòng ${roomCode(inv.roomId)} kỳ ${fmtMonth(inv.month)}?\n\nHóa đơn sẽ chuyển sang "Đã trả".`)) return;
    } else {
      const n = window.prompt("Lý do từ chối (khách sẽ thấy):", "Chưa nhận được tiền");
      if (n === null) return;
      staffNote = n.trim();
    }
    setErr("");
    try {
      const b = writeBatch(db);
      b.update(doc(db, "paymentReports", r.id), {
        status: ok ? "confirmed" : "rejected", reviewedBy: profile?.uid ?? "", updatedAt: serverTimestamp(), ...(staffNote ? { staffNote } : {}),
      });
      if (ok) b.update(doc(db, "invoices", inv.id), { status: "paid", paidAt: Date.now() });
      await b.commit();
      audit(ok ? "payment.confirm" : "payment.reject", `${ok ? "Xac nhan" : "Tu choi"} thanh toan ${inv.month}`, { type: "invoice", id: inv.id });
    } catch (ex) { setErr("Lỗi: " + ((ex as Error)?.message ?? String(ex))); }
  };

  const markPaid = async (x: InvoiceDoc) => {
    if (!confirm(`Đánh dấu đã thu hóa đơn phòng ${roomCode(x.roomId)} kỳ ${fmtMonth(x.month)}?`)) return;
    try {
      await updateDoc(doc(db, "invoices", x.id), { status: "paid", paidAt: Date.now() });
      audit("invoice.paid", "Danh dau da tra " + x.month, { type: "invoice", id: x.id });
    } catch (ex) {
      console.error("mark paid failed", ex);
      setErr(t("error"));
    }
  };

  const remove = async (x: InvoiceDoc) => {
    if (!confirm(t("deleteInvoiceSure"))) return;
    if (!confirm("XÁC NHẬN LẦN 2: xóa hóa đơn này? Không thể hoàn tác.")) return;
    try {
      await deleteDoc(doc(db, "invoices", x.id));
      audit("invoice.delete", "Xoa hoa don " + x.month, { type: "invoice", id: x.id });
    } catch (ex) {
      console.error("delete invoice failed", ex);
      setErr(t("error"));
    }
  };

  const label = (st: InvoiceStatus) => (st === "paid" ? t("invoicePaid") : st === "overdue" ? t("invoiceOverdue") : t("invoiceUnpaid"));
  const chips: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "Tất cả", n: invoices.length },
    { key: "unpaid", label: t("invoiceUnpaid"), n: s.unpaidN },
    { key: "overdue", label: t("invoiceOverdue"), n: s.overdueN },
    { key: "paid", label: t("invoicePaid"), n: s.paidN },
  ];

  return (
    <section className="ct">
      <div className="ct-head">
        <div>
          <h2>{t("invoices")}</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Theo dõi công nợ và tiền đã thu theo từng kỳ.</p>
        </div>
        {canEdit && !form && (
          <button className="ct-btn-primary" onClick={() => { setErr(""); setForm(empty()); }}><IcPlus /> {t("addInvoice")}</button>
        )}
      </div>

      <div className="ct-stats">
        <div className="ct-stat"><span className="ct-stat-n ct-num"><MoneyText value={s.owed} /></span><span className="ct-stat-l">Còn phải thu</span></div>
        <div className={"ct-stat" + (s.overdueN ? " warn" : "")}><span className="ct-stat-n">{s.overdueN}</span><span className="ct-stat-l">Hóa đơn quá hạn</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{s.unpaidN}</span><span className="ct-stat-l">Chưa trả</span></div>
        <div className="ct-stat"><span className="ct-stat-n ct-num"><MoneyText value={s.collected} /></span><span className="ct-stat-l">Đã thu tháng này</span></div>
      </div>

      {err && <p className="error" role="alert">{err}</p>}

      {pending.length > 0 && (
        <div className="card" style={{ borderColor: "#f59e0b" }}>
          <h3 style={{ marginTop: 0 }}>Khách báo đã chuyển khoản <span className="ct-chip-n">{pending.length}</span></h3>
          <ul className="dash-list">
            {pending.map((r) => {
              const inv = invoices.find((i) => i.id === r.invoiceId);
              return (
                <li key={r.id} className="pr-row">
                  <div className="dash-li-main" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <b>Phòng {inv ? roomCode(inv.roomId) : "?"} · kỳ {inv ? fmtMonth(inv.month) : "?"} · <span className="ct-num"><MoneyText value={r.amount} /></span></b>
                    <span className="ct-sub">{tenantName(r.tenantId) || "Khách"}{r.note ? ` · “${r.note}”` : ""}</span>
                  </div>
                  <div className="ct-actions" style={{ margin: 0, padding: 0 }}>
                    <button onClick={() => reviewReport(r, true)}>Đã nhận tiền</button>
                    <button className="ghost danger" onClick={() => reviewReport(r, false)}>Chưa nhận</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {form && (
        <form className="card ct-form" onSubmit={save}>
          <h3>{form.id ? t("editInvoice") : t("addInvoice")}</h3>
          <div className="ct-grid2">
            <label>{t("invoiceRoom")}
              <select required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">{t("none")}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
              </select>
            </label>
            <label>{t("invoiceTenant")}
              <select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>
                <option value="">{t("none")}</option>
                {tenants.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>{t("invoiceMonth")}<input required type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} /></label>
            <label>{t("invoiceDue")}<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
            <label>{t("invoiceTotal")}<NumInput min={0} value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("status")}
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}>
                <option value="unpaid">{t("invoiceUnpaid")}</option>
                <option value="paid">{t("invoicePaid")}</option>
                <option value="overdue">{t("invoiceOverdue")}</option>
              </select>
            </label>
          </div>
          <label style={{ marginTop: 12 }}>{t("notes")}<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="ct-actions">
            <button type="submit" disabled={busy}>{busy ? "Đang lưu…" : t("save")}</button>
            <button type="button" className="ghost" onClick={() => { setForm(null); setErr(""); }}>{t("cancel")}</button>
          </div>
        </form>
      )}

      {invoices.length > 0 && (
        <div className="ct-toolbar">
          <div className="ct-chips" role="group" aria-label="Lọc hóa đơn">
            {chips.map((c) => (
              <button key={c.key} type="button" className={"ct-chip" + (filter === c.key ? " on" : "")}
                aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}>
                {c.label} <span className="ct-chip-n">{c.n}</span>
              </button>
            ))}
          </div>
          <label className="ct-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Tìm phòng, khách, kỳ…" aria-label="Tìm hóa đơn" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      )}
      <p className="ct-count" role="status" aria-atomic="true">
        {!loading && invoices.length > 0 ? `Hiển thị ${visible.length} / ${invoices.length} hóa đơn` : ""}
      </p>

      {loading ? (
        <div className="ct-list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="ct-card ct-skel" />)}</div>
      ) : invoices.length === 0 && !form ? (
        <div className="ct-empty"><strong>{t("noInvoices")}</strong><span>Tạo hóa đơn đầu tiên cho một phòng đang thuê.</span></div>
      ) : visible.length === 0 ? (
        <div className="ct-empty"><strong>Không có hóa đơn phù hợp bộ lọc.</strong>
          <button className="ghost" onClick={() => { setFilter("all"); setQ(""); }}>Xóa bộ lọc</button></div>
      ) : (
        <div className="ct-list">
          {visible.map((x) => {
            const st = eff(x);
            return (
              <article className={"ct-card" + (st === "overdue" ? " bad" : st === "unpaid" ? " warn" : "")} key={x.id}>
                <header className="ct-card-head">
                  <div className="ct-code">Kỳ {fmtMonth(x.month)}</div>
                  <span className={"tag " + st}>{label(st)}</span>
                </header>
                <div className="rm-price ct-num" style={{ color: "var(--text)" }}><MoneyText value={x.total} /></div>
                <dl className="ct-meta">
                  <div><dt><span className="sr">Phòng</span><IcDoor /></dt><dd>Phòng {roomCode(x.roomId)}</dd></div>
                  {x.tenantId && <div><dt><span className="sr">Khách</span><IcUser /></dt><dd>{tenantName(x.tenantId)}</dd></div>}
                  {x.dueDate && <div><dt><span className="sr">{t("invoiceDue")}</span><IcCal /></dt><dd className="ct-num">{t("invoiceDue")}: {fmtDate(x.dueDate)}</dd></div>}
                </dl>
                {st === "overdue" && x.dueDate && (
                  <div className="ct-alert bad" role="note"><IcWarn />Quá hạn từ {fmtDate(x.dueDate)}</div>
                )}
                {x.notes ? <p className="ct-notes">{x.notes}</p> : null}
                {canEdit && (
                  <footer className="ct-actions">
                    {x.status !== "paid" && <button onClick={() => markPaid(x)}>{t("markPaid")}</button>}
                    <button className="ghost" onClick={() => { setErr(""); setForm({ id: x.id, roomId: x.roomId, tenantId: x.tenantId ?? "", month: x.month, total: x.total, status: x.status, dueDate: x.dueDate ?? "", notes: x.notes ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t("edit")}</button>
                    <button className="ghost danger" onClick={() => remove(x)}>{t("delete")}</button>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

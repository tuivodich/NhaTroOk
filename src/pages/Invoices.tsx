import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type InvoiceDoc, type InvoiceStatus, type RoomDoc, type TenantDoc } from "../lib/types";
import MoneyText from "../components/MoneyText";
import NumInput from "../components/NumInput";

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

export default function Invoices() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: invoices, loading } = useCollection<InvoiceDoc>("invoices");
  const { data: rooms } = useCollection<RoomDoc>("rooms");
  const { data: tenants } = useCollection<TenantDoc>("tenants");
  const [form, setForm] = useState<F | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const roomCode = (id: string) => rooms.find((x) => x.id === id)?.code ?? id;
  const tenantName = (id?: string) => (id ? tenants.find((x) => x.id === id)?.name ?? id : "—");

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
        roomId: form.roomId,
        month: form.month,
        total: +form.total,
        status: form.status,
        items: [],
      };
      if (form.tenantId) payload.tenantId = form.tenantId;
      if (form.dueDate) payload.dueDate = form.dueDate;
      const notes = form.notes.trim();
      if (notes) payload.notes = notes;

      if (form.id) {
        await updateDoc(doc(db, "invoices", form.id), payload);
        audit("invoice.update", "Sua hoa don " + form.month, { type: "invoice", id: form.id });
      } else {
        const ref = await addDoc(collection(db, "invoices"), payload);
        audit("invoice.create", "Them hoa don " + form.month, { type: "invoice", id: ref.id });
      }
      setForm(null);
    } catch (ex) {
      console.error("invoice save failed", ex);
      setErr("Lỗi: " + ((ex as Error)?.message ?? String(ex)));
    } finally { setBusy(false); }
  };

  const markPaid = async (x: InvoiceDoc) => {
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
    try {
      await deleteDoc(doc(db, "invoices", x.id));
      audit("invoice.delete", "Xoa hoa don " + x.month, { type: "invoice", id: x.id });
    } catch (ex) {
      console.error("delete invoice failed", ex);
      setErr(t("error"));
    }
  };

  return (
    <section>
      <div className="row between">
        <h2>{t("invoices")}</h2>
        {canEdit && !form && <button onClick={() => { setErr(""); setForm(empty()); }}>+ {t("addInvoice")}</button>}
      </div>
      {err && <p className="error">{err}</p>}

      {form && (
        <form className="card" onSubmit={save}>
          <h3>{form.id ? t("editInvoice") : t("addInvoice")}</h3>
          <div className="row">
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
          </div>
          <div className="row">
            <label>{t("invoiceMonth")}<input required type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} /></label>
            <label>{t("invoiceDue")}<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
          </div>
          <div className="row">
            <label>{t("invoiceTotal")}<NumInput min={0} value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("status")}
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}>
                <option value="unpaid">{t("invoiceUnpaid")}</option>
                <option value="paid">{t("invoicePaid")}</option>
                <option value="overdue">{t("invoiceOverdue")}</option>
              </select>
            </label>
          </div>
          <label>{t("notes")}<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="row">
            <button type="submit" disabled={busy}>{t("save")}</button>
            <button type="button" className="ghost" onClick={() => { setForm(null); setErr(""); }}>{t("cancel")}</button>
          </div>
        </form>
      )}

      {loading ? <p>{t("loading")}</p> : invoices.length === 0 && !form ? (
        <p className="info">{t("noInvoices")}</p>
      ) : (
        <div className="list">
          {invoices.map((x) => (
            <div className="card" key={x.id}>
              <div className="row between">
                <strong>{roomCode(x.roomId)} · {x.month}</strong>
                {canEdit && (
                  <div className="row">
                    {x.status !== "paid" && <button className="ghost" onClick={() => markPaid(x)}>{t("markPaid")}</button>}
                    <button className="ghost" onClick={() => { setErr(""); setForm({ id: x.id, roomId: x.roomId, tenantId: x.tenantId ?? "", month: x.month, total: x.total, status: x.status, dueDate: x.dueDate ?? "", notes: x.notes ?? "" }); }}>{t("edit")}</button>
                    <button className="ghost danger" onClick={() => remove(x)}>{t("delete")}</button>
                  </div>
                )}
              </div>
              <div className="row wrap">
                <span>{tenantName(x.tenantId)}</span>
                <span><MoneyText value={x.total} /></span>
                <span className={"tag " + x.status}>
                  {x.status === "paid" ? t("invoicePaid") : x.status === "overdue" ? t("invoiceOverdue") : t("invoiceUnpaid")}
                </span>
                {x.dueDate ? <span>{t("invoiceDue")}: {x.dueDate}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type RoomDoc, type TenantDoc } from "../lib/types";

interface F { id?: string; name: string; phone: string; email: string; idNumber: string; roomId: string; notes: string; }
const empty: F = { name: "", phone: "", email: "", idNumber: "", roomId: "", notes: "" };

export default function Tenants() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: tenants, loading } = useCollection<TenantDoc>("tenants");
  const { data: rooms } = useCollection<RoomDoc>("rooms");
  const [form, setForm] = useState<F | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const roomLabel = (id?: string) => {
    if (!id) return "—";
    const r = rooms.find((x) => x.id === id);
    return r ? r.code : id;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErr(""); setBusy(true);
    try {
      if (!form.name.trim()) { setErr(t("tenantName")); return; }

      const payload: Record<string, unknown> = { name: form.name.trim() };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.idNumber.trim()) payload.idNumber = form.idNumber.trim();
      if (form.roomId) payload.roomId = form.roomId;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      if (form.id) {
        await updateDoc(doc(db, "tenants", form.id), payload);
        audit("tenant.update", "Sua khach " + form.name.trim(), { type: "tenant", id: form.id });
      } else {
        const ref = await addDoc(collection(db, "tenants"), payload);
        audit("tenant.create", "Them khach " + form.name.trim(), { type: "tenant", id: ref.id });
      }
      setForm(null);
    } catch (ex) {
      console.error("tenant save failed", ex);
      setErr("Lỗi: " + ((ex as Error)?.message ?? String(ex)));
    } finally { setBusy(false); }
  };

  const remove = async (x: TenantDoc) => {
    if (!confirm(t("deleteTenantSure"))) return;
    try {
      await deleteDoc(doc(db, "tenants", x.id));
      audit("tenant.delete", "Xoa khach " + x.name, { type: "tenant", id: x.id });
    } catch (ex) {
      console.error("delete tenant failed", ex);
      setErr(t("error"));
    }
  };

  return (
    <section>
      <div className="row between">
        <h2>{t("tenants")}</h2>
        {canEdit && !form && <button onClick={() => { setErr(""); setForm({ ...empty }); }}>+ {t("addTenant")}</button>}
      </div>
      {err && <p className="error">{err}</p>}

      {form && (
        <form className="card" onSubmit={save}>
          <h3>{form.id ? t("editTenant") : t("addTenant")}</h3>
          <label>{t("tenantName")}<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <div className="row">
            <label>{t("tenantPhone")}<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>{t("tenantEmail")}<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          </div>
          <div className="row">
            <label>{t("tenantIdNumber")}<input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} /></label>
            <label>{t("tenantRoom")}
              <select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">{t("none")}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
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

      {loading ? <p>{t("loading")}</p> : tenants.length === 0 && !form ? (
        <p className="info">{t("noTenants")}</p>
      ) : (
        <div className="list">
          {tenants.map((x) => (
            <div className="card" key={x.id}>
              <div className="row between">
                <strong>{x.name}</strong>
                {canEdit && (
                  <div className="row">
                    <button className="ghost" onClick={() => { setErr(""); setForm({ id: x.id, name: x.name, phone: x.phone ?? "", email: x.email ?? "", idNumber: x.idNumber ?? "", roomId: x.roomId ?? "", notes: x.notes ?? "" }); }}>{t("edit")}</button>
                    <button className="ghost danger" onClick={() => remove(x)}>{t("delete")}</button>
                  </div>
                )}
              </div>
              <div className="row wrap">
                {x.phone ? <span>{x.phone}</span> : null}
                {x.email ? <span>{x.email}</span> : null}
                <span>{t("tenantRoom")}: {roomLabel(x.roomId)}</span>
              </div>
              {x.notes ? <small>{x.notes}</small> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

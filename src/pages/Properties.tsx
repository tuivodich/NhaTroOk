import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type PropertyDoc, type RoomDoc } from "../lib/types";

interface FormState { id?: string; name: string; address: string; notes: string; }
const empty: FormState = { name: "", address: "", notes: "" };

export default function Properties() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: properties, loading } = useCollection<PropertyDoc>("properties");
  const { data: rooms } = useCollection<RoomDoc>("rooms");
  const [form, setForm] = useState<FormState | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const roomCount = (pid: string) => rooms.filter((r) => r.propertyId === pid).length;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErr(""); setBusy(true);
    try {
      const payload = { name: form.name.trim(), address: form.address.trim(), notes: form.notes.trim(), roomCount: 0 };
      if (!payload.name) { setErr(t("propertyName")); return; }
      if (form.id) {
        await updateDoc(doc(db, "properties", form.id), { name: payload.name, address: payload.address, notes: payload.notes });
        audit("property.update", "Sua nha tro: " + payload.name, { type: "property", id: form.id });
      } else {
        const ref = await addDoc(collection(db, "properties"), payload);
        audit("property.create", "Them nha tro: " + payload.name, { type: "property", id: ref.id });
      }
      setForm(null);
    } catch (ex) {
      console.error("property save failed", ex);
      setErr(t("error"));
    } finally { setBusy(false); }
  };

  const remove = async (p: PropertyDoc) => {
    if (roomCount(p.id) > 0) return setErr(t("propertyHasRooms"));
    if (!confirm(t("deletePropertySure"))) return;
    try {
      await deleteDoc(doc(db, "properties", p.id));
      audit("property.delete", "Xoa nha tro: " + p.name, { type: "property", id: p.id });
    } catch (ex) {
      console.error("delete property failed", ex);
      setErr(t("error"));
    }
  };

  return (
    <section>
      <div className="row between">
        <h2>{t("properties")}</h2>
        {canEdit && !form && <button onClick={() => { setErr(""); setForm({ ...empty }); }}>+ {t("addProperty")}</button>}
      </div>

      {err && <p className="error">{err}</p>}

      {form && (
        <form className="card" onSubmit={save}>
          <h3>{form.id ? t("editProperty") : t("addProperty")}</h3>
          <label>{t("propertyName")}<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>{t("propertyAddress")}<input maxLength={300} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label>{t("propertyNotes")}<textarea rows={3} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="row">
            <button type="submit" disabled={busy}>{t("save")}</button>
            <button type="button" className="ghost" onClick={() => { setForm(null); setErr(""); }}>{t("cancel")}</button>
          </div>
        </form>
      )}

      {loading ? <p>{t("loading")}</p> : properties.length === 0 && !form ? (
        <p className="info">{t("noProperties")}</p>
      ) : (
        <div className="list">
          {properties.map((p) => (
            <div className="card" key={p.id}>
              <div className="row between">
                <strong>{p.name}</strong>
                {canEdit && (
                  <div className="row">
                    <button className="ghost" onClick={() => { setErr(""); setForm({ id: p.id, name: p.name, address: p.address ?? "", notes: p.notes ?? "" }); }}>{t("edit")}</button>
                    <button className="ghost danger" onClick={() => remove(p)}>{t("delete")}</button>
                  </div>
                )}
              </div>
              {p.address && <div>{p.address}</div>}
              {p.notes && <div><small>{p.notes}</small></div>}
              <div><small>{t("propertyRooms")}: {roomCount(p.id)}</small></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

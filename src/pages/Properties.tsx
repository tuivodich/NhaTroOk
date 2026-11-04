import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type PropertyDoc, type RoomDoc } from "../lib/types";
import { IcBuilding, IcPlus } from "../components/Icons";

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

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; vacant: number; occupied: number }>();
    for (const r of rooms) {
      const s = m.get(r.propertyId) ?? { total: 0, vacant: 0, occupied: 0 };
      s.total++;
      if (r.status === "vacant") s.vacant++;
      if (r.status === "occupied") s.occupied++;
      m.set(r.propertyId, s);
    }
    return m;
  }, [rooms]);
  const roomCount = (pid: string) => stats.get(pid)?.total ?? 0;

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
    if (!confirm(`XÁC NHẬN LẦN 2: xóa nhà trọ "${p.name}"? Không thể hoàn tác.`)) return;
    try {
      await deleteDoc(doc(db, "properties", p.id));
      audit("property.delete", "Xoa nha tro: " + p.name, { type: "property", id: p.id });
    } catch (ex) {
      console.error("delete property failed", ex);
      setErr(t("error"));
    }
  };

  return (
    <section className="ct">
      <div className="ct-head">
        <div>
          <h2>{t("properties")}</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Các nhà trọ bạn quản lý và mức lấp đầy của từng nơi.</p>
        </div>
        {canEdit && !form && (
          <button className="ct-btn-primary" onClick={() => { setErr(""); setForm({ ...empty }); }}><IcPlus /> {t("addProperty")}</button>
        )}
      </div>

      {err && <p className="error" role="alert">{err}</p>}

      {form && (
        <form className="card ct-form" onSubmit={save}>
          <h3>{form.id ? t("editProperty") : t("addProperty")}</h3>
          <div className="ct-grid2">
            <label>{t("propertyName")}<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>{t("propertyAddress")}<input maxLength={300} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          </div>
          <label style={{ marginTop: 12 }}>{t("propertyNotes")}<textarea rows={3} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="ct-actions">
            <button type="submit" disabled={busy}>{busy ? "Đang lưu…" : t("save")}</button>
            <button type="button" className="ghost" onClick={() => { setForm(null); setErr(""); }}>{t("cancel")}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="ct-list" aria-busy="true">{[0, 1].map((i) => <div key={i} className="ct-card ct-skel" />)}</div>
      ) : properties.length === 0 && !form ? (
        <div className="ct-empty"><strong>{t("noProperties")}</strong><span>Tạo nhà trọ trước, sau đó thêm phòng cho từng nhà.</span></div>
      ) : (
        <div className="ct-list">
          {properties.map((p) => {
            const s = stats.get(p.id) ?? { total: 0, vacant: 0, occupied: 0 };
            const rate = s.total ? Math.round((s.occupied / s.total) * 100) : 0;
            return (
              <article className="ct-card" key={p.id} style={{ borderLeftColor: "var(--border)" }}>
                <header className="ct-card-head">
                  <div className="iq-who">
                    <span className="iq-avatar" aria-hidden="true"><IcBuilding /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="ct-code" style={{ overflowWrap: "anywhere" }}>{p.name}</div>
                      {p.address && <div className="ct-sub" style={{ overflowWrap: "anywhere" }}>{p.address}</div>}
                    </div>
                  </div>
                </header>

                <div>
                  <div className="dash-rate" style={{ marginBottom: 6 }}>
                    <span className="dash-rate-n ct-num" style={{ fontSize: 26 }}>{rate}%</span>
                    <span className="ct-sub">{s.occupied}/{s.total} phòng đang thuê</span>
                  </div>
                  <div className="dash-bar" role="progressbar" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100} aria-label={`Lấp đầy ${p.name}`}><div style={{ width: rate + "%" }} /></div>
                  <div className="ct-sub" style={{ marginTop: 6 }}>{t("propertyRooms")}: <b>{s.total}</b> · {t("vacantRooms")}: <b>{s.vacant}</b></div>
                </div>

                {p.notes && <p className="ct-notes">{p.notes}</p>}

                <footer className="ct-actions">
                  <Link className="ct-btn" to="/app/rooms">Xem phòng</Link>
                  {canEdit && (
                    <>
                      <button className="ghost" onClick={() => { setErr(""); setForm({ id: p.id, name: p.name, address: p.address ?? "", notes: p.notes ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t("edit")}</button>
                      <button className="ghost danger" onClick={() => remove(p)}>{t("delete")}</button>
                    </>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

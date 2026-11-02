import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type PropertyDoc, type RoomDoc, type RoomStatus } from "../lib/types";
import MoneyText from "../components/MoneyText";
import NumInput from "../components/NumInput";

interface FormState {
  id?: string;
  propertyId: string;
  code: string;
  floor: string;
  area: string;
  baseRent: number | "";
  deposit: number | "";
  status: RoomStatus;
  amenities: string;
  desc: string;
  descEn: string;
  electricStart: number | "";
  waterStart: number | "";
}

const empty = (propertyId = ""): FormState => ({
  propertyId, code: "", floor: "", area: "", baseRent: "", deposit: "",
  status: "vacant", amenities: "", desc: "", descEn: "",
  electricStart: "", waterStart: "",
});

const toLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function Rooms() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: properties } = useCollection<PropertyDoc>("properties");
  const { data: rooms, loading } = useCollection<RoomDoc>("rooms");
  const [filter, setFilter] = useState<string>("");
  const [form, setForm] = useState<FormState | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? "?";

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErr(""); setBusy(true);
    try {
      if (!form.propertyId) { setErr(t("roomProperty")); return; }
      if (!form.code.trim()) { setErr(t("roomCode")); return; }
      if (form.baseRent === "" || +form.baseRent < 0) { setErr(t("roomRent")); return; }

      const payload: Record<string, unknown> = {
        propertyId: form.propertyId,
        code: form.code.trim(),
        baseRent: +form.baseRent,
        status: form.status,
        amenities: toLines(form.amenities),
      };
      if (form.floor) payload.floor = +form.floor;
      if (form.area) payload.area = +form.area;
      if (form.deposit !== "") payload.deposit = +form.deposit;
      if (form.desc.trim()) payload.desc = form.desc.trim();
      if (form.descEn.trim()) payload.descEn = form.descEn.trim();

      const meter: Record<string, number> = {};
      if (form.electricStart !== "") meter.electricStart = +form.electricStart;
      if (form.waterStart !== "") meter.waterStart = +form.waterStart;
      if (Object.keys(meter).length > 0) payload.meter = meter;

      if (form.id) {
        await updateDoc(doc(db, "rooms", form.id), payload);
        audit("room.update", "Sua phong " + form.code.trim(), { type: "room", id: form.id });
      } else {
        const ref = await addDoc(collection(db, "rooms"), payload);
        audit("room.create", "Them phong " + form.code.trim(), { type: "room", id: ref.id });
      }
      setForm(null);
    } catch (ex) {
      console.error("room save failed", ex);
      setErr("Lỗi: " + ((ex as Error)?.message ?? String(ex)));
    } finally { setBusy(false); }
  };

  const remove = async (r: RoomDoc) => {
    if (!confirm(t("deleteRoomSure"))) return;
    try {
      await deleteDoc(doc(db, "rooms", r.id));
      audit("room.delete", "Xoa phong " + r.code, { type: "room", id: r.id });
    } catch (ex) {
      console.error("delete room failed", ex);
      setErr(t("error"));
    }
  };

  const openEdit = (r: RoomDoc) => setForm({
    id: r.id,
    propertyId: r.propertyId,
    code: r.code,
    floor: r.floor != null ? String(r.floor) : "",
    area: r.area != null ? String(r.area) : "",
    baseRent: r.baseRent,
    deposit: r.deposit ?? "",
    status: r.status,
    amenities: (r.amenities ?? []).join("\n"),
    desc: r.desc ?? "",
    descEn: r.descEn ?? "",
    electricStart: r.meter?.electricStart ?? "",
    waterStart: r.meter?.waterStart ?? "",
  });

  const filtered = filter ? rooms.filter((r) => r.propertyId === filter) : rooms;

  return (
    <section>
      <div className="row between">
        <h2>{t("rooms")}</h2>
        {canEdit && !form && properties.length > 0 && (
          <button onClick={() => { setErr(""); setForm(empty(properties[0]?.id ?? "")); }}>+ {t("addRoom")}</button>
        )}
      </div>

      {err && <p className="error">{err}</p>}

      {form && (
        <form className="card" onSubmit={save}>
          <h3>{form.id ? t("editRoom") : t("addRoom")}</h3>

          <label>{t("roomProperty")}
            <select required value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
              <option value="">{t("none")}</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>{t("roomCode")}<input required maxLength={20} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>

          <div className="row">
            <label>{t("roomFloor")}<NumInput min={0} value={form.floor === "" ? "" : +form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></label>
            <label>{t("roomArea")}<NumInput min={0} value={form.area === "" ? "" : +form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></label>
            <label>{t("roomStatus")}
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RoomStatus })}>
                <option value="vacant">{t("statusVacant")}</option>
                <option value="occupied">{t("statusOccupied")}</option>
                <option value="maintenance">{t("statusMaintenance")}</option>
              </select>
            </label>
          </div>

          <div className="row">
            <label>{t("roomRent")}<NumInput min={0} value={form.baseRent} onChange={(e) => setForm({ ...form, baseRent: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("roomDeposit")}<NumInput min={0} value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value === "" ? "" : +e.target.value })} /></label>
          </div>

          <label>{t("roomAmenities")}<textarea rows={3} placeholder={t("roomAmenitiesHint")} value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} /></label>
          <label>{t("roomDesc")}<textarea rows={3} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></label>
          <label>{t("roomDescEn")}<textarea rows={3} value={form.descEn} onChange={(e) => setForm({ ...form, descEn: e.target.value })} /></label>

          <div className="row">
            <label>{t("electricStart")}<NumInput min={0} value={form.electricStart} onChange={(e) => setForm({ ...form, electricStart: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("waterStart")}<NumInput min={0} value={form.waterStart} onChange={(e) => setForm({ ...form, waterStart: e.target.value === "" ? "" : +e.target.value })} /></label>
          </div>

          <div className="row">
            <button type="submit" disabled={busy}>{t("save")}</button>
            <button type="button" className="ghost" onClick={() => { setForm(null); setErr(""); }}>{t("cancel")}</button>
          </div>
        </form>
      )}

      <div className="row" style={{ marginBottom: 12 }}>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <span>{t("filterProperty")}:</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">{t("all")}</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      {loading ? <p>{t("loading")}</p> : filtered.length === 0 && !form ? (
        <p className="info">{t("noRooms")}</p>
      ) : (
        <div className="list">
          {filtered.map((r) => (
            <div className="card" key={r.id}>
              <div className="row between">
                <strong>{r.code} · {propName(r.propertyId)}</strong>
                {canEdit && (
                  <div className="row">
                    <button className="ghost" onClick={() => { setErr(""); openEdit(r); }}>{t("edit")}</button>
                    <button className="ghost danger" onClick={() => remove(r)}>{t("delete")}</button>
                  </div>
                )}
              </div>
              <div className="row wrap">
                <span className={"tag " + r.status}>
                  {r.status === "vacant" ? t("statusVacant") : r.status === "occupied" ? t("statusOccupied") : t("statusMaintenance")}
                </span>
                <span><MoneyText value={r.baseRent} /> / {t("month")}</span>
                {r.area ? <span>{r.area} m²</span> : null}
                {r.floor != null ? <span>{t("floor")} {r.floor}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

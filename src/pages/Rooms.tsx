import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type ContractDoc, type PropertyDoc, type RoomDoc, type RoomStatus, type TenantDoc } from "../lib/types";
import MoneyText from "../components/MoneyText";
import NumInput from "../components/NumInput";
import { IcDoor, IcPlus, IcCal, IcUser } from "../components/Icons";

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
  const { data: contracts } = useCollection<ContractDoc>("contracts");
  const { data: tenants } = useCollection<TenantDoc>("tenants");
  const [filter, setFilter] = useState<string>("");
  const [statusF, setStatusF] = useState<RoomStatus | "all">("all");
  const [q, setQ] = useState("");
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
    const live = contracts.filter((c) => c.roomId === r.id && (c.status === "active" || c.status === "draft")).length;
    if (!confirm(live > 0
      ? `Phòng ${r.code} đang có ${live} hợp đồng (nháp/hiệu lực). Xóa phòng sẽ làm các hợp đồng mất thông tin phòng.\n\nVẫn tiếp tục?`
      : t("deleteRoomSure"))) return;
    if (!confirm(`XÁC NHẬN LẦN 2: xóa phòng ${r.code}? Không thể hoàn tác.`)) return;
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

  const byProp = useMemo(() => (filter ? rooms.filter((r) => r.propertyId === filter) : rooms), [rooms, filter]);
  const count = (st: RoomStatus) => byProp.filter((r) => r.status === st).length;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return byProp
      .filter((r) => statusF === "all" || r.status === statusF)
      .filter((r) => !needle || r.code.toLowerCase().includes(needle) || propName(r.propertyId).toLowerCase().includes(needle))
      .sort((a, b) => a.code.localeCompare(b.code, "vi", { numeric: true }));
  }, [byProp, statusF, q, properties]); // eslint-disable-line react-hooks/exhaustive-deps

  const occupant = (roomId: string) => {
    const c = contracts.find((x) => x.roomId === roomId && x.status === "active");
    if (!c) return null;
    return { name: tenants.find((x) => x.id === c.tenantId)?.name ?? "—", end: c.endDate, id: c.id };
  };
  const statusText = (st: RoomStatus) => (st === "vacant" ? t("statusVacant") : st === "occupied" ? t("statusOccupied") : t("statusMaintenance"));
  const fmtDate = (d: string) => (d ? d.split("-").reverse().join("/") : "");
  const potential = byProp.filter((r) => r.status === "vacant").reduce((sum, r) => sum + (Number(r.baseRent) || 0), 0);

  const chips: { key: RoomStatus | "all"; label: string; n: number }[] = [
    { key: "all", label: "Tất cả", n: byProp.length },
    { key: "vacant", label: t("statusVacant"), n: count("vacant") },
    { key: "occupied", label: t("statusOccupied"), n: count("occupied") },
    { key: "maintenance", label: t("statusMaintenance"), n: count("maintenance") },
  ];

  return (
    <section className="ct rm">
      <div className="ct-head">
        <div>
          <h2>{t("rooms")}</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Tình trạng từng phòng, giá thuê và khách đang ở.</p>
        </div>
        {canEdit && !form && properties.length > 0 && (
          <button className="ct-btn-primary" onClick={() => { setErr(""); setForm(empty(properties[0]?.id ?? "")); }}>
            <IcPlus /> {t("addRoom")}
          </button>
        )}
      </div>

      <div className="ct-stats">
        <div className="ct-stat"><span className="ct-stat-n">{byProp.length}</span><span className="ct-stat-l">{t("totalRooms")}</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{count("vacant")}</span><span className="ct-stat-l">{t("vacantRooms")}</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{count("occupied")}</span><span className="ct-stat-l">{t("occupiedRooms")}</span></div>
        <div className="ct-stat"><span className="ct-stat-n ct-num"><MoneyText value={potential} /></span><span className="ct-stat-l">Tiền thuê nếu lấp đầy phòng trống / tháng</span></div>
      </div>

      {err && <p className="error" role="alert">{err}</p>}

      {form && (
        <form className="card ct-form" onSubmit={save}>
          <h3>{form.id ? t("editRoom") : t("addRoom")}</h3>

          <h4 className="rm-sec">Thông tin chung</h4>
          <div className="ct-grid2">
            <label>{t("roomProperty")}
              <select required value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
                <option value="">{t("none")}</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>{t("roomCode")}<input required maxLength={20} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
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

          <h4 className="rm-sec">Giá</h4>
          <div className="ct-grid2">
            <label>{t("roomRent")}<NumInput min={0} value={form.baseRent} onChange={(e) => setForm({ ...form, baseRent: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("roomDeposit")}<NumInput min={0} value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("electricStart")}<NumInput min={0} value={form.electricStart} onChange={(e) => setForm({ ...form, electricStart: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("waterStart")}<NumInput min={0} value={form.waterStart} onChange={(e) => setForm({ ...form, waterStart: e.target.value === "" ? "" : +e.target.value })} /></label>
          </div>

          <h4 className="rm-sec">Mô tả</h4>
          <label>{t("roomAmenities")}<textarea rows={3} placeholder={t("roomAmenitiesHint")} value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} /></label>
          <div className="ct-grid2" style={{ marginTop: 12 }}>
            <label>{t("roomDesc")}<textarea rows={3} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></label>
            <label>{t("roomDescEn")}<textarea rows={3} value={form.descEn} onChange={(e) => setForm({ ...form, descEn: e.target.value })} /></label>
          </div>

          <div className="ct-actions">
            <button type="submit" disabled={busy}>{busy ? "Đang lưu…" : t("save")}</button>
            <button type="button" className="ghost" onClick={() => { setForm(null); setErr(""); }}>{t("cancel")}</button>
          </div>
        </form>
      )}

      {rooms.length > 0 && (
        <div className="ct-toolbar">
          <div className="ct-chips" role="group" aria-label="Lọc theo trạng thái phòng">
            {chips.map((c) => (
              <button key={c.key} type="button" className={"ct-chip" + (statusF === c.key ? " on" : "")}
                aria-pressed={statusF === c.key} onClick={() => setStatusF(c.key)}>
                {c.label} <span className="ct-chip-n">{c.n}</span>
              </button>
            ))}
          </div>
          <div className="rm-filters">
            {properties.length > 1 && (
              <label className="rm-prop">
                <span className="sr">{t("filterProperty")}</span>
                <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t("filterProperty")}>
                  <option value="">{t("filterProperty")}: {t("all")}</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            <label className="ct-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" placeholder="Tìm mã phòng…" aria-label="Tìm phòng" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        </div>
      )}
      <p className="ct-count" role="status" aria-atomic="true">
        {!loading && rooms.length > 0 ? `Hiển thị ${filtered.length} / ${byProp.length} phòng` : ""}
      </p>

      {loading ? (
        <div className="ct-list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="ct-card ct-skel" />)}</div>
      ) : rooms.length === 0 && !form ? (
        <div className="ct-empty">
          <strong>{t("noRooms")}</strong>
          {properties.length === 0
            ? <><span>Cần tạo nhà trọ trước khi thêm phòng.</span><Link className="linkbtn primary" to="/app/properties">Thêm nhà trọ</Link></>
            : <span>Bấm “{t("addRoom")}” để tạo phòng đầu tiên.</span>}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ct-empty"><strong>Không có phòng phù hợp bộ lọc.</strong>
          <button className="ghost" onClick={() => { setStatusF("all"); setFilter(""); setQ(""); }}>Xóa bộ lọc</button></div>
      ) : (
        <div className="ct-list rm-grid">
          {filtered.map((r) => {
            const occ = r.status === "occupied" ? occupant(r.id) : null;
            const photo = r.photos?.[0];
            const amen = r.amenities ?? [];
            return (
              <article className="ct-card rm-card" key={r.id}>
                {photo
                  ? <img className="rm-img" src={photo} alt={`Ảnh phòng ${r.code}`} loading="lazy" />
                  : <div className="rm-img rm-img-empty" aria-hidden="true"><IcDoor /><span>Chưa có ảnh</span></div>}
                <div className="rm-body">
                  <header className="ct-card-head">
                    <div style={{ minWidth: 0 }}>
                      <div className="ct-code">Phòng {r.code}</div>
                      <div className="ct-sub">{propName(r.propertyId)}</div>
                    </div>
                    <span className={"tag " + r.status}>{statusText(r.status)}</span>
                  </header>

                  <div className="rm-price ct-num"><MoneyText value={r.baseRent} /><span className="ct-sub"> / {t("month")}</span></div>
                  <div className="rm-facts ct-sub">
                    {r.area ? <span>{r.area} m²</span> : null}
                    {r.floor != null ? <span>{t("floor")} {r.floor}</span> : null}
                    {r.deposit ? <span>Cọc <MoneyText value={r.deposit} /></span> : null}
                  </div>

                  {amen.length > 0 && (
                    <ul className="rm-amen" aria-label="Tiện ích">
                      {amen.slice(0, 4).map((a) => <li key={a}>{a}</li>)}
                      {amen.length > 4 && <li>+{amen.length - 4}</li>}
                    </ul>
                  )}

                  {occ && (
                    <Link className="rm-occ" to={`/app/contracts/${occ.id}/edit`}>
                      <span><IcUser /> {occ.name}</span>
                      {occ.end && <span className="ct-sub ct-num"><IcCal /> đến {fmtDate(occ.end)}</span>}
                    </Link>
                  )}

                  {(r.published || r.featured) && (
                    <div className="rm-flags ct-sub">
                      {r.published && <span>Đang hiển thị công khai</span>}
                      {r.featured && <span>Nổi bật</span>}
                    </div>
                  )}

                  {canEdit && (
                    <footer className="ct-actions">
                      <button className="ghost" onClick={() => { setErr(""); openEdit(r); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t("edit")}</button>
                      <button className="ghost danger" onClick={() => remove(r)}>{t("delete")}</button>
                    </footer>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

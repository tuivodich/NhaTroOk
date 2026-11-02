// setup-pages.mjs — Chay: node setup-pages.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const B = "`";
const D = "${";
function w(p, c) {
  const full = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, c, "utf8");
  console.log("OK " + p);
}

// ============ src/main.tsx ============
w("src/main.tsx", String.raw`import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BrandProvider } from "./brand/BrandProvider";
import { I18nProvider } from "./lib/i18n";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrandProvider>
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </BrandProvider>
  </StrictMode>,
);
`);

// ============ src/App.tsx ============
w("src/App.tsx", String.raw`import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import StaffShell from "./StaffShell";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dang-nhap" element={<Login />} />
      <Route path="/app/*" element={<StaffShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
`);

// ============ src/pages/Landing.tsx ============
w("src/pages/Landing.tsx", String.raw`import { Link } from "react-router-dom";
import { useBrand } from "../brand/BrandProvider";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { BrandLogo } from "../brand/BrandName";

export default function Landing() {
  const brand = useBrand();
  const { user, profile } = useAuth();
  const { t, lang, setLang } = useI18n();

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="brand">
          <BrandLogo size={32} />
          <span>{brand.name}</span>
        </div>
        <div className="row">
          <button className="ghost" onClick={() => setLang(lang === "vi" ? "en" : "vi")}>{lang === "vi" ? "EN" : "VI"}</button>
          {user ? (
            <Link className="linkbtn primary" to={profile?.role === "tenant" ? "/" : "/app"}>{t("goToAdmin")}</Link>
          ) : (
            <Link className="linkbtn primary" to="/dang-nhap">{t("login")}</Link>
          )}
        </div>
      </header>

      <main className="landing-hero">
        <h1 style={{ color: brand.brandColor }}>{brand.name}</h1>
        {brand.tagline && <p className="tagline">{brand.tagline}</p>}
        <p className="info">{t("comingSoonDesc")}</p>
      </main>

      <footer className="landing-footer">
        <small>© {new Date().getFullYear()} {brand.name}</small>
      </footer>
    </div>
  );
}
`);

// ============ src/pages/Login.tsx ============
w("src/pages/Login.tsx", String.raw`import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useBrand } from "../brand/BrandProvider";

export default function Login() {
  const { user, loading, login, register, loginGoogle } = useAuth();
  const { t } = useI18n();
  const brand = useBrand();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) navigate(next, { replace: true }); }, [user, loading, navigate, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    } catch (ex) {
      setErr((ex as Error).message.replace(/^Firebase:\s*/, ""));
    } finally { setBusy(false); }
  };

  const google = async () => {
    setErr(""); setBusy(true);
    try { await loginGoogle(); } catch (ex) { setErr((ex as Error).message.replace(/^Firebase:\s*/, "")); } finally { setBusy(false); }
  };

  return (
    <div className="authpage">
      <div className="card authcard">
        <h1 style={{ color: brand.brandColor, marginTop: 0 }}>{brand.name}</h1>
        <h2 style={{ color: "var(--muted)", textAlign: "center", fontSize: 15, marginTop: 0 }}>
          {mode === "login" ? t("signInTitle") : t("signUpTitle")}
        </h2>
        <form onSubmit={submit}>
          <label>{t("email")}<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>{t("password")}<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {err && <p className="error">{err}</p>}
          <button type="submit" disabled={busy}>{mode === "login" ? t("login") : t("register")}</button>
        </form>
        <button type="button" className="ghost block" onClick={google} disabled={busy}>{t("loginGoogle")}</button>
        <p style={{ textAlign: "center", marginTop: 12 }}>
          <button type="button" className="linkbtn" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? t("noAccount") : t("haveAccount")}
          </button>
        </p>
        {mode === "register" && <p className="info">{t("firstUserHint")}</p>}
      </div>
    </div>
  );
}
`);

// ============ src/pages/Dashboard.tsx ============
w("src/pages/Dashboard.tsx", String.raw`import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCollection } from "../lib/useCollection";
import type { PropertyDoc, RoomDoc } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { useBrand } from "../brand/BrandProvider";

export default function Dashboard() {
  const { t } = useI18n();
  const brand = useBrand();
  const { data: properties } = useCollection<PropertyDoc>("properties");
  const { data: rooms } = useCollection<RoomDoc>("rooms");

  const stats = useMemo(() => ({
    properties: properties.length,
    rooms: rooms.length,
    vacant: rooms.filter((r) => r.status === "vacant").length,
    occupied: rooms.filter((r) => r.status === "occupied").length,
  }), [properties, rooms]);

  return (
    <section>
      <h2>{t("dashboard")}</h2>
      <p className="info">{brand.tagline || brand.name}</p>

      <div className="stats">
        <div className="stat"><div className="num">{stats.properties}</div><div className="label">{t("totalProperties")}</div></div>
        <div className="stat"><div className="num">{stats.rooms}</div><div className="label">{t("totalRooms")}</div></div>
        <div className="stat"><div className="num">{stats.vacant}</div><div className="label">{t("vacantRooms")}</div></div>
        <div className="stat"><div className="num">{stats.occupied}</div><div className="label">{t("occupiedRooms")}</div></div>
      </div>

      <h3 style={{ marginTop: 20, fontSize: 16, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{t("quickActions")}</h3>
      <div className="row">
        <Link className="linkbtn primary" to="/app/properties">{t("addProperty")}</Link>
        <Link className="linkbtn primary" to="/app/rooms">{t("addRoom")}</Link>
        <Link className="linkbtn" to="/app/settings/brand">{t("brandTitle")}</Link>
      </div>
    </section>
  );
}
`);

// ============ src/pages/Properties.tsx ============
w("src/pages/Properties.tsx", String.raw`import { useState, type FormEvent } from "react";
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
`);

// ============ src/pages/Rooms.tsx ============
w("src/pages/Rooms.tsx", String.raw`import { useState, type FormEvent } from "react";
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

      const payload = {
        propertyId: form.propertyId,
        code: form.code.trim(),
        floor: form.floor ? +form.floor : undefined,
        area: form.area ? +form.area : undefined,
        baseRent: +form.baseRent,
        deposit: form.deposit !== "" ? +form.deposit : undefined,
        status: form.status,
        amenities: toLines(form.amenities),
        desc: form.desc.trim() || undefined,
        descEn: form.descEn.trim() || undefined,
        meter: {
          ...(form.electricStart !== "" ? { electricStart: +form.electricStart } : {}),
          ...(form.waterStart !== "" ? { waterStart: +form.waterStart } : {}),
        },
      };

      if (form.id) {
        await updateDoc(doc(db, "rooms", form.id), payload);
        audit("room.update", "Sua phong " + payload.code, { type: "room", id: form.id });
      } else {
        const ref = await addDoc(collection(db, "rooms"), payload);
        audit("room.create", "Them phong " + payload.code, { type: "room", id: ref.id });
      }
      setForm(null);
    } catch (ex) {
      console.error("room save failed", ex);
      setErr(t("error"));
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
`);

// ============ src/pages/Tenants.tsx ============
w("src/pages/Tenants.tsx", String.raw`import { useState, type FormEvent } from "react";
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
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        idNumber: form.idNumber.trim() || undefined,
        roomId: form.roomId || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (form.id) {
        await updateDoc(doc(db, "tenants", form.id), payload);
        audit("tenant.update", "Sua khach " + payload.name, { type: "tenant", id: form.id });
      } else {
        const ref = await addDoc(collection(db, "tenants"), payload);
        audit("tenant.create", "Them khach " + payload.name, { type: "tenant", id: ref.id });
      }
      setForm(null);
    } catch (ex) {
      console.error("tenant save failed", ex);
      setErr(t("error"));
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
`);

// ============ src/pages/Contracts.tsx ============
w("src/pages/Contracts.tsx", String.raw`import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type ContractDoc, type RoomDoc, type TenantDoc, type ContractStatus } from "../lib/types";
import MoneyText from "../components/MoneyText";
import NumInput from "../components/NumInput";

interface F {
  id?: string;
  tenantId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  rent: number | "";
  deposit: number | "";
  status: ContractStatus;
  notes: string;
}
const empty: F = { tenantId: "", roomId: "", startDate: "", endDate: "", rent: "", deposit: "", status: "active", notes: "" };

export default function Contracts() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: contracts, loading } = useCollection<ContractDoc>("contracts");
  const { data: tenants } = useCollection<TenantDoc>("tenants");
  const { data: rooms } = useCollection<RoomDoc>("rooms");
  const [form, setForm] = useState<F | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const tenantName = (id: string) => tenants.find((x) => x.id === id)?.name ?? id;
  const roomCode = (id: string) => rooms.find((x) => x.id === id)?.code ?? id;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErr(""); setBusy(true);
    try {
      if (!form.tenantId || !form.roomId) { setErr(t("error")); return; }
      if (!form.startDate || !form.endDate) { setErr(t("error")); return; }
      if (form.rent === "" || +form.rent < 0) { setErr(t("error")); return; }
      const payload = {
        tenantId: form.tenantId,
        roomId: form.roomId,
        startDate: form.startDate,
        endDate: form.endDate,
        rent: +form.rent,
        deposit: form.deposit !== "" ? +form.deposit : undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      };
      if (form.id) {
        await updateDoc(doc(db, "contracts", form.id), payload);
        audit("contract.update", "Sua hop dong", { type: "contract", id: form.id });
      } else {
        const ref = await addDoc(collection(db, "contracts"), payload);
        audit("contract.create", "Them hop dong", { type: "contract", id: ref.id });
      }
      setForm(null);
    } catch (ex) {
      console.error("contract save failed", ex);
      setErr(t("error"));
    } finally { setBusy(false); }
  };

  const remove = async (c: ContractDoc) => {
    if (!confirm(t("deleteContractSure"))) return;
    try {
      await deleteDoc(doc(db, "contracts", c.id));
      audit("contract.delete", "Xoa hop dong", { type: "contract", id: c.id });
    } catch (ex) {
      console.error("delete contract failed", ex);
      setErr(t("error"));
    }
  };

  return (
    <section>
      <div className="row between">
        <h2>{t("contracts")}</h2>
        {canEdit && !form && <button onClick={() => { setErr(""); setForm({ ...empty }); }}>+ {t("addContract")}</button>}
      </div>
      {err && <p className="error">{err}</p>}

      {form && (
        <form className="card" onSubmit={save}>
          <h3>{form.id ? t("editContract") : t("addContract")}</h3>
          <div className="row">
            <label>{t("contractTenant")}
              <select required value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>
                <option value="">{t("none")}</option>
                {tenants.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>{t("contractRoom")}
              <select required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">{t("none")}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <label>{t("contractStart")}<input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label>{t("contractEnd")}<input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
          </div>
          <div className="row">
            <label>{t("contractRent")}<NumInput min={0} value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("contractDeposit")}<NumInput min={0} value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("status")}
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })}>
                <option value="active">{t("contractActive")}</option>
                <option value="expired">{t("contractExpired")}</option>
                <option value="cancelled">{t("contractCancelled")}</option>
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

      {loading ? <p>{t("loading")}</p> : contracts.length === 0 && !form ? (
        <p className="info">{t("noContracts")}</p>
      ) : (
        <div className="list">
          {contracts.map((c) => (
            <div className="card" key={c.id}>
              <div className="row between">
                <strong>{tenantName(c.tenantId)} · {roomCode(c.roomId)}</strong>
                {canEdit && (
                  <div className="row">
                    <button className="ghost" onClick={() => { setErr(""); setForm({ id: c.id, tenantId: c.tenantId, roomId: c.roomId, startDate: c.startDate, endDate: c.endDate, rent: c.rent, deposit: c.deposit ?? "", status: c.status, notes: c.notes ?? "" }); }}>{t("edit")}</button>
                    <button className="ghost danger" onClick={() => remove(c)}>{t("delete")}</button>
                  </div>
                )}
              </div>
              <div className="row wrap">
                <span>{c.startDate} → {c.endDate}</span>
                <span><MoneyText value={c.rent} /> / {t("month")}</span>
                <span className={"tag " + c.status}>
                  {c.status === "active" ? t("contractActive") : c.status === "expired" ? t("contractExpired") : t("contractCancelled")}
                </span>
              </div>
              {c.notes ? <small>{c.notes}</small> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
`);

// ============ src/pages/Invoices.tsx ============
w("src/pages/Invoices.tsx", String.raw`import { useState, type FormEvent } from "react";
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
      if (!form.roomId || !form.month) { setErr(t("error")); return; }
      if (form.total === "" || +form.total < 0) { setErr(t("error")); return; }
      const payload = {
        roomId: form.roomId,
        tenantId: form.tenantId || undefined,
        month: form.month,
        total: +form.total,
        status: form.status,
        dueDate: form.dueDate || undefined,
        notes: form.notes.trim() || undefined,
        items: [],
      };
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
      setErr(t("error"));
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
`);

// ============ src/pages/Users.tsx ============
w("src/pages/Users.tsx", String.raw`import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type Role, type UserProfile } from "../lib/types";

export default function Users() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: users, loading } = useCollection<UserProfile>("users");
  const [err, setErr] = useState("");

  const changeRole = async (u: UserProfile, role: Role) => {
    if (!canEdit) return;
    try {
      await updateDoc(doc(db, "users", u.id), { role });
      audit("user.role", "Doi quyen " + (u.email ?? u.id) + " -> " + role, { type: "user", id: u.id });
    } catch (ex) {
      console.error("change role failed", ex);
      setErr(t("error"));
    }
  };

  return (
    <section>
      <h2>{t("users")}</h2>
      {err && <p className="error">{err}</p>}
      {loading ? <p>{t("loading")}</p> : users.length === 0 ? (
        <p className="info">{t("noUsers")}</p>
      ) : (
        <div className="list">
          {users.map((u) => (
            <div className="card" key={u.id}>
              <div className="row between">
                <strong>{u.displayName || u.email || u.id}</strong>
                {canEdit ? (
                  <select value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)}>
                    <option value="admin">admin</option>
                    <option value="staff">staff</option>
                    <option value="tenant">tenant</option>
                  </select>
                ) : (
                  <span className="tag">{u.role}</span>
                )}
              </div>
              {u.email ? <small>{u.email}</small> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
`);

// ============ src/pages/AuditLog.tsx ============
w("src/pages/AuditLog.tsx", String.raw`import { useCollection } from "../lib/useCollection";
import { useI18n } from "../lib/i18n";
import type { AuditDoc } from "../lib/types";

export default function AuditLog() {
  const { t } = useI18n();
  const { data, loading } = useCollection<AuditDoc>("auditLogs");

  const sorted = [...data].sort((a, b) => {
    const av = (a.at as any)?.seconds ?? 0;
    const bv = (b.at as any)?.seconds ?? 0;
    return bv - av;
  });

  return (
    <section>
      <h2>{t("auditLog")}</h2>
      {loading ? <p>{t("loading")}</p> : sorted.length === 0 ? (
        <p className="info">{t("noAudit")}</p>
      ) : (
        <div className="list">
          {sorted.slice(0, 200).map((x) => (
            <div className="card" key={x.id}>
              <div className="row between">
                <strong>{x.action}</strong>
                <small>{x.email || x.uid || ""}</small>
              </div>
              <div>{x.message}</div>
              {x.target ? <small>{x.target.type} · {x.target.id}</small> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
`);

// ============ src/pages/Settings.tsx ============
w("src/pages/Settings.tsx", String.raw`import { useState, type FormEvent } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db } from "../lib/firebase";
import { auth } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setMsg("");
    try {
      await updateProfile(user, { displayName: name.trim() });
      await updateDoc(doc(db, "users", user.uid), { displayName: name.trim() });
      setMsg(t("saved"));
    } catch (ex) {
      console.error("save profile failed", ex);
      setMsg(t("error"));
    } finally { setBusy(false); }
  };

  return (
    <section>
      <h2>{t("settings")}</h2>
      <form className="card" onSubmit={save}>
        <h3>{t("profile")}</h3>
        <label>{t("displayName")}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{t("email")}<input value={user?.email ?? ""} disabled /></label>
        <label>{t("language")}
          <select value={lang} onChange={(e) => setLang(e.target.value as "vi" | "en")}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        {msg && <p className="info">{msg}</p>}
        <div className="row"><button type="submit" disabled={busy}>{t("save")}</button></div>
      </form>
    </section>
  );
}
`);

// ============ src/pages/SettingsBrand.tsx ============
w("src/pages/SettingsBrand.tsx", String.raw`import { useState, type FormEvent } from "react";
import { useBrand } from "../brand/BrandProvider";
import { useI18n } from "../lib/i18n";

export default function SettingsBrand() {
  const { t } = useI18n();
  const brand = useBrand();
  const [name, setName] = useState(brand.name);
  const [tagline, setTagline] = useState(brand.tagline);
  const [color, setColor] = useState(brand.brandColor);
  const [msg, setMsg] = useState("");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      await brand.update({ name: name.trim() || "Nha Tro", tagline: tagline.trim(), brandColor: color });
      setMsg(t("saved"));
    } catch (ex) {
      console.error("save brand failed", ex);
      setMsg(t("error"));
    }
  };

  return (
    <section>
      <h2>{t("brandTitle")}</h2>
      <form className="card" onSubmit={save}>
        <label>{t("brandName")}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{t("brandTagline")}<input value={tagline} onChange={(e) => setTagline(e.target.value)} /></label>
        <label>{t("brandColor")}<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        {msg && <p className="info">{msg}</p>}
        <div className="row">
          <button type="submit">{t("save")}</button>
          <button type="button" className="ghost" onClick={() => brand.reset()}>{t("reset")}</button>
        </div>
      </form>
    </section>
  );
}
`);

// ============ src/StaffShell.tsx ============
w("src/StaffShell.tsx", String.raw`import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { useI18n } from "./lib/i18n";
import { useBrand } from "./brand/BrandProvider";
import { BrandLogo } from "./brand/BrandName";
import { isAdminRole } from "./lib/types";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Rooms from "./pages/Rooms";
import Tenants from "./pages/Tenants";
import Contracts from "./pages/Contracts";
import Invoices from "./pages/Invoices";
import Users from "./pages/Users";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import SettingsBrand from "./pages/SettingsBrand";

export default function StaffShell() {
  const { user, profile, loading, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const brand = useBrand();
  const navigate = useNavigate();

  if (loading) return <div className="authpage"><p>{t("loading")}</p></div>;
  if (!user) return <Navigate to="/dang-nhap?next=/app" replace />;

  const isAdmin = isAdminRole(profile?.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo size={26} />
          <span>{brand.name}</span>
        </div>
        <nav>
          <NavLink to="/app" end>{t("dashboard")}</NavLink>
          <NavLink to="/app/properties">{t("properties")}</NavLink>
          <NavLink to="/app/rooms">{t("rooms")}</NavLink>
          <NavLink to="/app/tenants">{t("tenants")}</NavLink>
          <NavLink to="/app/contracts">{t("contracts")}</NavLink>
          <NavLink to="/app/invoices">{t("invoices")}</NavLink>
          {isAdmin && <NavLink to="/app/users">{t("users")}</NavLink>}
          {isAdmin && <NavLink to="/app/audit">{t("auditLog")}</NavLink>}
          <NavLink to="/app/settings">{t("settings")}</NavLink>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div />
          <div className="row">
            <button className="ghost" onClick={() => setLang(lang === "vi" ? "en" : "vi")}>{lang === "vi" ? "EN" : "VI"}</button>
            <span>{profile?.displayName || user.email}</span>
            <button className="ghost" onClick={async () => { await logout(); navigate("/"); }}>{t("logout")}</button>
          </div>
        </header>
        <div className="content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="properties" element={<Properties />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="invoices" element={<Invoices />} />
            {isAdmin && <Route path="users" element={<Users />} />}
            {isAdmin && <Route path="audit" element={<AuditLog />} />}
            <Route path="settings" element={<Settings />} />
            {isAdmin && <Route path="settings/brand" element={<SettingsBrand />} />}
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
`);

// ============ src/components/MoneyText.tsx ============
w("src/components/MoneyText.tsx", String.raw`interface Props { value?: number | null; suffix?: string; }
export default function MoneyText({ value, suffix }: Props) {
  if (value == null) return <span>—</span>;
  const formatted = new Intl.NumberFormat("vi-VN").format(value);
  return <span>{formatted}{suffix ? " " + suffix : " đ"}</span>;
}
`);

// ============ src/components/NumInput.tsx ============
w("src/components/NumInput.tsx", String.raw`import type { InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number | "";
  onChange: (e: { target: { value: string } }) => void;
}

export default function NumInput({ value, onChange, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange({ target: { value: e.target.value } })}
    />
  );
}
`);

// ============ src/brand/BrandName.tsx ============
w("src/brand/BrandName.tsx", String.raw`import { useBrand } from "./BrandProvider";

export function BrandLogo({ size = 28 }: { size?: number }) {
  const brand = useBrand();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill={brand.brandColor} />
      <path d="M14 34 L32 18 L50 34 V50 H40 V40 H24 V50 H14 Z" fill="#fff" opacity="0.95" />
    </svg>
  );
}
`);

// ============ src/brand/BrandProvider.tsx ============
w("src/brand/BrandProvider.tsx", String.raw`import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface BrandConfig {
  name: string;
  tagline: string;
  brandColor: string;
}

interface BrandContextValue extends BrandConfig {
  update: (patch: Partial<BrandConfig>) => Promise<void>;
  reset: () => void;
}

const DEFAULTS: BrandConfig = {
  name: "Nha Tro",
  tagline: "Quản lý nhà trọ gọn gàng, hiện đại",
  brandColor: "#2563eb",
};

const KEY = "brand-config-v1";

const Ctx = createContext<BrandContextValue | null>(null);

function readStore(): BrandConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { return DEFAULTS; }
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BrandConfig>(() => readStore());

  useEffect(() => {
    document.documentElement.style.setProperty("--brand", config.brandColor);
    document.title = config.name;
  }, [config]);

  const update = async (patch: Partial<BrandConfig>) => {
    const next = { ...config, ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    setConfig(next);
  };

  const reset = () => {
    localStorage.removeItem(KEY);
    setConfig(DEFAULTS);
  };

  return <Ctx.Provider value={{ ...config, update, reset }}>{children}</Ctx.Provider>;
}

export function useBrand() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBrand must be inside BrandProvider");
  return v;
}
`);

// ============ src/lib/firebase.ts ============
w("src/lib/firebase.ts", String.raw`import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
`);

// ============ src/lib/types.ts ============
w("src/lib/types.ts", String.raw`export type Role = "admin" | "staff" | "tenant";
export type RoomStatus = "vacant" | "occupied" | "maintenance";
export type ContractStatus = "active" | "expired" | "cancelled";
export type InvoiceStatus = "unpaid" | "paid" | "overdue";

export interface UserProfile {
  id: string;
  uid?: string;
  email?: string;
  displayName?: string;
  role: Role;
  createdAt?: unknown;
}

export interface PropertyDoc {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  roomCount?: number;
}

export interface RoomDoc {
  id: string;
  propertyId: string;
  code: string;
  floor?: number;
  area?: number;
  baseRent: number;
  deposit?: number;
  status: RoomStatus;
  amenities?: string[];
  desc?: string;
  descEn?: string;
  meter?: { electricStart?: number; waterStart?: number };
}

export interface TenantDoc {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  roomId?: string;
  notes?: string;
}

export interface ContractDoc {
  id: string;
  tenantId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  rent: number;
  deposit?: number;
  status: ContractStatus;
  notes?: string;
}

export interface InvoiceItem { label: string; amount: number; }
export interface InvoiceDoc {
  id: string;
  roomId: string;
  tenantId?: string;
  month: string;
  items?: InvoiceItem[];
  total: number;
  status: InvoiceStatus;
  dueDate?: string;
  paidAt?: number;
  notes?: string;
}

export interface AuditDoc {
  id: string;
  action: string;
  message: string;
  target?: { type: string; id: string } | null;
  uid?: string | null;
  email?: string | null;
  role?: Role | null;
  at?: unknown;
}

export function isAdminRole(role?: Role | null): boolean {
  return role === "admin";
}
`);

// ============ src/lib/useCollection.ts ============
w("src/lib/useCollection.ts", String.raw`import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export function useCollection<T>(name: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, name),
      (snap) => {
        const rows: T[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as unknown as T);
        setData(rows);
        setLoading(false);
      },
      (err) => { setError(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [name]);

  return { data, loading, error };
}
`);

// ============ src/lib/audit.ts ============
w("src/lib/audit.ts", String.raw`import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./auth";

export function useAudit() {
  const { user, profile } = useAuth();
  return (action: string, message: string, target?: { type: string; id: string }) => {
    addDoc(collection(db, "auditLogs"), {
      action,
      message,
      target: target ?? null,
      uid: user?.uid ?? null,
      email: user?.email ?? profile?.email ?? null,
      role: profile?.role ?? null,
      at: serverTimestamp(),
    }).catch((e) => console.error("audit failed", e));
  };
}
`);

// ============ src/lib/auth.tsx ============
w("src/lib/auth.tsx", String.raw`import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Role, UserProfile } from "./types";

interface AuthCtx {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function ensureProfile(u: User) {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const all = await getDocs(query(collection(db, "users"), limit(1)));
  const isFirst = all.empty;
  await setDoc(ref, {
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    role: (isFirst ? "admin" : "staff") as Role,
    createdAt: serverTimestamp(),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      if (!u) { setProfile(null); setLoading(false); return; }
      try {
        await ensureProfile(u);
        unsubProfile = onSnapshot(
          doc(db, "users", u.uid),
          (snap) => {
            if (snap.exists()) setProfile({ ...(snap.data() as object), id: u.uid } as UserProfile);
            else setProfile(null);
            setLoading(false);
          },
          (err) => { console.error("profile listen failed", err); setLoading(false); }
        );
      } catch (e) {
        console.error("ensure profile failed", e);
        setLoading(false);
      }
    });
    return () => { unsub(); if (unsubProfile) unsubProfile(); };
  }, []);

  const login = async (email: string, password: string) => { await signInWithEmailAndPassword(auth, email, password); };
  const register = async (email: string, password: string) => { await createUserWithEmailAndPassword(auth, email, password); };
  const loginGoogle = async () => { await signInWithPopup(auth, new GoogleAuthProvider()); };
  const logout = async () => { await signOut(auth); };

  return <Ctx.Provider value={{ user, profile, loading, login, register, loginGoogle, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
`);

// ============ src/lib/i18n.tsx ============
w("src/lib/i18n.tsx", String.raw`import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Lang = "vi" | "en";
type Dict = Record<string, string>;

const VI: Dict = {
  login: "Đăng nhập", register: "Đăng ký", logout: "Đăng xuất",
  email: "Email", password: "Mật khẩu", displayName: "Tên hiển thị",
  loginGoogle: "Đăng nhập bằng Google",
  signInTitle: "Đăng nhập vào hệ thống", signUpTitle: "Tạo tài khoản mới",
  noAccount: "Chưa có tài khoản? Đăng ký", haveAccount: "Đã có tài khoản? Đăng nhập",
  firstUserHint: "Người dùng đầu tiên sẽ trở thành quản trị viên.",
  goToAdmin: "Vào quản trị", comingSoonDesc: "Hệ thống quản lý nhà trọ.",

  dashboard: "Tổng quan", properties: "Nhà trọ", rooms: "Phòng", tenants: "Khách thuê",
  contracts: "Hợp đồng", invoices: "Hóa đơn", users: "Người dùng", auditLog: "Nhật ký",
  settings: "Cài đặt", loading: "Đang tải...", error: "Có lỗi xảy ra", save: "Lưu",
  cancel: "Hủy", edit: "Sửa", delete: "Xóa", none: "—", all: "Tất cả", status: "Trạng thái",
  notes: "Ghi chú", month: "tháng", floor: "Tầng", saved: "Đã lưu", reset: "Đặt lại",
  profile: "Thông tin cá nhân", language: "Ngôn ngữ",

  totalProperties: "Tổng nhà trọ", totalRooms: "Tổng phòng",
  vacantRooms: "Phòng trống", occupiedRooms: "Phòng đang thuê",
  quickActions: "Thao tác nhanh", addProperty: "Thêm nhà trọ", addRoom: "Thêm phòng",

  propertyName: "Tên nhà trọ", propertyAddress: "Địa chỉ", propertyNotes: "Ghi chú",
  editProperty: "Sửa nhà trọ", deletePropertySure: "Xóa nhà trọ này?",
  propertyHasRooms: "Không thể xóa: nhà trọ còn phòng.", propertyRooms: "Số phòng",
  noProperties: "Chưa có nhà trọ nào.",

  roomProperty: "Nhà trọ", roomCode: "Mã phòng", roomFloor: "Tầng", roomArea: "Diện tích (m²)",
  roomRent: "Giá thuê", roomDeposit: "Tiền cọc", roomStatus: "Trạng thái phòng",
  roomAmenities: "Tiện ích (mỗi dòng một mục)", roomAmenitiesHint: "WiFi, Điều hòa, Nóng lạnh...",
  roomDesc: "Mô tả (VI)", roomDescEn: "Mô tả (EN)",
  statusVacant: "Trống", statusOccupied: "Đang thuê", statusMaintenance: "Đang sửa",
  editRoom: "Sửa phòng", deleteRoomSure: "Xóa phòng này?",
  electricStart: "Số điện đầu kỳ", waterStart: "Số nước đầu kỳ",
  filterProperty: "Lọc theo nhà trọ", noRooms: "Chưa có phòng nào.",

  tenantName: "Họ tên", tenantPhone: "Số điện thoại", tenantEmail: "Email",
  tenantIdNumber: "CMND/CCCD", tenantRoom: "Phòng", addTenant: "Thêm khách",
  editTenant: "Sửa khách", deleteTenantSure: "Xóa khách này?", noTenants: "Chưa có khách thuê.",

  contractTenant: "Khách thuê", contractRoom: "Phòng", contractStart: "Ngày bắt đầu",
  contractEnd: "Ngày kết thúc", contractRent: "Tiền thuê/tháng", contractDeposit: "Tiền cọc",
  contractActive: "Hiệu lực", contractExpired: "Hết hạn", contractCancelled: "Đã hủy",
  addContract: "Thêm hợp đồng", editContract: "Sửa hợp đồng",
  deleteContractSure: "Xóa hợp đồng này?", noContracts: "Chưa có hợp đồng.",

  invoiceRoom: "Phòng", invoiceTenant: "Khách thuê", invoiceMonth: "Kỳ hóa đơn",
  invoiceDue: "Hạn thanh toán", invoiceTotal: "Tổng tiền", invoiceUnpaid: "Chưa trả",
  invoicePaid: "Đã trả", invoiceOverdue: "Quá hạn", markPaid: "Đánh dấu đã trả",
  addInvoice: "Thêm hóa đơn", editInvoice: "Sửa hóa đơn",
  deleteInvoiceSure: "Xóa hóa đơn này?", noInvoices: "Chưa có hóa đơn.",

  noUsers: "Chưa có người dùng.", noAudit: "Chưa có bản ghi nào.",
  brandTitle: "Thương hiệu", brandName: "Tên hiển thị", brandTagline: "Khẩu hiệu", brandColor: "Màu chủ đạo",
};

const EN: Dict = {
  login: "Sign in", register: "Sign up", logout: "Sign out",
  email: "Email", password: "Password", displayName: "Display name",
  loginGoogle: "Continue with Google",
  signInTitle: "Sign in to the system", signUpTitle: "Create a new account",
  noAccount: "No account? Sign up", haveAccount: "Already have an account? Sign in",
  firstUserHint: "The first user becomes the administrator.",
  goToAdmin: "Open admin", comingSoonDesc: "Rental management system.",

  dashboard: "Dashboard", properties: "Properties", rooms: "Rooms", tenants: "Tenants",
  contracts: "Contracts", invoices: "Invoices", users: "Users", auditLog: "Audit log",
  settings: "Settings", loading: "Loading...", error: "Something went wrong", save: "Save",
  cancel: "Cancel", edit: "Edit", delete: "Delete", none: "—", all: "All", status: "Status",
  notes: "Notes", month: "month", floor: "Floor", saved: "Saved", reset: "Reset",
  profile: "Profile", language: "Language",

  totalProperties: "Properties", totalRooms: "Rooms", vacantRooms: "Vacant", occupiedRooms: "Occupied",
  quickActions: "Quick actions", addProperty: "Add property", addRoom: "Add room",

  propertyName: "Property name", propertyAddress: "Address", propertyNotes: "Notes",
  editProperty: "Edit property", deletePropertySure: "Delete this property?",
  propertyHasRooms: "Cannot delete: property still has rooms.", propertyRooms: "Rooms",
  noProperties: "No properties yet.",

  roomProperty: "Property", roomCode: "Room code", roomFloor: "Floor", roomArea: "Area (m²)",
  roomRent: "Rent", roomDeposit: "Deposit", roomStatus: "Room status",
  roomAmenities: "Amenities (one per line)", roomAmenitiesHint: "WiFi, AC, Water heater...",
  roomDesc: "Description (VI)", roomDescEn: "Description (EN)",
  statusVacant: "Vacant", statusOccupied: "Occupied", statusMaintenance: "Maintenance",
  editRoom: "Edit room", deleteRoomSure: "Delete this room?",
  electricStart: "Electric meter start", waterStart: "Water meter start",
  filterProperty: "Filter by property", noRooms: "No rooms yet.",

  tenantName: "Full name", tenantPhone: "Phone", tenantEmail: "Email",
  tenantIdNumber: "ID number", tenantRoom: "Room", addTenant: "Add tenant",
  editTenant: "Edit tenant", deleteTenantSure: "Delete this tenant?", noTenants: "No tenants yet.",

  contractTenant: "Tenant", contractRoom: "Room", contractStart: "Start date",
  contractEnd: "End date", contractRent: "Monthly rent", contractDeposit: "Deposit",
  contractActive: "Active", contractExpired: "Expired", contractCancelled: "Cancelled",
  addContract: "Add contract", editContract: "Edit contract",
  deleteContractSure: "Delete this contract?", noContracts: "No contracts yet.",

  invoiceRoom: "Room", invoiceTenant: "Tenant", invoiceMonth: "Billing month",
  invoiceDue: "Due date", invoiceTotal: "Total", invoiceUnpaid: "Unpaid",
  invoicePaid: "Paid", invoiceOverdue: "Overdue", markPaid: "Mark as paid",
  addInvoice: "Add invoice", editInvoice: "Edit invoice",
  deleteInvoiceSure: "Delete this invoice?", noInvoices: "No invoices yet.",

  noUsers: "No users yet.", noAudit: "No records yet.",
  brandTitle: "Branding", brandName: "Brand name", brandTagline: "Tagline", brandColor: "Brand color",
};

const DICTS: Record<Lang, Dict> = { vi: VI, en: EN };

interface I18nCtxValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtxValue | null>(null);
const STORE = "i18n-lang-v1";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORE);
    return saved === "en" ? "en" : "vi";
  });

  const setLang = (l: Lang) => {
    localStorage.setItem(STORE, l);
    setLangState(l);
  };

  const t = useMemo(() => (key: string) => DICTS[lang][key] ?? key, [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be inside I18nProvider");
  return v;
}
`);

// ============ src/styles.css ============
w("src/styles.css", String.raw`:root {
  --brand: #2563eb;
  --bg: #f6f7fb;
  --card: #ffffff;
  --text: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --danger: #dc2626;
  --radius: 12px;
  --shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 14px rgba(16, 24, 40, 0.06);
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; }
body {
  margin: 0;
  font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
}
a { color: inherit; }

.landing { min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; }
.landing-header { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; background: #fff; border-bottom: 1px solid var(--border); }
.landing-hero { padding: 48px 24px; text-align: center; }
.landing-hero h1 { font-size: 36px; margin: 0 0 12px; }
.tagline { color: var(--muted); margin: 0 0 12px; }
.info { color: var(--muted); }
.landing-footer { padding: 16px 24px; text-align: center; color: var(--muted); border-top: 1px solid var(--border); }

.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }

.authpage { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.authcard { width: 100%; max-width: 380px; }
.authcard h1 { font-size: 22px; }

.app-shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.sidebar { background: #fff; border-right: 1px solid var(--border); padding: 20px 16px; display: flex; flex-direction: column; gap: 24px; }
.sidebar nav { display: flex; flex-direction: column; gap: 4px; }
.sidebar nav a { padding: 10px 12px; border-radius: 8px; text-decoration: none; color: var(--text); }
.sidebar nav a:hover { background: #f3f4f6; }
.sidebar nav a.active { background: var(--brand); color: #fff; }

.main { display: flex; flex-direction: column; min-height: 100vh; }
.topbar { padding: 12px 24px; background: #fff; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
.content { padding: 24px; flex: 1; }

.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; box-shadow: var(--shadow); }
.card h3 { margin-top: 0; }
.card form label { display: block; margin-bottom: 10px; }
.list { display: flex; flex-direction: column; }

.row { display: flex; gap: 10px; align-items: center; }
.row.between { justify-content: space-between; }
.row.wrap { flex-wrap: wrap; gap: 8px; }
.row > label { flex: 1; }

label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; color: var(--muted); }
input, select, textarea {
  font: inherit; padding: 9px 11px; border-radius: 8px;
  border: 1px solid var(--border); background: #fff; color: var(--text);
}
input:focus, select:focus, textarea:focus { outline: 2px solid color-mix(in oklab, var(--brand) 35%, transparent); border-color: var(--brand); }

button, .linkbtn {
  font: inherit; padding: 9px 14px; border-radius: 8px; border: 1px solid transparent;
  background: var(--brand); color: #fff; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
}
button:disabled { opacity: 0.6; cursor: not-allowed; }
button.ghost { background: transparent; color: var(--text); border-color: var(--border); }
button.ghost.danger { color: var(--danger); }
button.block { width: 100%; margin-top: 8px; }
button.linkbtn { background: transparent; color: var(--brand); padding: 0; }
.linkbtn.primary { background: var(--brand); color: #fff; padding: 9px 14px; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #eef2ff; color: #3730a3; }
.tag.vacant { background: #ecfdf5; color: #047857; }
.tag.occupied { background: #eff6ff; color: #1d4ed8; }
.tag.maintenance { background: #fff7ed; color: #b45309; }
.tag.paid, .tag.active { background: #ecfdf5; color: #047857; }
.tag.unpaid { background: #fffbeb; color: #b45309; }
.tag.overdue, .tag.expired, .tag.cancelled { background: #fef2f2; color: #b91c1c; }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.stat { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; box-shadow: var(--shadow); }
.stat .num { font-size: 26px; font-weight: 700; }
.stat .label { color: var(--muted); font-size: 13px; }

.error { color: var(--danger); background: #fef2f2; border: 1px solid #fecaca; padding: 8px 10px; border-radius: 8px; }

@media (max-width: 720px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { flex-direction: row; overflow-x: auto; }
  .sidebar nav { flex-direction: row; }
}
`);

// ============ .env.example ============
w(".env.example", String.raw`VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
`);

// ============ firestore.rules ============
w("firestore.rules", String.raw`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isAdmin() {
      return signedIn() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /users/{uid} {
      allow read: if signedIn();
      allow create: if signedIn() && request.auth.uid == uid;
      allow update: if isAdmin() || (signedIn() && request.auth.uid == uid);
    }
    match /properties/{id} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
    match /rooms/{id} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
    match /tenants/{id} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
    match /contracts/{id} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
    match /invoices/{id} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
    match /auditLogs/{id} {
      allow read: if isAdmin();
      allow create: if signedIn();
    }
  }
}
`);

console.log("\nXong. Nhớ tạo file .env từ .env.example trước khi npm run dev.");
#!/usr/bin/env node
// setup-phase2.mjs — Giai đoạn 2: trang public + landing động
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const p = (rel) => path.join(ROOT, rel);
const ensureDir = (f) => fs.mkdirSync(path.dirname(p(f)), { recursive: true });

function backup(file) {
  const abs = p(file);
  if (!fs.existsSync(abs)) return;
  fs.copyFileSync(abs, `${abs}.bak.${TS}`);
  console.log('  ↳ backup', path.relative(ROOT, `${file}.bak.${TS}`));
}

function write(file, content) {
  ensureDir(file);
  backup(file);
  fs.writeFileSync(p(file), content, 'utf8');
  console.log('✓ wrote', file);
}

function patch(file, marker, before, after = '') {
  const abs = p(file);
  if (!fs.existsSync(abs)) { console.warn('⚠ missing', file); return false; }
  const src = fs.readFileSync(abs, 'utf8');
  if (!src.includes(marker)) { console.warn('⚠ marker không khớp trong', file); return false; }
  const idx = src.indexOf(marker);
  backup(file);
  fs.writeFileSync(abs, src.slice(0, idx) + before + marker + after + src.slice(idx + marker.length), 'utf8');
  console.log('✓ patched', file);
  return true;
}

// ============ 1. types.ts (rewrite, giữ nguyên tất cả type cũ + thêm 3 field) ============
const typesTs = `export type Role = "admin" | "staff" | "tenant";
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
  // Phase 2:
  photos?: string[];
  published?: boolean;
  featured?: boolean;
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
`;

// ============ 2. App.tsx (rewrite — fix bug /toi unreachable + thêm routes public) ============
const appTsx = `import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import StaffShell from "./StaffShell";
import TenantShell from "./TenantShell";
import RoomList from "./pages/public/RoomList";
import RoomDetail from "./pages/public/RoomDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dang-nhap" element={<Login />} />
      <Route path="/phong" element={<RoomList />} />
      <Route path="/phong/:id" element={<RoomDetail />} />
      <Route path="/app/*" element={<StaffShell />} />
      <Route path="/toi" element={<TenantShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
`;

// ============ 3. RoomList.tsx ============
const roomListTsx = `import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { RoomDoc } from "../../lib/types";

type Room = RoomDoc & { id: string };

export default function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "rooms"), where("published", "==", true));
    return onSnapshot(
      q,
      (snap) => {
        setRooms(snap.docs.map((d) => ({ ...(d.data() as RoomDoc), id: d.id })));
        setLoading(false);
      },
      (e) => { console.error(e); setErr(e.message); setLoading(false); }
    );
  }, []);

  return (
    <div className="public-shell">
      <header className="public-header">
        <Link to="/" className="public-brand">Nhà trọ</Link>
        <Link to="/dang-nhap" className="public-login">Đăng nhập</Link>
      </header>
      <main className="public-container">
        <h1 className="public-h1">Phòng cho thuê</h1>
        <p className="public-sub">Danh sách phòng đang sẵn sàng cho thuê</p>

        {loading && <div className="public-loading">Đang tải...</div>}
        {err && <div className="public-error">{err}</div>}
        {!loading && !err && rooms.length === 0 && (
          <div className="public-empty">Chưa có phòng nào được đăng công khai.</div>
        )}

        {rooms.length > 0 && (
          <div className="room-grid">
            {rooms.map((room) => (
              <Link key={room.id} to={\`/phong/\${room.id}\`} className="room-card">
                {room.photos && room.photos[0] ? (
                  <img src={room.photos[0]} alt={room.code} className="room-card-img" />
                ) : (
                  <div className="room-card-img room-card-img-empty">Chưa có ảnh</div>
                )}
                <div className="room-card-body">
                  <div className="room-card-title">Phòng {room.code}</div>
                  {room.desc && (
                    <div className="room-card-addr">
                      {room.desc.length > 60 ? room.desc.slice(0, 60) + "…" : room.desc}
                    </div>
                  )}
                  <div className="room-card-meta">
                    {room.area != null && <span>{room.area} m²</span>}
                    <span className="room-card-price">
                      {room.baseRent.toLocaleString("vi-VN")} đ/tháng
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
`;

// ============ 4. RoomDetail.tsx ============
const roomDetailTsx = `import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { RoomDoc, PropertyDoc } from "../../lib/types";

type Room = RoomDoc & { id: string };
type Property = PropertyDoc & { id: string };

export default function RoomDetail() {
  const { id } = useParams<{ id: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "rooms", id));
        if (!mounted) return;
        if (!snap.exists()) { setErr("Không tìm thấy phòng"); setLoading(false); return; }
        const data = snap.data() as RoomDoc;
        if (data.published !== true) { setErr("Phòng này chưa được đăng công khai"); setLoading(false); return; }
        setRoom({ ...data, id: snap.id });

        // Fetch property (cho address) — bỏ qua nếu rules chặn
        if (data.propertyId) {
          try {
            const ps = await getDoc(doc(db, "properties", data.propertyId));
            if (ps.exists() && mounted) {
              setProperty({ ...(ps.data() as PropertyDoc), id: ps.id });
            }
          } catch { /* rules deny → bỏ qua */ }
        }
      } catch (e: any) {
        if (mounted) setErr(e?.message || "Lỗi tải phòng");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="public-shell"><div className="public-loading">Đang tải...</div></div>;
  if (err || !room) return (
    <div className="public-shell">
      <header className="public-header">
        <Link to="/" className="public-brand">Nhà trọ</Link>
        <Link to="/phong" className="public-login">← Danh sách</Link>
      </header>
      <div className="public-container"><div className="public-error">{err || "Không tải được phòng"}</div></div>
    </div>
  );

  const photos = room.photos || [];
  const description = room.desc || room.descEn || "";

  return (
    <div className="public-shell">
      <header className="public-header">
        <Link to="/" className="public-brand">Nhà trọ</Link>
        <Link to="/phong" className="public-login">← Danh sách</Link>
      </header>
      <main className="public-container">
        {photos.length > 0 && (
          <div className="room-gallery">
            <img src={photos[activePhoto]} alt="" className="room-gallery-main" />
            {photos.length > 1 && (
              <div className="room-gallery-thumbs">
                {photos.map((url, i) => (
                  <img key={i} src={url} alt="" onClick={() => setActivePhoto(i)}
                    className={"room-gallery-thumb " + (i === activePhoto ? "active" : "")} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="room-detail-body">
          <h1 className="public-h1">Phòng {room.code}</h1>
          {(property?.name || property?.address) && (
            <div className="room-detail-addr">
              📍 {property?.name}{property?.address ? " — " + property.address : ""}
            </div>
          )}

          <div className="room-detail-meta">
            {room.area != null && <div><span className="label">Diện tích</span><strong>{room.area} m²</strong></div>}
            <div>
              <span className="label">Giá thuê</span>
              <strong className="room-card-price">{room.baseRent.toLocaleString("vi-VN")} đ/tháng</strong>
            </div>
            {room.deposit != null && <div><span className="label">Đặt cọc</span><strong>{room.deposit.toLocaleString("vi-VN")} đ</strong></div>}
            {room.floor != null && <div><span className="label">Tầng</span><strong>{room.floor}</strong></div>}
          </div>

          {description && (
            <div className="room-detail-desc">
              <h2>Mô tả</h2>
              <p style={{ whiteSpace: "pre-line" }}>{description}</p>
            </div>
          )}

          {room.amenities && room.amenities.length > 0 && (
            <div className="room-detail-desc">
              <h2>Tiện ích</h2>
              <ul style={{ paddingLeft: 20 }}>
                {room.amenities.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <div className="room-detail-cta">
            <div>
              <div className="public-sub" style={{ marginBottom: 0 }}>Quan tâm phòng này?</div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                Form liên hệ / hẹn xem phòng sẽ có ở Giai đoạn 3.
              </div>
            </div>
            <button className="btn btn-primary" disabled style={{ opacity: 0.6, cursor: "not-allowed" }}>
              Liên hệ (sắp có)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
`;

// ============ 5. RoomExtras.tsx (admin page quản lý 3 field, không đụng Rooms.tsx) ============
const roomExtrasTsx = `import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { isAdminRole } from "../lib/types";

type Room = {
  id: string;
  code?: string;
  published?: boolean;
  featured?: boolean;
  photos?: string[];
};

export default function RoomExtras() {
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, "rooms"), (snap) => {
      setRooms(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Room)));
      setLoading(false);
    });
  }, []);

  if (!isAdminRole(profile?.role)) {
    return <div style={{ padding: 24 }}>Chỉ admin mới có quyền truy cập.</div>;
  }

  async function update(id: string, patch: Partial<Room>) {
    setBusy(id);
    try { await updateDoc(doc(db, "rooms", id), patch); }
    finally { setBusy(null); }
  }

  async function publishAll() {
    const pending = rooms.filter((r) => r.published !== true);
    if (pending.length === 0) { alert("Tất cả phòng đã được publish."); return; }
    if (!confirm(\`Đặt published=true cho \${pending.length} phòng chưa đăng?\`)) return;
    for (const r of pending) {
      await updateDoc(doc(db, "rooms", r.id), { published: true });
    }
    alert(\`Đã publish \${pending.length} phòng\`);
  }

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Ảnh & Hiển thị phòng</h1>
          <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
            Quản lý ảnh, trạng thái công khai và phòng nổi bật
          </p>
        </div>
        <button className="btn btn-primary" onClick={publishAll}>
          Publish tất cả phòng chưa đăng
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              <th style={{ padding: 12 }}>Mã phòng</th>
              <th style={{ padding: 12, width: 100 }}>Công khai</th>
              <th style={{ padding: 12, width: 100 }}>Nổi bật</th>
              <th style={{ padding: 12 }}>Ảnh (mỗi URL một dòng)</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>{r.code || r.id.slice(0, 6)}</td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  <input type="checkbox" checked={r.published === true}
                    disabled={busy === r.id}
                    onChange={(e) => update(r.id, { published: e.target.checked })} />
                </td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  <input type="checkbox" checked={r.featured === true}
                    disabled={busy === r.id}
                    onChange={(e) => update(r.id, { featured: e.target.checked })} />
                </td>
                <td style={{ padding: 12 }}>
                  <textarea
                    rows={2}
                    defaultValue={(r.photos || []).join("\\n")}
                    onBlur={(e) => {
                      const photos = e.target.value.split("\\n").map((s) => s.trim()).filter(Boolean);
                      const old = (r.photos || []).join("\\n");
                      if (photos.join("\\n") !== old) update(r.id, { photos });
                    }}
                    placeholder="https://..."
                    style={{ width: "100%", fontSize: 12, fontFamily: "monospace", padding: 6, borderRadius: 4, border: "1px solid #ddd" }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;

// ============ 6. FeaturedRooms.tsx ============
const featuredRoomsTsx = `import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { RoomDoc } from "../lib/types";

type Room = RoomDoc & { id: string };

export default function FeaturedRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    // Query featured, filter published ở client để tránh cần composite index
    const q = query(collection(db, "rooms"), where("featured", "==", true), limit(20));
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as RoomDoc), id: d.id }))
        .filter((r) => r.published === true)
        .slice(0, 6);
      setRooms(list);
    });
  }, []);

  if (rooms.length === 0) return null;

  return (
    <section style={{ padding: "48px 16px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Phòng nổi bật</h2>
        <Link to="/phong" style={{ color: "#2563eb", fontSize: 14, textDecoration: "none" }}>
          Xem tất cả →
        </Link>
      </div>
      <div className="room-grid">
        {rooms.map((room) => (
          <Link key={room.id} to={\`/phong/\${room.id}\`} className="room-card">
            {room.photos?.[0] ? (
              <img src={room.photos[0]} alt={room.code} className="room-card-img" />
            ) : (
              <div className="room-card-img room-card-img-empty">Chưa có ảnh</div>
            )}
            <div className="room-card-body">
              <div className="room-card-title">Phòng {room.code}</div>
              {room.desc && (
                <div className="room-card-addr">
                  {room.desc.length > 50 ? room.desc.slice(0, 50) + "…" : room.desc}
                </div>
              )}
              <div className="room-card-meta">
                {room.area != null && <span>{room.area} m²</span>}
                <span className="room-card-price">
                  {room.baseRent.toLocaleString("vi-VN")} đ/tháng
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
`;

// ============ CSS ============
const cssAppend = `

/* ========== Public pages ========== */
.public-shell { min-height: 100vh; background: #f8f9fa; }
.public-header { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
.public-brand { font-size: 18px; font-weight: 700; color: #111; text-decoration: none; }
.public-login { color: #2563eb; text-decoration: none; font-size: 14px; }
.public-container { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
.public-h1 { font-size: 28px; font-weight: 700; margin: 0 0 8px; color: #111; }
.public-sub { font-size: 15px; color: #6b7280; margin: 0 0 24px; }
.public-loading, .public-empty, .public-error { text-align: center; padding: 40px 16px; color: #6b7280; }
.public-error { color: #dc2626; }

.room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.room-card { display: block; background: #fff; border-radius: 8px; overflow: hidden; text-decoration: none; color: inherit; box-shadow: 0 1px 3px rgba(0,0,0,.06); transition: transform .15s, box-shadow .15s; }
.room-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.1); }
.room-card-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: #f3f4f6; }
.room-card-img-empty { display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 13px; }
.room-card-body { padding: 12px; }
.room-card-title { font-weight: 600; font-size: 15px; color: #111; margin-bottom: 4px; }
.room-card-addr { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
.room-card-meta { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #374151; }
.room-card-price { font-weight: 600; color: #dc2626; }

.room-gallery { margin-bottom: 24px; }
.room-gallery-main { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; background: #f3f4f6; }
.room-gallery-thumbs { display: flex; gap: 8px; margin-top: 8px; overflow-x: auto; }
.room-gallery-thumb { width: 80px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer; opacity: .6; transition: opacity .15s; flex-shrink: 0; }
.room-gallery-thumb.active, .room-gallery-thumb:hover { opacity: 1; outline: 2px solid #2563eb; }

.room-detail-body { background: #fff; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.room-detail-addr { color: #6b7280; margin-bottom: 16px; }
.room-detail-meta { display: flex; gap: 32px; flex-wrap: wrap; margin: 16px 0 24px; padding: 16px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
.room-detail-meta .label { font-size: 12px; color: #9ca3af; display: block; margin-bottom: 4px; }
.room-detail-desc { margin: 24px 0; }
.room-detail-desc h2 { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
.room-detail-cta { margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
`;

// ============ EXECUTE ============
console.log("\n=== Rewrite 2 file cũ ===");
write("src/lib/types.ts", typesTs);
write("src/App.tsx", appTsx);

console.log("\n=== Tạo file mới ===");
write("src/pages/public/RoomList.tsx", roomListTsx);
write("src/pages/public/RoomDetail.tsx", roomDetailTsx);
write("src/pages/RoomExtras.tsx", roomExtrasTsx);
write("src/components/FeaturedRooms.tsx", featuredRoomsTsx);

console.log("\n=== Patch StaffShell.tsx (menu + route) ===");
patch(
  "src/StaffShell.tsx",
  'import SettingsBrand from "./pages/SettingsBrand";',
  "",
  '\nimport RoomExtras from "./pages/RoomExtras";'
);
patch(
  "src/StaffShell.tsx",
  '<NavLink to="/app/rooms">{t("rooms")}</NavLink>',
  "",
  '\n          <NavLink to="/app/room-extras">Ảnh & Hiển thị</NavLink>'
);
patch(
  "src/StaffShell.tsx",
  '<Route path="rooms" element={<Rooms />} />',
  "",
  '\n            <Route path="room-extras" element={<RoomExtras />} />'
);

console.log("\n=== Append CSS ===");
const cssFile = p("src/styles.css");
if (fs.existsSync(cssFile)) {
  backup("src/styles.css");
  fs.appendFileSync(cssFile, cssAppend, "utf8");
  console.log("✓ appended to src/styles.css");
} else {
  console.warn("⚠ src/styles.css không tồn tại");
}

console.log("\n=== Patch Landing.tsx (thêm FeaturedRooms) ===");
const landingAbs = p("src/pages/Landing.tsx");
if (fs.existsSync(landingAbs)) {
  let src = fs.readFileSync(landingAbs, "utf8");

  // 1. Thêm import nếu chưa có
  if (!src.includes("FeaturedRooms")) {
    const importMatch = src.match(/^import .*$/m);
    if (importMatch) {
      src = src.slice(0, importMatch.index) +
        'import FeaturedRooms from "../components/FeaturedRooms";\n' +
        src.slice(importMatch.index);
    } else {
      src = 'import FeaturedRooms from "../components/FeaturedRooms";\n' + src;
    }
  }

  // 2. Chèn <FeaturedRooms /> — thử các marker
  const markers = ["</main>", "<footer", "</body>"];
  let inserted = false;
  for (const m of markers) {
    if (src.includes(m)) {
      src = src.replace(m, "  <FeaturedRooms />\n      " + m);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    console.warn("⚠ Không tìm được marker trong Landing.tsx");
    console.warn("  → Sửa tay: thêm <FeaturedRooms /> vào giữa return JSX");
  }

  backup("src/pages/Landing.tsx");
  fs.writeFileSync(landingAbs, src, "utf8");
  console.log("✓ patched src/pages/Landing.tsx");
} else {
  console.warn("⚠ src/pages/Landing.tsx không tồn tại");
}

console.log("\n✅ Xong phase 2. Còn lại:");
console.log("");
console.log("  1. Publish Firestore rules (xem hướng dẫn trong chat)");
console.log("  2. npm run build");
console.log("  3. git add -A && git commit -m 'phase2: public rooms + featured'");
console.log("  4. git push");
console.log("  5. Đợi CI/CD xanh → test");
console.log("");
console.log("  💡 Rooms.tsx giữ nguyên — quản lý ảnh/published/featured qua /app/room-extras");
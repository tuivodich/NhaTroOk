#!/usr/bin/env node
// ============================================================
// Phase 3 setup — Quản lý nhà trọ
// Chạy: node setup-phase3.mjs
// ============================================================
import fs from "node:fs";
import path from "node:path";

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const bak = (f) => { try { if (fs.existsSync(f)) fs.copyFileSync(f, `${f}.bak.${TS}`); } catch {} };

const write = (f, c) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  bak(f);
  fs.writeFileSync(f, c, "utf8");
  console.log("✓ wrote  ", f);
};

const patch = (f, fn) => {
  if (!fs.existsSync(f)) { console.error("✗ missing", f); process.exitCode = 1; return false; }
  bak(f);
  const src = fs.readFileSync(f, "utf8");
  const out = fn(src);
  if (out == null) { console.log("· skipped", f, "(already patched / no anchor)"); return true; }
  if (out === src)  { console.error("✗ no-change", f); process.exitCode = 1; return false; }
  fs.writeFileSync(f, out, "utf8");
  console.log("✓ patched", f);
  return true;
};

/* ============================================================
 * 1) src/lib/types.ts — thêm InquiryStatus + InquiryDoc
 * ========================================================== */
patch("src/lib/types.ts", (src) => {
  if (src.includes("InquiryStatus")) { console.log("  · types.ts already patched"); return null; }
  const block = `
// ===== Phase 3: Inquiries =====
export type InquiryStatus = "new" | "contacted" | "scheduled" | "converted" | "rejected";

export type InquiryDoc = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  roomId?: string | null;
  roomCode?: string | null;
  message?: string | null;
  preferredDate?: string | null;
  status: InquiryStatus;
  notes?: string | null;
  handledBy?: string | null;
  createdAt?: any;
  updatedAt?: any;
};
`;
  return src + block;
});

/* ============================================================
 * 2) src/components/InquiryForm.tsx — form gửi yêu cầu thuê
 * ========================================================== */
write("src/components/InquiryForm.tsx", `import { useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { RoomDoc } from "../lib/types";

export default function InquiryForm({ room }: { room: RoomDoc }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const n = name.trim();
    const p = phone.trim();
    if (!n || !p) { setErr("Vui lòng nhập họ tên và số điện thoại."); return; }
    if (p.replace(/\\D/g, "").length < 8) { setErr("Số điện thoại không hợp lệ."); return; }
    setSending(true);
    try {
      await addDoc(collection(db, "inquiries"), {
        name: n,
        phone: p,
        email: email.trim() || null,
        message: message.trim() || null,
        preferredDate: preferredDate || null,
        roomId: room.id,
        roomCode: room.code,
        status: "new",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Gửi thất bại, vui lòng thử lại sau.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div style={{ padding: 20, background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Cảm ơn bạn!</h3>
        <p style={{ marginBottom: 0 }}>Yêu cầu đã được gửi. Chúng tôi sẽ liên hệ với bạn sớm nhất có thể.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <h2 style={{ margin: 0 }}>Đăng ký thuê / hẹn xem phòng</h2>
      <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>
        Điền thông tin để chúng tôi liên hệ xác nhận. Bạn cũng có thể gọi trực tiếp nếu cần gấp.
      </p>

      <label>
        Họ tên <span style={{ color: "#c62828" }}>*</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100}
          style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box" }} />
      </label>

      <label>
        Số điện thoại <span style={{ color: "#c62828" }}>*</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={30}
          inputMode="tel" style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box" }} />
      </label>

      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120}
          style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box" }} />
      </label>

      <label>
        Ngày muốn xem phòng
        <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box" }} />
      </label>

      <label>
        Lời nhắn
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000}
          style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box", resize: "vertical" }} />
      </label>

      {err && <div style={{ color: "#c62828" }}>{err}</div>}

      <button type="submit" disabled={sending}
        style={{ padding: "10px 22px", cursor: sending ? "wait" : "pointer", fontSize: 15 }}>
        {sending ? "Đang gửi…" : "Gửi yêu cầu"}
      </button>
    </form>
  );
}
`);

/* ============================================================
 * 3) src/pages/public/RoomDetail.tsx — rewrite (thêm InquiryForm)
 * ========================================================== */
write("src/pages/public/RoomDetail.tsx", `import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { PropertyDoc, RoomDoc } from "../../lib/types";
import InquiryForm from "../../components/InquiryForm";

const vnd = (n: number | null | undefined) =>
  (n || 0).toLocaleString("vi-VN") + " đ";

export default function RoomDetail() {
  const { id } = useParams();
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [property, setProperty] = useState<PropertyDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "rooms", id));
        if (!alive) return;
        if (!snap.exists()) { setErr("Không tìm thấy phòng."); setLoading(false); return; }
        const r = { id: snap.id, ...snap.data() } as RoomDoc;
        setRoom(r);
        if (r.propertyId) {
          const ps = await getDoc(doc(db, "properties", r.propertyId));
          if (alive && ps.exists()) setProperty({ id: ps.id, ...ps.data() } as PropertyDoc);
        }
      } catch (e: any) {
        if (alive) setErr(e?.message || "Lỗi tải dữ liệu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) return <div className="container" style={{ padding: 24 }}>Đang tải…</div>;
  if (err) return (
    <div className="container" style={{ padding: 24 }}>
      <p>{err}</p>
      <Link to="/phong">← Về danh sách phòng</Link>
    </div>
  );
  if (!room) return null;

  const photos = Array.isArray(room.photos) ? room.photos.filter(Boolean) : [];
  const amenitiesArr = Array.isArray(room.amenities) ? room.amenities : null;
  const amenitiesStr = typeof room.amenities === "string" ? room.amenities : null;

  return (
    <div className="container" style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <Link to="/phong">← Danh sách phòng</Link>

      <h1 style={{ marginTop: 12 }}>
        {room.code}{property ? \` — \${property.name}\` : ""}
      </h1>
      {property?.address && <p style={{ marginTop: -8, opacity: 0.75 }}>{property.address}</p>}

      {photos.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 8, margin: "16px 0",
        }}>
          {photos.map((p, i) => (
            <img key={i} src={p} alt={\`\${room.code} \${i + 1}\`}
              style={{ width: "100%", height: 170, objectFit: "cover", borderRadius: 8 }} />
          ))}
        </div>
      )}

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))",
        gap: 12, margin: "16px 0", padding: 16, background: "#f7f7f7", borderRadius: 8,
      }}>
        <div><strong>Giá thuê:</strong> {vnd(room.baseRent)}/tháng</div>
        {room.deposit != null && <div><strong>Đặt cọc:</strong> {vnd(room.deposit)}</div>}
        <div><strong>Diện tích:</strong> {room.area ?? "—"} m²</div>
        <div><strong>Tầng:</strong> {room.floor ?? "—"}</div>
        <div><strong>Trạng thái:</strong> {room.status === "vacant" ? "Còn trống" : room.status === "occupied" ? "Đã thuê" : "Bảo trì"}</div>
      </div>

      {room.desc && (<><h3>Mô tả</h3><p style={{ whiteSpace: "pre-wrap" }}>{room.desc}</p></>)}
      {!room.desc && room.descEn && (<><h3>Description</h3><p style={{ whiteSpace: "pre-wrap" }}>{room.descEn}</p></>)}

      {amenitiesArr && amenitiesArr.length > 0 && (
        <>
          <h3>Tiện ích</h3>
          <ul>{amenitiesArr.map((a: any, i: number) => <li key={i}>{String(a)}</li>)}</ul>
        </>
      )}
      {amenitiesStr && (<><h3>Tiện ích</h3><p>{amenitiesStr}</p></>)}

      <hr style={{ margin: "28px 0" }} />

      {room.status === "vacant" ? (
        <InquiryForm room={room} />
      ) : (
        <div style={{ padding: 16, background: "#fff3e0", borderRadius: 8 }}>
          Phòng hiện không còn trống. Vui lòng xem phòng khác hoặc liên hệ để được tư vấn.
        </div>
      )}
    </div>
  );
}
`);

/* ============================================================
 * 4) src/pages/Inquiries.tsx — quản lý yêu cầu thuê
 * ========================================================== */
write("src/pages/Inquiries.tsx", `import { useEffect, useMemo, useState } from "react";
import {
  collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { InquiryDoc, InquiryStatus } from "../lib/types";
import { useAuth } from "../lib/auth";

const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  scheduled: "Đã hẹn",
  converted: "Đã chốt",
  rejected: "Từ chối",
};

const STATUS_COLOR: Record<InquiryStatus, string> = {
  new: "#1976d2",
  contacted: "#f57c00",
  scheduled: "#7b1fa2",
  converted: "#388e3c",
  rejected: "#c62828",
};

export default function Inquiries() {
  const auth = useAuth() as any;
  const uid: string | null = auth?.profile?.uid ?? auth?.user?.uid ?? null;

  const [list, setList] = useState<InquiryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InquiryStatus | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "inquiries"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q,
      (snap) => {
        setList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InquiryDoc)));
        setLoading(false);
      },
      (e) => { console.error(e); setErr(e.message); setLoading(false); }
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    return filter === "all" ? list : list.filter((x) => x.status === filter);
  }, [list, filter]);

  const update = async (id: string, p: Partial<InquiryDoc>) => {
    setBusy(id);
    try {
      await updateDoc(doc(db, "inquiries", id), {
        ...p,
        updatedAt: serverTimestamp(),
        ...(uid ? { handledBy: uid } : {}),
      });
    } catch (e: any) {
      alert(e?.message || "Cập nhật thất bại");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Yêu cầu thuê</h1>

      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>Lọc trạng thái:&nbsp;
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">Tất cả ({list.length})</option>
            {(Object.keys(STATUS_LABEL) as InquiryStatus[]).map((k) => (
              <option key={k} value={k}>
                {STATUS_LABEL[k]} ({list.filter((x) => x.status === k).length})
              </option>
            ))}
          </select>
        </label>
      </div>

      {err && <div style={{ color: "#c62828", marginBottom: 12 }}>{err}</div>}
      {loading && <div>Đang tải…</div>}
      {!loading && filtered.length === 0 && <div style={{ opacity: 0.6 }}>Chưa có yêu cầu nào.</div>}

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((it) => (
          <div key={it.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <strong>{it.name}</strong> — <a href={\`tel:\${it.phone}\`}>{it.phone}</a>
                {it.email ? <> · <a href={\`mailto:\${it.email}\`}>{it.email}</a></> : null}
              </div>
              <span style={{
                background: STATUS_COLOR[it.status], color: "#fff",
                padding: "2px 10px", borderRadius: 12, fontSize: 12,
              }}>
                {STATUS_LABEL[it.status]}
              </span>
            </div>

            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
              Phòng: {it.roomCode ?? it.roomId ?? "—"}
              {it.preferredDate ? \` · Hẹn xem: \${it.preferredDate}\` : ""}
              {it.createdAt?.seconds
                ? \` · Gửi: \${new Date(it.createdAt.seconds * 1000).toLocaleString("vi-VN")}\`
                : ""}
            </div>

            {it.message && (
              <div style={{ marginTop: 8, padding: 8, background: "#fafafa", borderRadius: 6, whiteSpace: "pre-wrap" }}>
                {it.message}
              </div>
            )}

            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select value={it.status} disabled={busy === it.id}
                onChange={(e) => update(it.id, { status: e.target.value as InquiryStatus })}>
                {(Object.keys(STATUS_LABEL) as InquiryStatus[]).map((k) => (
                  <option key={k} value={k}>{STATUS_LABEL[k]}</option>
                ))}
              </select>
              <input
                placeholder="Ghi chú nội bộ…"
                defaultValue={it.notes ?? ""}
                onBlur={(e) => {
                  if ((e.target.value || "") !== (it.notes ?? "")) update(it.id, { notes: e.target.value });
                }}
                style={{ flex: 1, minWidth: 220, padding: "6px 8px" }}
              />
            </div>

            {it.handledBy && (
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>Xử lý bởi: {it.handledBy}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
`);

/* ============================================================
 * 5) src/StaffShell.tsx — thêm menu "Yêu cầu thuê"
 * ========================================================== */
patch("src/StaffShell.tsx", (src) => {
  if (src.includes('to="/app/inquiries"') || src.includes("to='/app/inquiries'")) {
    console.log("  · StaffShell menu already patched"); return null;
  }
  const candidates = ["contracts", "tenants", "rooms", "invoices", "properties", "settings"];
  for (const route of candidates) {
    const re = new RegExp(
      `(<(NavLink|Link)\\s+[^>]*to=["']\\/app\\/${route}["'][^>]*>[\\s\\S]*?<\\/\\2>)`
    );
    const m = src.match(re);
    if (m) {
      const tag = m[2];
      const inject = `\n        <${tag} to="/app/inquiries">Yêu cầu thuê</${tag}>`;
      console.log(`  · injecting after /app/${route}`);
      return src.replace(m[1], m[1] + inject);
    }
  }
  console.error("  ✗ couldn't find a menu anchor in StaffShell — patch manually");
  process.exitCode = 1;
  return null;
});

/* ============================================================
 * 6) src/App.tsx — thêm import + route /app/inquiries
 * ========================================================== */
patch("src/App.tsx", (src) => {
  if (src.includes('path="/app/inquiries"')) {
    console.log("  · App.tsx route already patched"); return null;
  }

  let out = src;

  // 6a) import
  const importAnchor = /(import\s+\w+\s+from\s+["']\.\/pages\/(RoomExtras|StaffInvites|Rooms|Contracts)["'];?)/;
  const mImp = out.match(importAnchor);
  if (mImp) {
    out = out.replace(mImp[0], mImp[0] + `\nimport Inquiries from "./pages/Inquiries";`);
    console.log("  · import injected after", mImp[2]);
  } else {
    out = out.replace(/^(import[^\n]+\n)/m, `$1import Inquiries from "./pages/Inquiries";\n`);
    console.log("  · import injected after first import (fallback)");
  }

  // 6b) route
  const routeAnchors = [
    /<Route\s+path="\/app\/room-extras"[^>]*\/>/,
    /<Route\s+path="\/app\/staff-invites"[^>]*\/>/,
    /<Route\s+path="\/app\/contracts"[^>]*\/>/,
    /<Route\s+path="\/app\/rooms"[^>]*\/>/,
  ];
  for (const re of routeAnchors) {
    const m = out.match(re);
    if (m) {
      const inject = `\n              <Route path="/app/inquiries" element={<Inquiries />} />`;
      return out.replace(m[0], m[0] + inject);
    }
  }
  if (out.includes("</Routes>")) {
    return out.replace("</Routes>", `  <Route path="/app/inquiries" element={<Inquiries />} />\n          </Routes>`);
  }
  console.error("  ✗ couldn't inject /app/inquiries route — patch manually");
  process.exitCode = 1;
  return null;
});

/* ============================================================
 * 7) Firestore rules snippet (paste tay trên Console)
 * ========================================================== */
write("firestore-rules-phase3.txt", `# === Phase 3 — thêm block này vào Firestore Rules ===
# Chèn bên trong match /databases/{database}/documents { ... }

    // --- Phase 3: Inquiries ---
    match /inquiries/{id} {
      // Ai cũng có thể gửi yêu cầu (public form)
      allow create: if
        request.resource.data.keys().hasAll(['name','phone','status','createdAt'])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 100
        && request.resource.data.phone is string
        && request.resource.data.phone.size() >= 8
        && request.resource.data.phone.size() <= 30
        && request.resource.data.status == 'new';

      // Chỉ staff/admin được đọc & cập nhật
      allow read, update, delete: if
        isSignedIn()
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','staff'];
    }
`);

/* ============================================================
 * 8) Summary
 * ========================================================== */
console.log("\n============================================================");
console.log("✅ Phase 3 files written.");
console.log("============================================================");
console.log("Tiếp theo:");
console.log("  1) Xem type mới:  src/lib/types.ts (InquiryStatus, InquiryDoc)");
console.log("  2) Cập nhật Firestore Rules bằng cách paste nội dung");
console.log("     firestore-rules-phase3.txt vào Firebase Console → Firestore → Rules");
console.log("     (rules cho phép public create /inquiries và staff read+update)");
console.log("  3) git add -A && git commit -m \"Phase 3: inquiries\" && git push");
console.log("     → CI/CD tự deploy lên https://nhatrook.web.app");
console.log("  4) Test: mở /phong/<id> của 1 phòng published → gửi form → /app/inquiries");
console.log("============================================================\n");

if (process.exitCode) console.error("⚠ Có lỗi ở trên, xem kỹ các dòng ✗");
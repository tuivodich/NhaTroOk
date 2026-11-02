#!/usr/bin/env node
// setup-phase1.mjs — Giai đoạn 1: role gating + tenant shell
// Chạy: node setup-phase1.mjs
// Backup: <file>.bak.<timestamp>

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const p = (rel) => path.join(ROOT, rel);
const ensureDir = (f) => fs.mkdirSync(path.dirname(p(f)), { recursive: true });

function backup(file) {
  const abs = p(file);
  if (!fs.existsSync(abs)) return;
  const b = `${abs}.bak.${TS}`;
  fs.copyFileSync(abs, b);
  console.log('  ↳ backup', path.relative(ROOT, b));
}

function write(file, content) {
  ensureDir(file);
  backup(file);
  fs.writeFileSync(p(file), content, 'utf8');
  console.log('✓ wrote', file);
}

function patch(file, marker, insertBefore, insertAfter = '') {
  const abs = p(file);
  if (!fs.existsSync(abs)) { console.warn('⚠ missing', file); return false; }
  const src = fs.readFileSync(abs, 'utf8');
  if (!src.includes(marker)) {
    console.warn('⚠ marker không khớp trong', file);
    return false;
  }
  const idx = src.indexOf(marker);
  const patched = src.slice(0, idx) + insertBefore + marker + insertAfter + src.slice(idx + marker.length);
  backup(file);
  fs.writeFileSync(abs, patched, 'utf8');
  console.log('✓ patched', file);
  return true;
}

// ---------- 1. src/lib/auth.tsx ----------
const authTsx = `import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, db } from "./firebase";
import type { Role, UserProfile } from "./types";

type AuthState = {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

async function ensureProfile(user: FirebaseUser): Promise<UserProfile> {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return snap.data() as UserProfile;

  let role: Role = "tenant";

  // User đầu tiên → admin
  const firstSnap = await getDocs(query(collection(db, "users"), limit(1)));
  const isFirstUser = firstSnap.empty;

  if (isFirstUser) {
    role = "admin";
  } else if (user.email) {
    // Email có trong staffInvites (doc ID = email lowercase) → staff
    const emailLower = user.email.toLowerCase();
    const inviteRef = doc(db, "staffInvites", emailLower);
    const inviteSnap = await getDoc(inviteRef);
    if (inviteSnap.exists() && inviteSnap.data().active !== false) {
      role = "staff";
      try {
        await updateDoc(inviteRef, {
          acceptedAt: serverTimestamp(),
          acceptedBy: user.uid,
        });
      } catch { /* non-blocking */ }
    }
  }

  const profile = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    role,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    active: true,
  } as unknown as UserProfile;

  await setDoc(userRef, profile);
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          setProfile(await ensureProfile(u));
        } catch (e) {
          console.error("[auth] ensureProfile failed", e);
          setProfile(null);
        }
      } else setProfile(null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };
  const signOut = async () => { await fbSignOut(auth); };

  return <Ctx.Provider value={{ user, profile, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
`;

// ---------- 2. src/pages/StaffInvites.tsx ----------
const staffInvitesTsx = `import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

type StaffInvite = {
  id: string;
  email: string;
  name?: string;
  active?: boolean;
  acceptedAt?: any;
};

export default function StaffInvites() {
  const { profile } = useAuth();
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "staffInvites"), (snap) => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffInvite)));
      setLoading(false);
    });
    return unsub;
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const emailLower = email.trim().toLowerCase();
    if (!emailLower.includes("@")) { setErr("Email không hợp lệ"); return; }
    setBusy(true);
    try {
      await setDoc(doc(db, "staffInvites", emailLower), {
        email: emailLower,
        name: name.trim() || "",
        active: true,
        createdAt: serverTimestamp(),
        createdBy: profile?.uid || "",
      });
      setEmail(""); setName("");
    } catch (e: any) {
      setErr(e?.message || "Lỗi tạo lời mời");
    } finally { setBusy(false); }
  }

  async function toggleActive(inv: StaffInvite) {
    await updateDoc(doc(db, "staffInvites", inv.id), {
      active: inv.active === false ? true : false,
    });
  }

  if (profile?.role !== "admin") {
    return <div className="p-4">Chỉ admin mới có quyền truy cập.</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mời nhân viên</h1>
      <form onSubmit={handleAdd} className="flex gap-2 mb-6 flex-wrap">
        <input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="border p-2 rounded flex-1 min-w-[220px]" required />
        <input type="text" placeholder="Tên gợi ý (tuỳ chọn)" value={name} onChange={(e) => setName(e.target.value)} className="border p-2 rounded flex-1 min-w-[180px]" />
        <button type="submit" disabled={busy} className="btn btn-primary px-4">{busy ? "Đang lưu..." : "Thêm lời mời"}</button>
      </form>
      {err && <div className="text-red-600 mb-3">{err}</div>}
      {loading ? <div>Đang tải...</div> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Email</th><th>Tên</th><th>Trạng thái</th><th>Đã dùng</th><th></th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id} className="border-b">
                <td className="py-2">{inv.email}</td>
                <td>{inv.name || "—"}</td>
                <td>{inv.active === false ? <span className="text-red-600">Đã thu hồi</span> : <span className="text-green-600">Đang hiệu lực</span>}</td>
                <td>{inv.acceptedAt ? "✓" : "—"}</td>
                <td><button onClick={() => toggleActive(inv)} className="text-blue-600 underline">{inv.active === false ? "Kích hoạt lại" : "Thu hồi"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
`;

// ---------- 3. src/TenantShell.tsx ----------
const tenantShellTsx = `import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";

const TABS = [
  { key: "phong",   label: "Phòng của tôi",    icon: "🏠" },
  { key: "hoadon",  label: "Hóa đơn",          icon: "🧾" },
  { key: "hopdong", label: "Hợp đồng",         icon: "📄" },
  { key: "yeucau",  label: "Yêu cầu sửa chữa", icon: "🔧" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function TenantShell() {
  const { user, profile, loading, signOut } = useAuth();
  const [tab, setTab] = useState<TabKey>("phong");

  if (loading) return <div className="p-8">Đang tải...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <div className="p-8">Không tải được hồ sơ.</div>;
  if (profile.role !== "tenant") return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Cổng cư dân</div>
          <div className="text-xs text-gray-500">{profile.displayName || profile.email}</div>
        </div>
        <button onClick={signOut} className="btn btn-secondary text-sm">Đăng xuất</button>
      </header>
      <nav className="bg-white border-b flex overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={"px-4 py-3 text-sm whitespace-nowrap border-b-2 transition " +
              (tab === t.key ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-gray-600 hover:text-gray-900")}>
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
      <main className="p-4 max-w-3xl mx-auto">
        {tab === "phong"   && <Placeholder title="Phòng của tôi" hint="Thông tin phòng & hợp đồng đang thuê." />}
        {tab === "hoadon"  && <Placeholder title="Hóa đơn" hint="Danh sách hóa đơn & nút 'Tôi đã chuyển khoản'." />}
        {tab === "hopdong" && <Placeholder title="Hợp đồng" hint="Hợp đồng & thời hạn thuê." />}
        {tab === "yeucau"  && <Placeholder title="Yêu cầu sửa chữa" hint="Form gửi & lịch sử xử lý." />}
      </main>
    </div>
  );
}

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 text-center">
      <div className="text-lg font-semibold mb-2">{title}</div>
      <div className="text-sm text-gray-500">{hint}</div>
    </div>
  );
}
`;

// ---------- WRITE ----------
console.log("\n=== Ghi file mới ===");
write("src/lib/auth.tsx", authTsx);
write("src/pages/StaffInvites.tsx", staffInvitesTsx);
write("src/TenantShell.tsx", tenantShellTsx);

// ---------- PATCH StaffShell ----------
console.log("\n=== Patch StaffShell.tsx ===");
const shellOk = patch(
  "src/StaffShell.tsx",
  "if (!profile)",
  'if (profile && profile.role === "tenant") return <Navigate to="/toi" replace />;\n  ',
  ""
);
if (!shellOk) {
  console.log(`
  ┌─── SỬA TAY src/StaffShell.tsx ─────────────────────────────
  │ 1. import { Navigate } from "react-router-dom";
  │ 2. Ngay sau guard "if (!user)" hoặc "if (!profile)", thêm:
  │    if (profile?.role === "tenant") return <Navigate to="/toi" replace />;
  └────────────────────────────────────────────────────────────
  `);
}

// ---------- PATCH App.tsx ----------
console.log("\n=== Patch App.tsx ===");
const appOk1 = patch("src/App.tsx", "function App",
  'import TenantShell from "./TenantShell";\nimport StaffInvites from "./pages/StaffInvites";\n\n', "");
const appOk2 = patch("src/App.tsx", "</Routes>",
  '      <Route path="/toi" element={<TenantShell />} />\n      <Route path="/staff-invites" element={<StaffInvites />} />\n    ', "");
if (!appOk1 || !appOk2) {
  console.log(`
  ┌─── SỬA TAY src/App.tsx ────────────────────────────────────
  │ import TenantShell from "./TenantShell";
  │ import StaffInvites from "./pages/StaffInvites";
  │ ...
  │ <Routes>
  │   ... routes cũ ...
  │   <Route path="/toi" element={<TenantShell />} />
  │   <Route path="/staff-invites" element={<StaffInvites />} />
  │ </Routes>
  └────────────────────────────────────────────────────────────
  `);
}

console.log("\n✅ Xong. Bước tiếp theo:");
console.log("   1. Publish Firestore rules (snippet bên dưới)");
console.log("   2. git add -A && git commit -m 'phase1: role gating + tenant shell'");
console.log("   3. npm run build && firebase deploy --only hosting");
console.log("   4. Test checklist (bên dưới)");
console.log("\n💡 Rollback: các file .bak.<timestamp> nằm cạnh file gốc.");
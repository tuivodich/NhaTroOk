// setup-lib.mjs — Chay: node setup-lib.mjs
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

// ============ package.json ============
w("package.json", String.raw`{
  "name": "nhatro",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "firebase": "^13.1.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "react-router-dom": "^7.18.4"
  },
  "devDependencies": {
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.2",
    "typescript": "^7.0.2",
    "vite": "^8.3.5"
  }
}
`);

// ============ src/lib/firebase.ts ============
w("src/lib/firebase.ts", String.raw`import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// THAY BANG CAU HINH FIREBASE CUA BAN (Console > Project settings > Your apps > Web).
// Cau hinh web KHONG phai bi mat. Bao mat do firestore.rules dam nhiem.
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "nhatro-demo.firebaseapp.com",
  projectId: "nhatro-demo",
  storageBucket: "nhatro-demo.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:replace_me",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
`);

// ============ src/lib/types.ts ============
w("src/lib/types.ts", String.raw`export type Role = "owner" | "manager" | "staff" | "tenant";
export const STAFF_ROLES: Role[] = ["owner", "manager", "staff"];

export const isStaffRole = (r?: string): boolean => r === "owner" || r === "manager" || r === "staff";
export const isAdminRole = (r?: string): boolean => r === "owner" || r === "manager";

export interface UserDoc {
  name?: string;
  email: string;
  role: Role;
}

export interface PropertyDoc {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  roomCount?: number;
}

export type RoomStatus = "vacant" | "occupied" | "maintenance";

export interface RoomDoc {
  id: string;
  propertyId: string;
  code: string;
  floor?: number;
  area?: number;
  baseRent: number;
  deposit?: number;
  amenities?: string[];
  amenitiesEn?: string[];
  images?: string[];
  status: RoomStatus;
  meter?: { electricStart?: number; waterStart?: number };
  desc?: string;
  descEn?: string;
}
`);

// ============ src/lib/useCollection.ts ============
w("src/lib/useCollection.ts", String.raw`import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export function useCollection<T extends { id: string }>(name: string, enabled = true) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    return onSnapshot(
      collection(db, name),
      (snap) => {
        setData(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T));
        setLoading(false);
      },
      (err) => { console.error(name, err); setLoading(false); },
    );
  }, [name, enabled]);
  return { data, loading };
}
`);

// ============ src/lib/auth.tsx ============
w("src/lib/auth.tsx", String.raw`import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserDoc } from "./types";

interface AuthState {
  user: User | null;
  profile: UserDoc | null;
  loading: boolean;
  login: (email: string, pw: string) => Promise<void>;
  register: (email: string, pw: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null!);

async function ensureProfile(u: User) {
  const ref = doc(db, "users", u.uid);
  if ((await getDoc(ref)).exists()) return;
  const base = { email: u.email ?? "", name: u.displayName ?? "" };
  const boot = await getDoc(doc(db, "meta", "bootstrap"));
  if (!boot.exists()) {
    const b = writeBatch(db);
    b.set(doc(db, "meta", "bootstrap"), { uid: u.uid, createdAt: serverTimestamp() });
    b.set(ref, { ...base, role: "owner" });
    try { await b.commit(); return; } catch { /* co nguoi khac nhanh hon -> tenant */ }
  }
  await setDoc(ref, { ...base, role: "tenant" });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const creating = useRef(false);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); if (!u) { setProfile(null); setLoading(false); } }), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (s) => {
      if (s.exists()) { setProfile(s.data() as UserDoc); setLoading(false); return; }
      setProfile(null);
      if (!creating.current) {
        creating.current = true;
        ensureProfile(user).catch((e) => console.error("ensureProfile", e)).finally(() => { creating.current = false; setLoading(false); });
      }
    }, () => setLoading(false));
  }, [user]);

  const login = async (email: string, pw: string) => { await signInWithEmailAndPassword(auth, email, pw); };
  const register = async (email: string, pw: string) => { await createUserWithEmailAndPassword(auth, email, pw); };
  const loginGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  };

  return (
    <Ctx.Provider value={{ user, profile, loading, login, register, loginGoogle, logout: () => signOut(auth) }}>
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);
`);

// ============ src/lib/audit.ts ============
w("src/lib/audit.ts", String.raw`import { addDoc, collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useEffect } from "react";
import { db } from "./firebase";
import { useAuth } from "./auth";

let auditOn = true;
let watchers = 0;
let stop: (() => void) | null = null;
function watchAuditSwitch() {
  if (watchers++ === 0) stop = onSnapshot(doc(db, "settings", "audit"), (s) => { auditOn = s.data()?.enabled !== false; }, () => { auditOn = true; });
  return () => { if (--watchers === 0) { stop?.(); stop = null; } };
}

export function useAudit() {
  const { user, profile } = useAuth();
  useEffect(() => { if (user) return watchAuditSwitch(); }, [user]);
  return (action: string, summary: string, target?: { type: string; id: string }) => {
    if (!user || !auditOn) return;
    addDoc(collection(db, "auditLog"), {
      at: serverTimestamp(),
      by: user.uid,
      byName: (profile?.name || user.displayName || user.email || "").slice(0, 100),
      role: profile?.role ?? "",
      action: action.slice(0, 40),
      summary: summary.slice(0, 300),
      targetType: target?.type ?? "",
      targetId: (target?.id ?? "").slice(0, 100),
    }).catch((e) => console.error("audit", e));
  };
}
`);

// ============ src/lib/i18n.tsx ============
w("src/lib/i18n.tsx", String.raw`import { createContext, useContext, useState, type ReactNode } from "react";

export type Lang = "vi" | "en";

const dict = {
  vi: {
    login: "Đăng nhập",
    register: "Đăng ký",
    logout: "Đăng xuất",
    email: "Email",
    password: "Mật khẩu",
    loginGoogle: "Đăng nhập bằng Google",
    signInTitle: "Đăng nhập",
    signUpTitle: "Đăng ký tài khoản",
    noAccount: "Chưa có tài khoản? Đăng ký",
    haveAccount: "Đã có tài khoản? Đăng nhập",
    firstUserHint: "Người đầu tiên đăng ký sẽ là Chủ hệ thống.",
    goToAdmin: "Vào trang quản trị",
    save: "Lưu",
    cancel: "Hủy",
    add: "Thêm",
    edit: "Sửa",
    delete: "Xóa",
    close: "Đóng",
    loading: "Đang tải...",
    error: "Có lỗi xảy ra",
    none: "— Không —",
    sure: "Bạn chắc chắn chứ?",
    all: "Tất cả",
    properties: "Nhà trọ",
    propertyName: "Tên nhà trọ",
    propertyAddress: "Địa chỉ",
    propertyNotes: "Ghi chú",
    propertyRooms: "Số phòng",
    addProperty: "Thêm nhà trọ",
    editProperty: "Sửa nhà trọ",
    deletePropertySure: "Xóa nhà trọ này?",
    propertyHasRooms: "Không thể xóa: nhà trọ này còn phòng.",
    noProperties: "Chưa có nhà trọ nào. Thêm nhà trọ đầu tiên.",
    rooms: "Phòng",
    roomCode: "Mã phòng",
    roomFloor: "Tầng",
    roomArea: "Diện tích (m²)",
    roomRent: "Giá thuê / tháng",
    roomDeposit: "Tiền cọc",
    roomStatus: "Trạng thái",
    roomProperty: "Thuộc nhà trọ",
    roomAmenities: "Tiện ích (mỗi dòng một mục)",
    roomDescription: "Mô tả (VI)",
    roomDescriptionEn: "Mô tả (EN)",
    roomMeterStart: "Chỉ số công tơ ban đầu",
    roomElectricStart: "Điện (kWh)",
    roomWaterStart: "Nước (m³)",
    addRoom: "Thêm phòng",
    editRoom: "Sửa phòng",
    deleteRoomSure: "Xóa phòng này?",
    noRooms: "Chưa có phòng nào.",
    statusVacant: "Trống",
    statusOccupied: "Đang thuê",
    statusMaintenance: "Bảo trì",
    dashboard: "Tổng quan",
    totalProperties: "Nhà trọ",
    totalRooms: "Tổng phòng",
    vacantRooms: "Phòng trống",
    occupiedRooms: "Đang thuê",
    quickActions: "Thao tác nhanh",
    menuManage: "Quản lý",
    menuFinance: "Tài chính",
    menuSettings: "Cài đặt",
    tenants: "Người thuê",
    contracts: "Hợp đồng",
    meter: "Công tơ",
    invoices: "Hóa đơn",
    payments: "Thu tiền",
    debt: "Công nợ",
    expenses: "Chi phí",
    reports: "Báo cáo",
    maintenance: "Bảo trì",
    tempResidence: "Tạm trú",
    audit: "Nhật ký",
    brandTitle: "Thương hiệu",
    brandDesc: "Tên, logo, màu chủ đạo, tiêu đề hóa đơn.",
    brandName: "Tên đầy đủ",
    brandShortName: "Tên ngắn",
    brandTagline: "Khẩu hiệu",
    brandColor: "Màu chủ đạo",
    brandTransferPrefix: "Tiền tố chuyển khoản",
    brandSaved: "Đã lưu thương hiệu.",
    comingSoon: "Tính năng đang được xây dựng",
    comingSoonDesc: "Mục này sẽ có trong phiên bản tiếp theo.",
    owner: "Chủ",
    manager: "Quản lý",
    staff: "Nhân viên",
    tenant: "Người thuê",
  },
  en: {
    login: "Sign in", register: "Sign up", logout: "Sign out",
    email: "Email", password: "Password", loginGoogle: "Sign in with Google",
    signInTitle: "Sign in", signUpTitle: "Create account",
    noAccount: "No account? Sign up", haveAccount: "Have an account? Sign in",
    firstUserHint: "The first person to sign up becomes the Owner.",
    goToAdmin: "Open admin", save: "Save", cancel: "Cancel", add: "Add", edit: "Edit", delete: "Delete",
    close: "Close", loading: "Loading...", error: "Something went wrong",
    none: "- None -", sure: "Are you sure?", all: "All",
    properties: "Properties", propertyName: "Property name", propertyAddress: "Address", propertyNotes: "Notes",
    propertyRooms: "Rooms", addProperty: "Add property", editProperty: "Edit property",
    deletePropertySure: "Delete this property?", propertyHasRooms: "Cannot delete: this property still has rooms.",
    noProperties: "No properties yet. Add the first one.",
    rooms: "Rooms", roomCode: "Room code", roomFloor: "Floor", roomArea: "Area (m2)",
    roomRent: "Monthly rent", roomDeposit: "Deposit", roomStatus: "Status", roomProperty: "Property",
    roomAmenities: "Amenities (one per line)", roomDescription: "Description (VI)", roomDescriptionEn: "Description (EN)",
    roomMeterStart: "Initial meter reading", roomElectricStart: "Electric (kWh)", roomWaterStart: "Water (m3)",
    addRoom: "Add room", editRoom: "Edit room", deleteRoomSure: "Delete this room?", noRooms: "No rooms yet.",
    statusVacant: "Vacant", statusOccupied: "Occupied", statusMaintenance: "Maintenance",
    dashboard: "Dashboard", totalProperties: "Properties", totalRooms: "Total rooms",
    vacantRooms: "Vacant", occupiedRooms: "Occupied", quickActions: "Quick actions",
    menuManage: "Manage", menuFinance: "Finance", menuSettings: "Settings",
    tenants: "Tenants", contracts: "Contracts", meter: "Meter readings",
    invoices: "Invoices", payments: "Payments", debt: "Debt", expenses: "Expenses", reports: "Reports",
    maintenance: "Maintenance", tempResidence: "Temp. residence", audit: "Activity log",
    brandTitle: "Brand", brandDesc: "Name, logo, theme color, invoice header.",
    brandName: "Full name", brandShortName: "Short name", brandTagline: "Tagline", brandColor: "Theme color",
    brandTransferPrefix: "Transfer prefix", brandSaved: "Brand saved.",
    comingSoon: "Coming soon", comingSoonDesc: "This feature will arrive in an upcoming version.",
    owner: "Owner", manager: "Manager", staff: "Staff", tenant: "Tenant",
  },
} as const;

export type Key = keyof typeof dict.vi;

interface I18nCtx { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string; }
const Ctx = createContext<I18nCtx>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return localStorage.getItem("lang") === "en" ? "en" : "vi"; } catch { return "vi"; }
  });
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem("lang", l); } catch { /* ignore */ } };
  const t = (k: Key) => dict[lang][k] ?? k;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
`);

// ============ src/lib/format.ts ============
w("src/lib/format.ts", String.raw`export function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n || 0));
}

export const moneyText = (n: number): string => formatVnd(n) + " VND";

export function fmtDate(s?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? "");
  return m ? m[3] + "/" + m[2] + "/" + m[1] : s ?? "";
}

export const todayStr = () => toDateStr(new Date());

export function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

export const shortCode = (id: string): string =>
  id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
`);

// ============ src/brand/BrandProvider.tsx ============
w("src/brand/BrandProvider.tsx", String.raw`import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface Brand {
  name: string;
  shortName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  brandColor: string;
  invoiceHeader: string;
  footerNote: string;
  transferPrefix: string;
}

export const DEFAULT_BRAND: Brand = {
  name: "Nhà trọ",
  shortName: "Nhà trọ",
  tagline: "",
  logoUrl: "",
  faviconUrl: "/favicon.svg",
  brandColor: "#2d6a4f",
  invoiceHeader: "",
  footerNote: "",
  transferPrefix: "TRO",
};

const Ctx = createContext<Brand | null>(null);

function parseBrand(raw: Record<string, unknown> | undefined): Brand {
  if (!raw) return DEFAULT_BRAND;
  const str = (k: keyof Brand, def = "") => (typeof raw[k] === "string" ? (raw[k] as string) : def);
  return {
    name: str("name", DEFAULT_BRAND.name).trim() || DEFAULT_BRAND.name,
    shortName: str("shortName", DEFAULT_BRAND.shortName).trim() || str("name", DEFAULT_BRAND.name),
    tagline: str("tagline", DEFAULT_BRAND.tagline),
    logoUrl: str("logoUrl", DEFAULT_BRAND.logoUrl),
    faviconUrl: str("faviconUrl", DEFAULT_BRAND.faviconUrl) || DEFAULT_BRAND.faviconUrl,
    brandColor: /^#[0-9A-Fa-f]{6}$/.test(str("brandColor")) ? str("brandColor") : DEFAULT_BRAND.brandColor,
    invoiceHeader: str("invoiceHeader", DEFAULT_BRAND.invoiceHeader),
    footerNote: str("footerNote", DEFAULT_BRAND.footerNote),
    transferPrefix: str("transferPrefix", DEFAULT_BRAND.transferPrefix).toUpperCase() || DEFAULT_BRAND.transferPrefix,
  };
}

const CACHE_KEY = "brand";

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<Brand>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return { ...DEFAULT_BRAND, ...JSON.parse(raw) } as Brand;
    } catch { /* ignore */ }
    return DEFAULT_BRAND;
  });

  useEffect(() => {
    return onSnapshot(
      doc(db, "settings", "brand"),
      (s) => {
        if (!s.exists()) return;
        const b = parseBrand(s.data());
        setBrand(b);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
      },
      () => { /* offline */ },
    );
  }, []);

  useEffect(() => {
    document.title = brand.name;
    document.documentElement.style.setProperty("--brand-color", brand.brandColor);
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon && brand.faviconUrl) icon.href = brand.faviconUrl;
  }, [brand]);

  return <Ctx.Provider value={brand}>{children}</Ctx.Provider>;
}

export function useBrand(): Brand {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBrand() phai nam trong BrandProvider");
  return ctx;
}
`);

// ============ src/brand/BrandName.tsx ============
w("src/brand/BrandName.tsx", String.raw`import { useBrand } from "./BrandProvider";

export default function BrandName({ short = false }: { short?: boolean }) {
  const brand = useBrand();
  return <>{short ? brand.shortName : brand.name}</>;
}

export function BrandLogo({ size = 28 }: { size?: number }) {
  const brand = useBrand();
  const src = brand.logoUrl || brand.faviconUrl;
  return <img src={src} alt={brand.name} width={size} height={size} style={{ display: "inline-block", verticalAlign: "middle", borderRadius: 6 }} />;
}
`);

// ============ src/components/NumInput.tsx ============
w("src/components/NumInput.tsx", String.raw`import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number | "";
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  allowEmpty?: boolean;
};

export default function NumInput({ value, onChange, allowEmpty, ...rest }: Props) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(String(value)); }, [value]);
  return (
    <input {...rest} type="number" value={text}
      onFocus={(e) => { focused.current = true; rest.onFocus?.(e); }}
      onBlur={(e) => { focused.current = false; setText(String(value)); rest.onBlur?.(e); }}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value !== "" || allowEmpty) onChange(e);
      }} />
  );
}
`);

// ============ src/components/MoneyText.tsx ============
w("src/components/MoneyText.tsx", String.raw`export default function MoneyText({ vnd }: { vnd: number }) {
  return <>{new Intl.NumberFormat("vi-VN").format(Math.round(vnd || 0))} <span className="cur">VNĐ</span></>;
}
`);

// ============ src/components/Dropdown.tsx ============
w("src/components/Dropdown.tsx", String.raw`import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export interface DdItem {
  label: string;
  to?: string;
  onClick?: () => void;
  active?: boolean;
}

export default function Dropdown({ label, items, align = "left", active = false }: {
  label: string; items: DdItem[]; align?: "left" | "right"; active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className={"dd " + (open ? "open " : "") + (active ? "active" : "")}>
      <button type="button" className="dd-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}<span className="dd-caret" />
      </button>
      <div className={"dd-menu " + (align === "right" ? "right" : "")} role="menu">
        {items.map((it) => it.to
          ? <Link key={it.label} to={it.to} role="menuitem" className={it.active ? "on" : ""} onClick={() => setOpen(false)}>{it.label}</Link>
          : <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick?.(); }}>{it.label}</button>)}
      </div>
    </div>
  );
}
`);

console.log("");
console.log("Xong setup-lib.mjs");
console.log("Buoc tiep: node setup-lib.mjs, sau do node setup-pages.mjs");
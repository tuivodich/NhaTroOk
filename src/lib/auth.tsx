import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
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

  // Email/password — dùng bởi Login.tsx
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;

  // Google popup — nhiều tên gọi để tương thích
  signIn: () => Promise<void>;
  loginGoogle: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;

  // Đăng xuất — nhiều tên gọi
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

async function ensureProfile(user: FirebaseUser): Promise<UserProfile> {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return snap.data() as UserProfile;

  // Vai trò khi tạo hồ sơ: staff nếu email có lời mời còn hiệu lực, ngược lại tenant.
  // Admin KHÔNG thể tự gán (rules chặn). Admin đầu tiên của dự án mới: đặt role = "admin"
  // thủ công trong Firebase Console (Firestore > users > doc của bạn).
  let role: Role = "tenant";
  if (user.email) {
    const emailLower = user.email.toLowerCase();
    const inviteRef = doc(db, "staffInvites", emailLower);
    try {
      const inviteSnap = await getDoc(inviteRef);
      if (inviteSnap.exists() && inviteSnap.data().active !== false) role = "staff";
    } catch { /* không đọc được lời mời → giữ tenant */ }
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
  if (role === "staff" && user.email) {
    try {
      await updateDoc(doc(db, "staffInvites", user.email.toLowerCase()), { acceptedAt: serverTimestamp(), acceptedBy: user.uid });
    } catch { /* non-blocking: chỉ admin sửa được lời mời */ }
  }
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
        try { setProfile(await ensureProfile(u)); }
        catch (e) { console.error("[auth] ensureProfile failed", e); setProfile(null); }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName });
    }
  };

  const signIn = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const signOut = async () => { await fbSignOut(auth); };

  return (
    <Ctx.Provider value={{
      user, profile, loading,
      login,
      register,
      signIn,
      loginGoogle: signIn,
      loginWithGoogle: signIn,
      signOut,
      logout: signOut,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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

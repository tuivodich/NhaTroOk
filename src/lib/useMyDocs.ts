import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

/** [PHASE4C] Đọc realtime các doc có userId == uid (khớp rules của cổng cư dân). */
export function useMyDocs<T>(name: string, uid?: string | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) { setData([]); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(
      query(collection(db, name), where("userId", "==", uid)),
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as unknown as T));
        setLoading(false);
      },
      (e) => { setError(e.message); setLoading(false); }
    );
  }, [name, uid]);

  return { data, loading, error };
}

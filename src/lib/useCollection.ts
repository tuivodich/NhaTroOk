import { useEffect, useState } from "react";
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

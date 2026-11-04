import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/** [PHASE4D] settings/payment { text } — hướng dẫn chuyển khoản hiển thị cho khách. */
export function usePaymentInfo() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => onSnapshot(doc(db, "settings", "payment"),
    (s) => { setText(s.exists() ? String(s.data().text ?? "") : ""); setLoading(false); },
    () => setLoading(false)), []);
  return { text, loading };
}

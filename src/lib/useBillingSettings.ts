import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_BILLING } from "./billing";
import type { BillingSettings } from "./types";

/** Đọc settings/billing realtime. `configured` = false khi admin chưa lưu đơn giá lần nào. */
export function useBillingSettings() {
  const [settings, setSettings] = useState<BillingSettings>(DEFAULT_BILLING);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    return onSnapshot(
      doc(db, "settings", "billing"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as Partial<BillingSettings>;
          setSettings({
            electricRate: Number(d.electricRate) || 0,
            waterRate: Number(d.waterRate) || 0,
            fixedFees: Array.isArray(d.fixedFees) ? d.fixedFees : [],
          });
          setConfigured(true);
        } else {
          setSettings(DEFAULT_BILLING);
          setConfigured(false);
        }
        setLoading(false);
      },
      (e) => { setError(e.message); setLoading(false); }
    );
  }, []);

  return { settings, configured, loading, error };
}

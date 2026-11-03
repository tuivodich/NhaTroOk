import { useCollection } from "../lib/useCollection";
import { useI18n } from "../lib/i18n";
import type { AuditDoc } from "../lib/types";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export default function AuditLog() {
  const { t } = useI18n();
  const { data, loading } = useCollection<AuditDoc>("auditLogs");

  const sorted = [...data].sort((a, b) => {
    const av = (a.at as any)?.seconds ?? 0;
    const bv = (b.at as any)?.seconds ?? 0;
    return bv - av;
  });

  const purgeAllLogs = async () => {
    if (!window.confirm(
      "Xóa toàn bộ nhật ký?\n\nHành động này KHÔNG THỂ HOÀN TÁC.\n\nBấm OK để tiếp tục."
    )) return;
    if (!window.confirm(
      "XÁC NHẬN LẦN 2:\n\nChắc chắn xóa TOÀN BỘ nhật ký?"
    )) return;

    try {
      const snap = await getDocs(collection(db, "auditLogs"));
      const total = snap.size;
      if (total === 0) {
        alert("Không có nhật ký để xóa.");
        return;
      }

      let count = 0;
      let batch = writeBatch(db);
      const promises: Promise<void>[] = [];

      for (const d of snap.docs) {
        batch.delete(d.ref);
        count++;
        if (count === 500) {
          promises.push(batch.commit());
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) promises.push(batch.commit());
      await Promise.all(promises);

      // Ghi 1 dòng audit mới để lưu vết thao tác xóa
      try {
        await addDoc(collection(db, "auditLogs"), {
          action: "purgeAuditLogs",
          message: "Đã xóa " + total + " nhật ký",
          count: total,
          at: serverTimestamp(),
        });
      } catch {}

      alert("Đã xóa " + total + " nhật ký.");
    } catch (e: any) {
      console.error(e);
      alert("Xóa thất bại: " + (e?.message || "unknown"));
    }
  };

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("auditLog")}</h2>
        <button
          onClick={purgeAllLogs}
          disabled={loading || sorted.length === 0}
          style={{
            padding: "8px 16px",
            background: sorted.length === 0 ? "#999" : "#c62828",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: sorted.length === 0 ? "not-allowed" : "pointer",
            fontSize: 14,
          }}
        >
          Xóa toàn bộ nhật ký
        </button>
      </div>

      {loading ? <p>{t("loading")}</p> : sorted.length === 0 ? (
        <p className="info">{t("noAudit")}</p>
      ) : (
        <div className="list">
          {sorted.slice(0, 200).map((x) => (
            <div className="card" key={x.id}>
              <div className="row between">
                <strong>{x.action}</strong>
                <small>{x.email || x.uid || ""}</small>
              </div>
              <div>{x.message}</div>
              {x.target ? <small>{x.target.type} · {x.target.id}</small> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

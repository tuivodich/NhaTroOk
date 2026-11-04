import { useMemo, useState } from "react";
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
  const [q, setQ] = useState("");

  const sorted = [...data].sort((a, b) => {
    const av = (a.at as any)?.seconds ?? 0;
    const bv = (b.at as any)?.seconds ?? 0;
    return bv - av;
  });

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((x) => [x.action, x.message ?? "", x.email ?? "", x.uid ?? ""].some((v) => String(v).toLowerCase().includes(needle)));
  }, [sorted, q]);
  const kind = (a: string) => (/delete|purge/i.test(a) ? "cancelled" : /create|convert|activate/i.test(a) ? "active" : /role/i.test(a) ? "occupied" : "draft");
  const fmtAt = (at: any) => (at?.seconds ? new Date(at.seconds * 1000).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "medium" }) : "");

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
    <section className="ct" style={{ maxWidth: 900 }}>
      <div className="ct-head">
        <div>
          <h2>{t("auditLog")}</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Ai đã làm gì và khi nào. Hiển thị tối đa 200 bản ghi mới nhất.</p>
        </div>
        <button className="ghost danger" onClick={purgeAllLogs} disabled={loading || sorted.length === 0}>
          Xóa toàn bộ nhật ký
        </button>
      </div>

      {sorted.length > 0 && (
        <div className="ct-toolbar">
          <label className="ct-search" style={{ flex: "1 1 280px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Tìm hành động, người thực hiện…" aria-label="Tìm nhật ký" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <span className="ct-count" role="status" aria-atomic="true" style={{ margin: 0 }}>{shown.length} / {sorted.length} bản ghi</span>
        </div>
      )}

      {loading ? (
        <div className="ct-list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="ct-card ct-skel" style={{ minHeight: 70 }} />)}</div>
      ) : sorted.length === 0 ? (
        <div className="ct-empty"><strong>{t("noAudit")}</strong></div>
      ) : shown.length === 0 ? (
        <div className="ct-empty"><strong>Không có bản ghi phù hợp.</strong><button className="ghost" onClick={() => setQ("")}>Xóa tìm kiếm</button></div>
      ) : (
        <ol className="au-list">
          {shown.slice(0, 200).map((x) => (
            <li className="au-item" key={x.id}>
              <div className="au-time ct-num">{fmtAt(x.at)}</div>
              <div className="au-main">
                <div className="au-row">
                  <span className={"tag " + kind(x.action)}>{x.action}</span>
                  <span className="ct-sub" style={{ overflowWrap: "anywhere" }}>{x.email || x.uid || ""}</span>
                </div>
                {x.message && <div style={{ overflowWrap: "anywhere" }}>{x.message}</div>}
                {x.target ? <div className="ct-sub ct-num" style={{ overflowWrap: "anywhere" }}>{x.target.type} · {x.target.id}</div> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

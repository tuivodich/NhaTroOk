import { useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useMyDocs } from "../../lib/useMyDocs";
import type { MaintenanceRequest, MaintenanceStatus } from "../../lib/types";

export const MAINT_LABEL: Record<MaintenanceStatus, string> = { new: "Đã gửi", in_progress: "Đang xử lý", done: "Hoàn thành" };
export const maintTag = (s: MaintenanceStatus) => (s === "done" ? "active" : s === "in_progress" ? "occupied" : "unpaid");

export default function TenantMaintenance({ uid, tenantId, roomId }: { uid: string; tenantId?: string; roomId?: string }) {
  const { data, loading } = useMyDocs<MaintenanceRequest>("maintenanceRequests", uid);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(""); setOk(false);
    const t = title.trim();
    if (t.length < 3) return setErr("Hãy mô tả ngắn gọn sự cố (ít nhất 3 ký tự).");
    setBusy(true);
    try {
      await addDoc(collection(db, "maintenanceRequests"), {
        userId: uid, ...(tenantId ? { tenantId } : {}), ...(roomId ? { roomId } : {}),
        title: t, description: desc.trim(), status: "new", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setTitle(""); setDesc(""); setOk(true);
    } catch (ex) { setErr("Không gửi được: " + ((ex as Error)?.message ?? String(ex))); }
    finally { setBusy(false); }
  };

  const sorted = [...data].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  const when = (ts: any) => (ts?.seconds ? new Date(ts.seconds * 1000).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "");

  return (
    <div className="tp-stack">
      <form className="card ct-form" onSubmit={submit}>
        <h3>Gửi yêu cầu sửa chữa</h3>
        <label>Sự cố<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Vòi nước bồn rửa bị rỉ" required /></label>
        <label style={{ marginTop: 12 }}>Chi tiết (tuỳ chọn)<textarea rows={3} maxLength={1000} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        {err && <p className="error" role="alert" style={{ marginTop: 12 }}>{err}</p>}
        {ok && <p className="info" role="status" style={{ marginTop: 12 }}>Đã gửi. Chủ trọ sẽ cập nhật trạng thái ở bên dưới.</p>}
        <div className="ct-actions"><button type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Gửi yêu cầu"}</button></div>
      </form>

      <h3 style={{ margin: "8px 0 0" }}>Lịch sử yêu cầu</h3>
      {loading ? <div className="ct-card ct-skel" /> : sorted.length === 0 ? (
        <div className="ct-empty"><strong>Bạn chưa gửi yêu cầu nào.</strong></div>
      ) : sorted.map((m) => (
        <article className="ct-card" key={m.id} style={{ borderLeftColor: "var(--border)" }}>
          <header className="ct-card-head">
            <div className="ct-code" style={{ fontSize: 15, overflowWrap: "anywhere" }}>{m.title}</div>
            <span className={"tag " + maintTag(m.status)}>{MAINT_LABEL[m.status]}</span>
          </header>
          {m.description && <p className="ct-notes">{m.description}</p>}
          <div className="ct-sub">{when(m.createdAt)}</div>
          {m.staffNote && <p className="ct-alert warn" role="note" style={{ margin: 0 }}>Chủ trọ: {m.staffNote}</p>}
        </article>
      ))}
    </div>
  );
}

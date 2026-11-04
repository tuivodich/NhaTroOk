import { useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import type { MaintenanceRequest, MaintenanceStatus, RoomDoc, TenantDoc } from "../lib/types";
import { MAINT_LABEL, maintTag } from "./tenant/TenantMaintenance";

export default function Maintenance() {
  const audit = useAudit();
  const { data: list, loading } = useCollection<MaintenanceRequest>("maintenanceRequests");
  const { data: rooms } = useCollection<RoomDoc>("rooms");
  const { data: tenants } = useCollection<TenantDoc>("tenants");
  const [filter, setFilter] = useState<MaintenanceStatus | "all">("all");
  const [err, setErr] = useState("");

  const sorted = useMemo(() => [...list].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)), [list]);
  const shown = sorted.filter((m) => filter === "all" || m.status === filter);
  const keys = Object.keys(MAINT_LABEL) as MaintenanceStatus[];
  const roomCode = (id?: string) => rooms.find((r) => r.id === id)?.code ?? "—";
  const tenantName = (id?: string) => tenants.find((t) => t.id === id)?.name ?? "—";
  const when = (ts: any) => (ts?.seconds ? new Date(ts.seconds * 1000).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "");

  const update = async (m: MaintenanceRequest, patch: Partial<MaintenanceRequest>) => {
    setErr("");
    try {
      await updateDoc(doc(db, "maintenanceRequests", m.id), { ...patch, updatedAt: serverTimestamp() });
      if (patch.status && patch.status !== m.status) audit("maintenance.status", `${m.title} -> ${patch.status}`, { type: "maintenance", id: m.id });
    } catch (ex) { setErr("Lỗi: " + ((ex as Error)?.message ?? String(ex))); }
  };

  return (
    <section className="ct">
      <div className="ct-head">
        <div>
          <h2>Yêu cầu sửa chữa</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Khách gửi từ cổng cư dân. Cập nhật trạng thái để khách theo dõi.</p>
        </div>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="ct-toolbar">
        <div className="ct-chips" role="group" aria-label="Lọc theo trạng thái">
          <button type="button" className={"ct-chip" + (filter === "all" ? " on" : "")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Tất cả <span className="ct-chip-n">{list.length}</span></button>
          {keys.map((k) => (
            <button key={k} type="button" className={"ct-chip" + (filter === k ? " on" : "")} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {MAINT_LABEL[k]} <span className="ct-chip-n">{list.filter((m) => m.status === k).length}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="ct-list" style={{ marginTop: 14 }}><div className="ct-card ct-skel" /></div> : shown.length === 0 ? (
        <div className="ct-empty" style={{ marginTop: 14 }}><strong>{list.length === 0 ? "Chưa có yêu cầu nào." : "Không có yêu cầu ở trạng thái này."}</strong></div>
      ) : (
        <div className="ct-list" style={{ marginTop: 14 }}>
          {shown.map((m) => (
            <article className={"ct-card" + (m.status === "new" ? " warn" : "")} key={m.id}>
              <header className="ct-card-head">
                <div style={{ minWidth: 0 }}>
                  <div className="ct-code" style={{ fontSize: 15, overflowWrap: "anywhere" }}>{m.title}</div>
                  <div className="ct-sub">Phòng {roomCode(m.roomId)} · {tenantName(m.tenantId)} · {when(m.createdAt)}</div>
                </div>
                <span className={"tag " + maintTag(m.status)}>{MAINT_LABEL[m.status]}</span>
              </header>
              {m.description && <p className="iq-msg">{m.description}</p>}
              <div className="iq-controls">
                <label className="iq-field">Trạng thái
                  <select value={m.status} onChange={(e) => update(m, { status: e.target.value as MaintenanceStatus })}>
                    {keys.map((k) => <option key={k} value={k}>{MAINT_LABEL[k]}</option>)}
                  </select>
                </label>
                <label className="iq-field">Phản hồi cho khách
                  <input defaultValue={m.staffNote ?? ""} placeholder="Ví dụ: Thợ sẽ qua chiều mai" onBlur={(e) => { if (e.target.value !== (m.staffNote ?? "")) update(m, { staffNote: e.target.value }); }} />
                </label>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

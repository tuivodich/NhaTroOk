import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { isAdminRole } from "../lib/types";
import { IcDoor } from "../components/Icons";

type Room = {
  id: string;
  code?: string;
  published?: boolean;
  featured?: boolean;
  photos?: string[];
};

export default function RoomExtras() {
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "rooms"), (snap) => {
      setRooms(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Room))
        .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "", "vi", { numeric: true })));
      setLoading(false);
    });
  }, []);

  if (!isAdminRole(profile?.role)) {
    return <section className="ct"><div className="ct-empty"><strong>Chỉ admin mới có quyền truy cập.</strong></div></section>;
  }

  async function update(id: string, patch: Partial<Room>) {
    setBusy(id); setErr("");
    try { await updateDoc(doc(db, "rooms", id), patch); }
    catch (e: any) { setErr(e?.message || "Cập nhật thất bại"); }
    finally { setBusy(null); }
  }

  async function publishAll() {
    const pending = rooms.filter((r) => r.published !== true);
    if (pending.length === 0) { alert("Tất cả phòng đã được publish."); return; }
    if (!confirm(`Đặt published=true cho ${pending.length} phòng chưa đăng?`)) return;
    if (!confirm(`XÁC NHẬN LẦN 2: công khai ${pending.length} phòng trên trang web?`)) return;
    setErr("");
    try {
      for (const r of pending) await updateDoc(doc(db, "rooms", r.id), { published: true });
      alert(`Đã publish ${pending.length} phòng`);
    } catch (e: any) { setErr(e?.message || "Publish thất bại"); }
  }

  const nPub = rooms.filter((r) => r.published).length;

  return (
    <section className="ct">
      <div className="ct-head">
        <div>
          <h2>Ảnh &amp; Hiển thị phòng</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Quản lý ảnh, trạng thái công khai và phòng nổi bật trên trang khách xem phòng.</p>
        </div>
        <button className="ct-btn-primary" onClick={publishAll}>Công khai tất cả phòng chưa đăng</button>
      </div>

      <div className="ct-stats">
        <div className="ct-stat"><span className="ct-stat-n">{rooms.length}</span><span className="ct-stat-l">Tổng phòng</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{nPub}</span><span className="ct-stat-l">Đang công khai</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{rooms.filter((r) => r.featured).length}</span><span className="ct-stat-l">Nổi bật</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{rooms.filter((r) => !(r.photos?.length)).length}</span><span className="ct-stat-l">Chưa có ảnh</span></div>
      </div>

      {err && <p className="error" role="alert">{err}</p>}

      {loading ? (
        <div className="ct-list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="ct-card ct-skel" />)}</div>
      ) : rooms.length === 0 ? (
        <div className="ct-empty"><strong>Chưa có phòng nào.</strong></div>
      ) : (
        <div className="ct-list rm-grid">
          {rooms.map((r) => {
            const photo = r.photos?.[0];
            return (
              <article className="ct-card rm-card" key={r.id} aria-busy={busy === r.id}>
                {photo
                  ? <img className="rm-img" src={photo} alt={`Ảnh phòng ${r.code ?? ""}`} loading="lazy" />
                  : <div className="rm-img rm-img-empty" aria-hidden="true"><IcDoor /><span>Chưa có ảnh</span></div>}
                <div className="rm-body">
                  <div className="ct-code">Phòng {r.code || r.id.slice(0, 6)}</div>
                  <div className="rx-toggles">
                    <label className="rx-switch">
                      <input type="checkbox" checked={r.published === true} disabled={busy === r.id}
                        onChange={(e) => update(r.id, { published: e.target.checked })} />
                      <span className="rx-track" aria-hidden="true" /><span>Công khai</span>
                    </label>
                    <label className="rx-switch">
                      <input type="checkbox" checked={r.featured === true} disabled={busy === r.id}
                        onChange={(e) => update(r.id, { featured: e.target.checked })} />
                      <span className="rx-track" aria-hidden="true" /><span>Nổi bật</span>
                    </label>
                  </div>
                  <label className="iq-field">Ảnh (mỗi URL một dòng)
                    <textarea
                      rows={3}
                      defaultValue={(r.photos || []).join("\n")}
                      onBlur={(e) => {
                        const photos = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                        const old = (r.photos || []).join("\n");
                        if (photos.join("\n") !== old) update(r.id, { photos });
                      }}
                      placeholder="https://..."
                      style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}
                    />
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

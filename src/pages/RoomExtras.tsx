import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { isAdminRole } from "../lib/types";

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

  useEffect(() => {
    return onSnapshot(collection(db, "rooms"), (snap) => {
      setRooms(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Room)));
      setLoading(false);
    });
  }, []);

  if (!isAdminRole(profile?.role)) {
    return <div style={{ padding: 24 }}>Chỉ admin mới có quyền truy cập.</div>;
  }

  async function update(id: string, patch: Partial<Room>) {
    setBusy(id);
    try { await updateDoc(doc(db, "rooms", id), patch); }
    finally { setBusy(null); }
  }

  async function publishAll() {
    const pending = rooms.filter((r) => r.published !== true);
    if (pending.length === 0) { alert("Tất cả phòng đã được publish."); return; }
    if (!confirm(`Đặt published=true cho ${pending.length} phòng chưa đăng?`)) return;
    for (const r of pending) {
      await updateDoc(doc(db, "rooms", r.id), { published: true });
    }
    alert(`Đã publish ${pending.length} phòng`);
  }

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Ảnh & Hiển thị phòng</h1>
          <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
            Quản lý ảnh, trạng thái công khai và phòng nổi bật
          </p>
        </div>
        <button className="btn btn-primary" onClick={publishAll}>
          Publish tất cả phòng chưa đăng
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f8f9fa", textAlign: "left" }}>
              <th style={{ padding: 12 }}>Mã phòng</th>
              <th style={{ padding: 12, width: 100 }}>Công khai</th>
              <th style={{ padding: 12, width: 100 }}>Nổi bật</th>
              <th style={{ padding: 12 }}>Ảnh (mỗi URL một dòng)</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 12, fontWeight: 600 }}>{r.code || r.id.slice(0, 6)}</td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  <input type="checkbox" checked={r.published === true}
                    disabled={busy === r.id}
                    onChange={(e) => update(r.id, { published: e.target.checked })} />
                </td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  <input type="checkbox" checked={r.featured === true}
                    disabled={busy === r.id}
                    onChange={(e) => update(r.id, { featured: e.target.checked })} />
                </td>
                <td style={{ padding: 12 }}>
                  <textarea
                    rows={2}
                    defaultValue={(r.photos || []).join("\n")}
                    onBlur={(e) => {
                      const photos = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                      const old = (r.photos || []).join("\n");
                      if (photos.join("\n") !== old) update(r.id, { photos });
                    }}
                    placeholder="https://..."
                    style={{ width: "100%", fontSize: 12, fontFamily: "monospace", padding: 6, borderRadius: 4, border: "1px solid #ddd" }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

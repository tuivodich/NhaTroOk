import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { RoomDoc, PropertyDoc } from "../../lib/types";

type Room = RoomDoc & { id: string };
type Property = PropertyDoc & { id: string };

export default function RoomDetail() {
  const { id } = useParams<{ id: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "rooms", id));
        if (!mounted) return;
        if (!snap.exists()) { setErr("Không tìm thấy phòng"); setLoading(false); return; }
        const data = snap.data() as RoomDoc;
        if (data.published !== true) { setErr("Phòng này chưa được đăng công khai"); setLoading(false); return; }
        setRoom({ ...data, id: snap.id });

        // Fetch property (cho address) — bỏ qua nếu rules chặn
        if (data.propertyId) {
          try {
            const ps = await getDoc(doc(db, "properties", data.propertyId));
            if (ps.exists() && mounted) {
              setProperty({ ...(ps.data() as PropertyDoc), id: ps.id });
            }
          } catch { /* rules deny → bỏ qua */ }
        }
      } catch (e: any) {
        if (mounted) setErr(e?.message || "Lỗi tải phòng");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="public-shell"><div className="public-loading">Đang tải...</div></div>;
  if (err || !room) return (
    <div className="public-shell">
      <header className="public-header">
        <Link to="/" className="public-brand">Nhà trọ</Link>
        <Link to="/phong" className="public-login">← Danh sách</Link>
      </header>
      <div className="public-container"><div className="public-error">{err || "Không tải được phòng"}</div></div>
    </div>
  );

  const photos = room.photos || [];
  const description = room.desc || room.descEn || "";

  return (
    <div className="public-shell">
      <header className="public-header">
        <Link to="/" className="public-brand">Nhà trọ</Link>
        <Link to="/phong" className="public-login">← Danh sách</Link>
      </header>
      <main className="public-container">
        {photos.length > 0 && (
          <div className="room-gallery">
            <img src={photos[activePhoto]} alt="" className="room-gallery-main" />
            {photos.length > 1 && (
              <div className="room-gallery-thumbs">
                {photos.map((url, i) => (
                  <img key={i} src={url} alt="" onClick={() => setActivePhoto(i)}
                    className={"room-gallery-thumb " + (i === activePhoto ? "active" : "")} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="room-detail-body">
          <h1 className="public-h1">Phòng {room.code}</h1>
          {(property?.name || property?.address) && (
            <div className="room-detail-addr">
              📍 {property?.name}{property?.address ? " — " + property.address : ""}
            </div>
          )}

          <div className="room-detail-meta">
            {room.area != null && <div><span className="label">Diện tích</span><strong>{room.area} m²</strong></div>}
            <div>
              <span className="label">Giá thuê</span>
              <strong className="room-card-price">{room.baseRent.toLocaleString("vi-VN")} đ/tháng</strong>
            </div>
            {room.deposit != null && <div><span className="label">Đặt cọc</span><strong>{room.deposit.toLocaleString("vi-VN")} đ</strong></div>}
            {room.floor != null && <div><span className="label">Tầng</span><strong>{room.floor}</strong></div>}
          </div>

          {description && (
            <div className="room-detail-desc">
              <h2>Mô tả</h2>
              <p style={{ whiteSpace: "pre-line" }}>{description}</p>
            </div>
          )}

          {room.amenities && room.amenities.length > 0 && (
            <div className="room-detail-desc">
              <h2>Tiện ích</h2>
              <ul style={{ paddingLeft: 20 }}>
                {room.amenities.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <div className="room-detail-cta">
            <div>
              <div className="public-sub" style={{ marginBottom: 0 }}>Quan tâm phòng này?</div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                Form liên hệ / hẹn xem phòng sẽ có ở Giai đoạn 3.
              </div>
            </div>
            <button className="btn btn-primary" disabled style={{ opacity: 0.6, cursor: "not-allowed" }}>
              Liên hệ (sắp có)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

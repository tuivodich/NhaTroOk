import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { RoomDoc } from "../../lib/types";

type Room = RoomDoc & { id: string };

export default function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "rooms"), where("published", "==", true));
    return onSnapshot(
      q,
      (snap) => {
        setRooms(snap.docs.map((d) => ({ ...(d.data() as RoomDoc), id: d.id })));
        setLoading(false);
      },
      (e) => { console.error(e); setErr(e.message); setLoading(false); }
    );
  }, []);

  return (
    <div className="public-shell">
      <header className="public-header">
        <Link to="/" className="public-brand">Nhà trọ</Link>
        <Link to="/dang-nhap" className="public-login">Đăng nhập</Link>
      </header>
      <main className="public-container">
        <h1 className="public-h1">Phòng cho thuê</h1>
        <p className="public-sub">Danh sách phòng đang sẵn sàng cho thuê</p>

        {loading && <div className="public-loading">Đang tải...</div>}
        {err && <div className="public-error">{err}</div>}
        {!loading && !err && rooms.length === 0 && (
          <div className="public-empty">Chưa có phòng nào được đăng công khai.</div>
        )}

        {rooms.length > 0 && (
          <div className="room-grid">
            {rooms.map((room) => (
              <Link key={room.id} to={`/phong/${room.id}`} className="room-card">
                {room.photos && room.photos[0] ? (
                  <img src={room.photos[0]} alt={room.code} className="room-card-img" />
                ) : (
                  <div className="room-card-img room-card-img-empty">Chưa có ảnh</div>
                )}
                <div className="room-card-body">
                  <div className="room-card-title">Phòng {room.code}</div>
                  {room.desc && (
                    <div className="room-card-addr">
                      {room.desc.length > 60 ? room.desc.slice(0, 60) + "…" : room.desc}
                    </div>
                  )}
                  <div className="room-card-meta">
                    {room.area != null && <span>{room.area} m²</span>}
                    <span className="room-card-price">
                      {room.baseRent.toLocaleString("vi-VN")} đ/tháng
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

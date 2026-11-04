import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { RoomDoc } from "../lib/types";

type Room = RoomDoc & { id: string };

export default function FeaturedRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    // Query featured, filter published ở client để tránh cần composite index
    const q = query(collection(db, "rooms"), where("featured", "==", true), limit(20));
    return onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as RoomDoc), id: d.id }))
        .filter((r) => r.published === true)
        .slice(0, 6);
      setRooms(list);
    });
  }, []);

  if (rooms.length === 0) return null;

  return (
    <section style={{ padding: "48px 16px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Phòng nổi bật</h2>
        <Link to="/phong" style={{ color: "var(--brand)", fontSize: 14, textDecoration: "none" }}>
          Xem tất cả →
        </Link>
      </div>
      <div className="room-grid">
        {rooms.map((room) => (
          <Link key={room.id} to={`/phong/${room.id}`} className="room-card">
            {room.photos?.[0] ? (
              <img src={room.photos[0]} alt={room.code} className="room-card-img" />
            ) : (
              <div className="room-card-img room-card-img-empty">Chưa có ảnh</div>
            )}
            <div className="room-card-body">
              <div className="room-card-title">Phòng {room.code}</div>
              {room.desc && (
                <div className="room-card-addr">
                  {room.desc.length > 50 ? room.desc.slice(0, 50) + "…" : room.desc}
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
    </section>
  );
}

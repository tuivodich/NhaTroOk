import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { PropertyDoc, RoomDoc } from "../../lib/types";
import InquiryForm from "../../components/InquiryForm";

const vnd = (n: number | null | undefined) =>
  (n || 0).toLocaleString("vi-VN") + " đ";

export default function RoomDetail() {
  const { id } = useParams();
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [property, setProperty] = useState<PropertyDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "rooms", id));
        if (!alive) return;
        if (!snap.exists()) { setErr("Không tìm thấy phòng."); setLoading(false); return; }
        const r = { id: snap.id, ...snap.data() } as RoomDoc;
        setRoom(r);
        if (r.propertyId) {
          const ps = await getDoc(doc(db, "properties", r.propertyId));
          if (alive && ps.exists()) setProperty({ id: ps.id, ...ps.data() } as PropertyDoc);
        }
      } catch (e: any) {
        if (alive) setErr(e?.message || "Lỗi tải dữ liệu.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) return <div className="container" style={{ padding: 24 }}>Đang tải…</div>;
  if (err) return (
    <div className="container" style={{ padding: 24 }}>
      <p>{err}</p>
      <Link to="/phong">← Về danh sách phòng</Link>
    </div>
  );
  if (!room) return null;

  const photos = Array.isArray(room.photos) ? room.photos.filter(Boolean) : [];
  const amenitiesArr = Array.isArray(room.amenities) ? room.amenities : null;
  const amenitiesStr = typeof room.amenities === "string" ? room.amenities : null;

  return (
    <div className="container" style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <Link to="/phong">← Danh sách phòng</Link>

      <h1 style={{ marginTop: 12 }}>
        {room.code}{property ? ` — ${property.name}` : ""}
      </h1>
      {property?.address && <p style={{ marginTop: -8, opacity: 0.75 }}>{property.address}</p>}

      {photos.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 8, margin: "16px 0",
        }}>
          {photos.map((p, i) => (
            <img key={i} src={p} alt={`${room.code} ${i + 1}`}
              style={{ width: "100%", height: 170, objectFit: "cover", borderRadius: 8 }} />
          ))}
        </div>
      )}

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))",
        gap: 12, margin: "16px 0", padding: 16, background: "#f7f7f7", borderRadius: 8,
      }}>
        <div><strong>Giá thuê:</strong> {vnd(room.baseRent)}/tháng</div>
        {room.deposit != null && <div><strong>Đặt cọc:</strong> {vnd(room.deposit)}</div>}
        <div><strong>Diện tích:</strong> {room.area ?? "—"} m²</div>
        <div><strong>Tầng:</strong> {room.floor ?? "—"}</div>
        <div><strong>Trạng thái:</strong> {room.status === "vacant" ? "Còn trống" : room.status === "occupied" ? "Đã thuê" : "Bảo trì"}</div>
      </div>

      {room.desc && (<><h3>Mô tả</h3><p style={{ whiteSpace: "pre-wrap" }}>{room.desc}</p></>)}
      {!room.desc && room.descEn && (<><h3>Description</h3><p style={{ whiteSpace: "pre-wrap" }}>{room.descEn}</p></>)}

      {amenitiesArr && amenitiesArr.length > 0 && (
        <>
          <h3>Tiện ích</h3>
          <ul>{amenitiesArr.map((a: any, i: number) => <li key={i}>{String(a)}</li>)}</ul>
        </>
      )}
      {amenitiesStr && (<><h3>Tiện ích</h3><p>{amenitiesStr}</p></>)}

      <hr style={{ margin: "28px 0" }} />

      {room.status === "vacant" ? (
        <InquiryForm room={room} />
      ) : (
        <div style={{ padding: 16, background: "#fff3e0", borderRadius: 8 }}>
          Phòng hiện không còn trống. Vui lòng xem phòng khác hoặc liên hệ để được tư vấn.
        </div>
      )}
    </div>
  );
}

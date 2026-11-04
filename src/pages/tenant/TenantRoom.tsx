import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { ContractDoc, PropertyDoc, RoomDoc } from "../../lib/types";
import MoneyText from "../../components/MoneyText";
import { IcCal, IcDoor } from "../../components/Icons";

const fmtDate = (d?: string) => (d ? d.split("-").reverse().join("/") : "—");

export default function TenantRoom({ contracts }: { contracts: ContractDoc[] }) {
  const active = contracts.find((c) => c.status === "active") ?? contracts.find((c) => c.status === "draft");
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [prop, setProp] = useState<PropertyDoc | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!active) { setRoom(null); setProp(null); return; }
      try {
        const rs = await getDoc(doc(db, "rooms", active.roomId));
        if (!alive || !rs.exists()) return;
        const r = { id: rs.id, ...(rs.data() as object) } as RoomDoc;
        setRoom(r);
        const ps = await getDoc(doc(db, "properties", r.propertyId));
        if (alive && ps.exists()) setProp({ id: ps.id, ...(ps.data() as object) } as PropertyDoc);
      } catch (e) { console.error("tenant room load failed", e); }
    })();
    return () => { alive = false; };
  }, [active?.roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return <div className="ct-empty"><strong>Bạn chưa có hợp đồng thuê phòng.</strong><span>Liên hệ chủ trọ nếu bạn nghĩ đây là nhầm lẫn.</span></div>;

  const left = active.endDate ? Math.round((new Date(active.endDate + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
  const photo = room?.photos?.[0];

  return (
    <div className="tp-stack">
      <article className="ct-card rm-card" style={{ borderLeft: "1px solid var(--border)" }}>
        {photo ? <img className="rm-img" src={photo} alt={`Ảnh phòng ${room?.code ?? ""}`} /> : <div className="rm-img rm-img-empty" aria-hidden="true"><IcDoor /><span>Chưa có ảnh</span></div>}
        <div className="rm-body">
          <header className="ct-card-head">
            <div>
              <div className="ct-code" style={{ fontSize: 20 }}>Phòng {room?.code ?? "…"}</div>
              {prop && <div className="ct-sub">{prop.name}{prop.address ? " · " + prop.address : ""}</div>}
            </div>
            <span className={"tag " + active.status}>{active.status === "active" ? "Đang thuê" : "Hợp đồng nháp"}</span>
          </header>
          <div className="rm-facts ct-sub">
            {room?.area ? <span>{room.area} m²</span> : null}
            {room?.floor != null ? <span>Tầng {room.floor}</span> : null}
          </div>
          {(room?.amenities ?? []).length > 0 && <ul className="rm-amen" aria-label="Tiện ích">{room!.amenities!.map((a) => <li key={a}>{a}</li>)}</ul>}
        </div>
      </article>

      <div className="ct-stats">
        <div className="ct-stat"><span className="ct-stat-n ct-num"><MoneyText value={active.rent} /></span><span className="ct-stat-l">Tiền thuê / tháng</span></div>
        <div className="ct-stat"><span className="ct-stat-n ct-num"><MoneyText value={active.deposit ?? 0} /></span><span className="ct-stat-l">Tiền cọc</span></div>
        <div className="ct-stat"><span className="ct-stat-n ct-num">{fmtDate(active.endDate)}</span><span className="ct-stat-l"><IcCal /> Hợp đồng đến ngày</span></div>
      </div>

      {active.status === "active" && left !== null && left <= 30 && (
        <p className={"ct-alert " + (left < 0 ? "bad" : "warn")} role="note">
          {left < 0 ? `Hợp đồng đã quá hạn ${-left} ngày. Hãy liên hệ chủ trọ để gia hạn.` : `Hợp đồng còn ${left} ngày. Liên hệ chủ trọ nếu bạn muốn gia hạn.`}
        </p>
      )}
    </div>
  );
}

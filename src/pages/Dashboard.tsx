import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCollection } from "../lib/useCollection";
import type { ContractDoc, InquiryDoc, PropertyDoc, RoomDoc, TenantDoc } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { useBrand } from "../brand/BrandProvider";
import MoneyText from "../components/MoneyText";
import { IcArrow, IcBuilding, IcDoor, IcFile, IcInbox, IcPlus, IcWarn } from "../components/Icons";

const EXPIRING_DAYS = 30;

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr + "T00:00:00");
  if (isNaN(end.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}
const fmtDate = (s?: string) => (s ? s.split("-").reverse().join("/") : "—");

export default function Dashboard() {
  const { t } = useI18n();
  const brand = useBrand();
  const { data: properties, loading: lp } = useCollection<PropertyDoc>("properties");
  const { data: rooms, loading: lr } = useCollection<RoomDoc>("rooms");
  const { data: contracts } = useCollection<ContractDoc>("contracts");
  const { data: inquiries } = useCollection<InquiryDoc>("inquiries");
  const { data: tenants } = useCollection<TenantDoc>("tenants");

  const roomCode = (id: string) => rooms.find((r) => r.id === id)?.code ?? id;
  const tenantName = (id: string) => tenants.find((x) => x.id === id)?.name ?? id;

  const s = useMemo(() => {
    const occupied = rooms.filter((r) => r.status === "occupied").length;
    const active = contracts.filter((c) => c.status === "active");
    const expiring = active
      .map((c) => ({ c, d: daysUntil(c.endDate) }))
      .filter((x): x is { c: ContractDoc; d: number } => x.d !== null && x.d <= EXPIRING_DAYS)
      .sort((a, b) => a.d - b.d);
    const newInq = inquiries
      .filter((i) => i.status === "new")
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    return {
      occupied,
      vacant: rooms.filter((r) => r.status === "vacant").length,
      maintenance: rooms.filter((r) => r.status === "maintenance").length,
      rate: rooms.length ? Math.round((occupied / rooms.length) * 100) : 0,
      active: active.length,
      drafts: contracts.filter((c) => c.status === "draft").length,
      monthly: active.reduce((sum, c) => sum + (Number(c.rent) || 0), 0),
      expiring,
      newInq,
    };
  }, [rooms, contracts, inquiries]);

  const todo = s.newInq.length + s.drafts + s.expiring.length;

  return (
    <section className="ct dash">
      <div className="ct-head">
        <div>
          <h2>{t("dashboard")}</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>{brand.tagline || brand.name}</p>
        </div>
        <div className="ct-actions" style={{ margin: 0, padding: 0 }}>
          <Link className="ct-btn" to="/app/rooms"><IcPlus />&nbsp;{t("addRoom")}</Link>
          <Link className="linkbtn" style={{ color: "var(--brand)", border: "1px solid var(--border)", background: "#fff" }} to="/app/properties">{t("addProperty")}</Link>
        </div>
      </div>

      <div className="ct-stats">
        <div className="ct-stat"><span className="ct-stat-n">{lp ? "…" : properties.length}</span><span className="ct-stat-l">{t("totalProperties")}</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{lr ? "…" : rooms.length}</span><span className="ct-stat-l">{t("totalRooms")}</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{s.vacant}</span><span className="ct-stat-l">{t("vacantRooms")}</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{s.active}</span><span className="ct-stat-l">Hợp đồng hiệu lực</span></div>
        <div className="ct-stat"><span className="ct-stat-n ct-num"><MoneyText value={s.monthly} /></span><span className="ct-stat-l">Doanh thu thuê / tháng</span></div>
      </div>

      <div className="dash-grid">
        <div className="card dash-panel">
          <h3>Tỷ lệ lấp phòng</h3>
          <div className="dash-rate">
            <span className="dash-rate-n ct-num">{s.rate}%</span>
            <span className="ct-sub">{s.occupied}/{rooms.length} phòng đang thuê</span>
          </div>
          <div className="dash-bar" role="progressbar" aria-valuenow={s.rate} aria-valuemin={0} aria-valuemax={100} aria-label="Tỷ lệ lấp phòng">
            <div style={{ width: s.rate + "%" }} />
          </div>
          <ul className="dash-legend">
            <li><span className="dot occ" />{t("occupiedRooms")}: <b>{s.occupied}</b></li>
            <li><span className="dot vac" />{t("vacantRooms")}: <b>{s.vacant}</b></li>
            {s.maintenance > 0 && <li><span className="dot mnt" />Bảo trì: <b>{s.maintenance}</b></li>}
          </ul>
        </div>

        <div className="card dash-panel">
          <h3>Cần xử lý {todo > 0 && <span className="ct-chip-n" style={{ marginLeft: 6 }}>{todo}</span>}</h3>
          {todo === 0 ? (
            <p className="info" style={{ margin: 0 }}>Không có việc tồn đọng.</p>
          ) : (
            <ul className="dash-todo">
              {s.newInq.length > 0 && (
                <li><Link to="/app/inquiries"><IcInbox /><span><b>{s.newInq.length}</b> yêu cầu thuê mới</span><IcArrow /></Link></li>
              )}
              {s.drafts > 0 && (
                <li><Link to="/app/contracts"><IcFile /><span><b>{s.drafts}</b> hợp đồng nháp chờ kích hoạt</span><IcArrow /></Link></li>
              )}
              {s.expiring.length > 0 && (
                <li><Link to="/app/contracts"><IcWarn /><span><b>{s.expiring.length}</b> hợp đồng sắp/đã hết hạn</span><IcArrow /></Link></li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="card dash-panel">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Hợp đồng sắp hết hạn (≤{EXPIRING_DAYS} ngày)</h3>
          <Link to="/app/contracts" className="ct-sub">Xem tất cả</Link>
        </div>
        {s.expiring.length === 0 ? (
          <p className="info" style={{ margin: 0 }}>Không có hợp đồng nào sắp hết hạn.</p>
        ) : (
          <ul className="dash-list">
            {s.expiring.slice(0, 6).map(({ c, d }) => (
              <li key={c.id}>
                <Link to={`/app/contracts/${c.id}/edit`}>
                  <span className="dash-li-main"><IcDoor /> Phòng {roomCode(c.roomId)} · {tenantName(c.tenantId)}</span>
                  <span className="ct-sub ct-num">đến {fmtDate(c.endDate)}</span>
                  <span className={"tag " + (d < 0 ? "iqs-rejected" : "iqs-scheduled")}>{d < 0 ? `Quá hạn ${-d} ngày` : d === 0 ? "Hôm nay" : `Còn ${d} ngày`}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {s.newInq.length > 0 && (
        <div className="card dash-panel">
          <div className="row between" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Yêu cầu thuê mới</h3>
            <Link to="/app/inquiries" className="ct-sub">Xem tất cả</Link>
          </div>
          <ul className="dash-list">
            {s.newInq.slice(0, 5).map((i) => (
              <li key={i.id}>
                <Link to="/app/inquiries">
                  <span className="dash-li-main"><IcBuilding /> {i.name} · Phòng {i.roomCode ?? i.roomId ?? "—"}</span>
                  <span className="ct-sub ct-num">{i.phone}</span>
                  <span className="tag iqs-new">Mới</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

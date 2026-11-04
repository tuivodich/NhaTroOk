import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCollection } from "../lib/useCollection";
import type { InvoiceDoc, PropertyDoc, ReminderLog, RoomDoc, TenantDoc } from "../lib/types";
import { aging, effectiveStatus, monthlySeries, occupancy, toCsv, yearsOf } from "../lib/reports";
import MoneyText from "../components/MoneyText";
import RevenueChart from "../components/RevenueChart";
import ReminderPanel from "../components/ReminderPanel";
import { CHANNEL_LABEL, lastReminderByRoom } from "../lib/reminder";

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDate = (d?: string) => (d ? d.split("-").reverse().join("/") : "");
const STATUS_VI = { paid: "Đã trả", unpaid: "Chưa trả", overdue: "Quá hạn" } as const;

export default function Reports() {
  const { data: invoices, loading } = useCollection<InvoiceDoc>("invoices");
  const { data: rooms } = useCollection<RoomDoc>("rooms");
  const { data: properties } = useCollection<PropertyDoc>("properties");
  const { data: tenants } = useCollection<TenantDoc>("tenants");
  const { data: reminderLogs } = useCollection<ReminderLog>("reminderLogs");
  const [remindRoom, setRemindRoom] = useState<string | null>(null);
  const today = localToday();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);

  const years = useMemo(() => yearsOf(invoices, thisYear), [invoices, thisYear]);
  const series = useMemo(() => monthlySeries(invoices, year), [invoices, year]);
  const debt = useMemo(() => aging(invoices, today), [invoices, today]);
  const lastRemind = useMemo(() => lastReminderByRoom(reminderLogs), [reminderLogs]);
  const occ = useMemo(() => occupancy(rooms, properties), [rooms, properties]);

  const billed = series.reduce((s, r) => s + r.billed, 0);
  const collected = series.reduce((s, r) => s + r.collected, 0);
  const outstanding = billed - collected;
  const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;
  const roomCode = (id: string) => rooms.find((r) => r.id === id)?.code ?? id;
  const tenantName = (id?: string) => (id ? tenants.find((t) => t.id === id)?.name ?? "" : "");

  const exportCsv = () => {
    const rowsY = invoices.filter((i) => (i.month || "").startsWith(year + "-")).sort((a, b) => a.month.localeCompare(b.month) || roomCode(a.roomId).localeCompare(roomCode(b.roomId), "vi", { numeric: true }));
    const csv = toCsv(
      ["Kỳ", "Phòng", "Khách thuê", "Tổng tiền (đ)", "Trạng thái", "Hạn thanh toán", "Ngày trả"],
      rowsY.map((i) => [i.month, roomCode(i.roomId), tenantName(i.tenantId), Number(i.total) || 0, STATUS_VI[effectiveStatus(i, today)], i.dueDate ?? "", i.paidAt ? new Date(i.paidAt).toLocaleDateString("vi-VN") : ""]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `hoa-don-${year}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="ct rp">
      <div className="ct-head">
        <div>
          <h2>Báo cáo</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Doanh thu, công nợ và tỷ lệ lấp phòng.</p>
        </div>
        <div className="ct-actions" style={{ margin: 0, padding: 0, alignItems: "end" }}>
          <label className="bl-month" style={{ minWidth: 120 }}>Năm
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button className="ghost" onClick={exportCsv} disabled={invoices.length === 0}>Xuất CSV</button>
        </div>
      </div>

      <div className="ct-stats">
        <div className="ct-stat"><span className="ct-stat-n ct-num"><MoneyText value={billed} /></span><span className="ct-stat-l">Đã lập năm {year}</span></div>
        <div className="ct-stat"><span className="ct-stat-n ct-num"><MoneyText value={collected} /></span><span className="ct-stat-l">Đã thu</span></div>
        <div className={"ct-stat" + (outstanding > 0 ? " warn" : "")}><span className="ct-stat-n ct-num"><MoneyText value={outstanding} /></span><span className="ct-stat-l">Còn nợ</span></div>
        <div className="ct-stat"><span className="ct-stat-n ct-num">{rate}%</span><span className="ct-stat-l">Tỷ lệ thu</span></div>
      </div>

      <div className="card rp-card">
        <h3>Doanh thu theo tháng, {year}</h3>
        {loading ? <div className="ct-card ct-skel" /> : billed === 0 ? (
          <div className="ct-empty"><strong>Chưa có hóa đơn năm {year}.</strong><span>Lập hóa đơn tháng để thấy biểu đồ.</span><Link className="linkbtn primary" to="/app/billing">Lập hóa đơn</Link></div>
        ) : <RevenueChart rows={series} />}
      </div>

      <div className="card rp-card">
        <div className="row between wrap"><h3>Công nợ hiện tại</h3><Link to="/app/invoices" className="ct-sub">Xem hóa đơn</Link></div>
        <p className="info" style={{ margin: "0 0 10px" }}>Tổng còn phải thu: <b className="ct-num"><MoneyText value={debt.total} /></b>, tính trên mọi hóa đơn chưa trả, không phân biệt năm.</p>
        <div className="rp-aging">
          {debt.buckets.map((b) => (
            <div key={b.key} className={"ct-stat" + (b.key !== "current" && b.total > 0 ? " warn" : "")}>
              <span className="ct-stat-n ct-num" style={{ fontSize: 18 }}><MoneyText value={b.total} /></span>
              <span className="ct-stat-l">{b.label}{b.count ? ` · ${b.count} hóa đơn` : ""}</span>
            </div>
          ))}
        </div>
        {debt.rows.length > 0 && (
          <ul className="dash-list" style={{ marginTop: 12 }}>
            {debt.rows.slice(0, 10).map((r) => {
              const tenant = tenants.find((t) => t.id === r.tenantId);
              const last = lastRemind.get(r.roomId);
              const open = remindRoom === r.roomId;
              const items = invoices.filter((i) => i.roomId === r.roomId && i.status !== "paid").map((i) => ({ invoiceId: i.id, month: i.month, total: i.total, dueDate: i.dueDate }));
              return (
                <li key={r.roomId} className="rp-debt">
                  <div className="rp-debt-row">
                    <Link to="/app/invoices" className="rp-debt-main">
                      <span className="dash-li-main">Phòng {roomCode(r.roomId)}{tenantName(r.tenantId) ? ` · ${tenantName(r.tenantId)}` : ""}</span>
                      <span className="ct-sub">{r.count} hóa đơn{r.oldestDays > 0 ? ` · trễ ${r.oldestDays} ngày` : ""}{last ? ` · đã nhắc ${new Date(last.seconds * 1000).toLocaleDateString("vi-VN")} (${CHANNEL_LABEL[last.channel] ?? last.channel})` : ""}</span>
                      <b className="ct-num"><MoneyText value={r.total} /></b>
                    </Link>
                    <button className={open ? "ghost" : ""} aria-expanded={open} onClick={() => setRemindRoom(open ? null : r.roomId)}>{open ? "Đóng" : "Nhắc nợ"}</button>
                  </div>
                  {open && <ReminderPanel tenantName={tenant?.name} tenantId={r.tenantId} phone={tenant?.phone} email={tenant?.email} roomId={r.roomId} roomCode={roomCode(r.roomId)} items={items} onClose={() => setRemindRoom(null)} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card rp-card">
        <h3>Tỷ lệ lấp phòng</h3>
        {occ.all.total === 0 ? <p className="info" style={{ margin: 0 }}>Chưa có phòng nào.</p> : (
          <div className="rp-occ">
            {[occ.all, ...occ.rows.filter((r) => r.total > 0)].map((r, i) => (
              <div key={r.propertyId || "all"} className={i === 0 ? "rp-occ-all" : ""}>
                <div className="row between wrap"><b>{r.name}</b><span className="ct-sub ct-num">{r.occupied}/{r.total} phòng · trống {r.vacant}{r.maintenance ? ` · bảo trì ${r.maintenance}` : ""}</span></div>
                <div className="dash-bar" role="progressbar" aria-valuenow={r.rate} aria-valuemin={0} aria-valuemax={100} aria-label={`Lấp đầy ${r.name}`}><div style={{ width: r.rate + "%" }} /></div>
                <span className="ct-sub ct-num">{r.rate}%</span>
              </div>
            ))}
          </div>
        )}
        <p className="ct-sub" style={{ margin: "10px 0 0" }}>Số liệu tại thời điểm hiện tại. Hệ thống chưa lưu lịch sử lấp phòng theo tháng.</p>
      </div>
    </section>
  );
}

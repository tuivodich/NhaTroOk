import type { ContractDoc } from "../../lib/types";
import MoneyText from "../../components/MoneyText";

const fmtDate = (d?: string) => (d ? d.split("-").reverse().join("/") : "—");
const LABEL: Record<string, string> = { draft: "Nháp", active: "Hiệu lực", expired: "Hết hạn", cancelled: "Đã hủy" };
const CYCLE: Record<string, string> = { monthly: "Hàng tháng", quarterly: "Hàng quý", yearly: "Hàng năm" };

export default function TenantContracts({ contracts, loading }: { contracts: ContractDoc[]; loading: boolean }) {
  if (loading) return <div className="ct-list" aria-busy="true"><div className="ct-card ct-skel" /></div>;
  if (contracts.length === 0) return <div className="ct-empty"><strong>Chưa có hợp đồng.</strong></div>;
  const sorted = [...contracts].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
  return (
    <div className="tp-stack">
      {sorted.map((c) => (
        <article className="ct-card" key={c.id} style={{ borderLeftColor: c.status === "active" ? "#059669" : "var(--border)" }}>
          <header className="ct-card-head">
            <div className="ct-code">{c.code ?? "Hợp đồng"}</div>
            <span className={"tag " + c.status}>{LABEL[c.status] ?? c.status}</span>
          </header>
          <dl className="ct-meta">
            <div><dt>Thời hạn</dt><dd>{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</dd></div>
            <div><dt>Tiền thuê</dt><dd><MoneyText value={c.rent} /> / tháng</dd></div>
            <div><dt>Tiền cọc</dt><dd><MoneyText value={c.deposit ?? 0} /></dd></div>
            {c.paymentCycle && <div><dt>Thanh toán</dt><dd>{CYCLE[c.paymentCycle]}{c.dueDay ? `, hạn ngày ${c.dueDay}` : ""}</dd></div>}
          </dl>
          {c.notes && <p className="ct-notes">{c.notes}</p>}
        </article>
      ))}
    </div>
  );
}

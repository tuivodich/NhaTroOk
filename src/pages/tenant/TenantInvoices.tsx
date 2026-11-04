import { useMemo, useState } from "react";
import type { InvoiceDoc, InvoiceStatus } from "../../lib/types";
import MoneyText from "../../components/MoneyText";

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtMonth = (m: string) => (m ? m.split("-").reverse().join("/") : "");
const fmtDate = (d?: string) => (d ? d.split("-").reverse().join("/") : "");
const LABEL: Record<InvoiceStatus, string> = { unpaid: "Chưa trả", overdue: "Quá hạn", paid: "Đã trả" };

export default function TenantInvoices({ invoices, loading }: { invoices: InvoiceDoc[]; loading: boolean }) {
  const eff = (x: InvoiceDoc): InvoiceStatus => (x.status === "unpaid" && x.dueDate && x.dueDate < todayStr() ? "overdue" : x.status);
  const sorted = useMemo(() => [...invoices].sort((a, b) => (b.month || "").localeCompare(a.month || "")), [invoices]);
  const owed = sorted.filter((x) => eff(x) !== "paid").reduce((s, x) => s + (Number(x.total) || 0), 0);
  const [open, setOpen] = useState<string | null>(null);

  if (loading) return <div className="ct-list" aria-busy="true"><div className="ct-card ct-skel" /></div>;
  if (sorted.length === 0) return <div className="ct-empty"><strong>Chưa có hóa đơn nào.</strong><span>Hóa đơn hàng tháng sẽ xuất hiện ở đây.</span></div>;

  return (
    <div className="tp-stack">
      <div className={"ct-stat" + (owed > 0 ? " warn" : "")}>
        <span className="ct-stat-n ct-num"><MoneyText value={owed} /></span>
        <span className="ct-stat-l">{owed > 0 ? "Còn phải thanh toán" : "Bạn không còn khoản nợ nào"}</span>
      </div>
      {sorted.map((x) => {
        const st = eff(x);
        const isOpen = open === x.id;
        return (
          <article className={"ct-card" + (st === "overdue" ? " bad" : st === "unpaid" ? " warn" : "")} key={x.id}>
            <header className="ct-card-head">
              <div className="ct-code">Kỳ {fmtMonth(x.month)}</div>
              <span className={"tag " + st}>{LABEL[st]}</span>
            </header>
            <div className="bl-total"><span className="ct-sub">{x.dueDate ? `Hạn thanh toán ${fmtDate(x.dueDate)}` : "Tổng tiền"}</span><b className="ct-num"><MoneyText value={x.total} /></b></div>
            {(x.items?.length ?? 0) > 0 && (
              <>
                <button className="ghost" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : x.id)}>{isOpen ? "Ẩn chi tiết" : "Xem chi tiết"}</button>
                {isOpen && (
                  <ul className="bl-items">
                    {x.items!.map((it, i) => <li key={i}><span>{it.label}</span><span className="ct-num"><MoneyText value={it.amount} /></span></li>)}
                  </ul>
                )}
              </>
            )}
            {x.notes && <p className="ct-notes">{x.notes}</p>}
          </article>
        );
      })}
    </div>
  );
}

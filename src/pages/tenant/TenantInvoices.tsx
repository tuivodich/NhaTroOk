import { useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useMyDocs } from "../../lib/useMyDocs";
import { usePaymentInfo } from "../../lib/usePaymentInfo";
import type { InvoiceDoc, InvoiceStatus, PaymentReport } from "../../lib/types";
import MoneyText from "../../components/MoneyText";

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtMonth = (m: string) => (m ? m.split("-").reverse().join("/") : "");
const fmtDate = (d?: string) => (d ? d.split("-").reverse().join("/") : "");
const LABEL: Record<InvoiceStatus, string> = { unpaid: "Chưa trả", overdue: "Quá hạn", paid: "Đã trả" };

interface Props { invoices: InvoiceDoc[]; loading: boolean; uid: string; tenantId?: string; }

export default function TenantInvoices({ invoices, loading, uid, tenantId }: Props) {
  const { data: reports } = useMyDocs<PaymentReport>("paymentReports", uid);
  const { text: payText } = usePaymentInfo();
  const eff = (x: InvoiceDoc): InvoiceStatus => (x.status === "unpaid" && x.dueDate && x.dueDate < todayStr() ? "overdue" : x.status);
  const sorted = useMemo(() => [...invoices].sort((a, b) => (b.month || "").localeCompare(a.month || "")), [invoices]);
  const owed = sorted.filter((x) => eff(x) !== "paid").reduce((s, x) => s + (Number(x.total) || 0), 0);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<string | null>(null);   // invoice.id đang mở form báo chuyển khoản
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reportOf = (inv: InvoiceDoc) => reports.find((r) => r.invoiceId === inv.id);

  const send = async (inv: InvoiceDoc, resubmit: boolean) => {
    setErr("");
    if (!window.confirm(`Xác nhận bạn đã chuyển khoản ${new Intl.NumberFormat("vi-VN").format(inv.total)} đ cho kỳ ${fmtMonth(inv.month)}?\n\nChủ trọ sẽ kiểm tra và xác nhận.`)) return;
    setBusy(true);
    try {
      const ref = doc(db, "paymentReports", "pr_" + inv.id);
      const n = note.trim();
      if (resubmit) await updateDoc(ref, { status: "pending", ...(n ? { note: n } : {}), updatedAt: serverTimestamp() });
      else await setDoc(ref, {
        invoiceId: inv.id, userId: uid, ...(tenantId ? { tenantId } : {}), ...(inv.roomId ? { roomId: inv.roomId } : {}),
        amount: inv.total, ...(n ? { note: n } : {}), status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setForm(null); setNote("");
    } catch (ex) { setErr("Không gửi được: " + ((ex as Error)?.message ?? String(ex))); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="ct-list" aria-busy="true"><div className="ct-card ct-skel" /></div>;
  if (sorted.length === 0) return <div className="ct-empty"><strong>Chưa có hóa đơn nào.</strong><span>Hóa đơn hàng tháng sẽ xuất hiện ở đây.</span></div>;

  return (
    <div className="tp-stack">
      <div className={"ct-stat" + (owed > 0 ? " warn" : "")}>
        <span className="ct-stat-n ct-num"><MoneyText value={owed} /></span>
        <span className="ct-stat-l">{owed > 0 ? "Còn phải thanh toán" : "Bạn không còn khoản nợ nào"}</span>
      </div>

      {payText && owed > 0 && (
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Thông tin chuyển khoản</h3>
          <p className="tp-pay">{payText}</p>
        </div>
      )}
      {err && <p className="error" role="alert">{err}</p>}

      {sorted.map((x) => {
        const st = eff(x);
        const isOpen = open === x.id;
        const rep = reportOf(x);
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
                {isOpen && <ul className="bl-items">{x.items!.map((it, i) => <li key={i}><span>{it.label}</span><span className="ct-num"><MoneyText value={it.amount} /></span></li>)}</ul>}
              </>
            )}

            {st !== "paid" && (
              rep?.status === "pending" ? (
                <p className="ct-alert warn" role="status" style={{ margin: 0 }}>Bạn đã báo chuyển khoản. Đang chờ chủ trọ xác nhận.</p>
              ) : form === x.id ? (
                <div className="tp-stack" style={{ gap: 8 }}>
                  {rep?.status === "rejected" && rep.staffNote && <p className="ct-alert bad" role="note" style={{ margin: 0 }}>Chủ trọ chưa nhận được: {rep.staffNote}</p>}
                  <label className="iq-field">Mã giao dịch / ghi chú (tuỳ chọn)
                    <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: mã giao dịch 123456, chuyển lúc 9h" />
                  </label>
                  <div className="ct-actions">
                    <button onClick={() => send(x, rep?.status === "rejected")} disabled={busy}>{busy ? "Đang gửi…" : "Gửi báo cáo"}</button>
                    <button className="ghost" onClick={() => { setForm(null); setNote(""); }}>Hủy</button>
                  </div>
                </div>
              ) : (
                <>
                  {rep?.status === "rejected" && <p className="ct-alert bad" role="note" style={{ margin: 0 }}>Chủ trọ chưa nhận được khoản này{rep.staffNote ? `: ${rep.staffNote}` : ""}.</p>}
                  <button onClick={() => { setForm(x.id); setNote(""); setErr(""); }}>{rep?.status === "rejected" ? "Gửi lại báo cáo" : "Tôi đã chuyển khoản"}</button>
                </>
              )
            )}
            {x.notes && <p className="ct-notes">{x.notes}</p>}
          </article>
        );
      })}
    </div>
  );
}

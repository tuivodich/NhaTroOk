import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useAudit } from "../lib/audit";
import { isAdminRole, type FixedFee } from "../lib/types";
import { useBillingSettings } from "../lib/useBillingSettings";
import { usePaymentInfo } from "../lib/usePaymentInfo";
import NumInput from "../components/NumInput";
import { IcPlus } from "../components/Icons";

export default function SettingsBilling() {
  const { profile } = useAuth();
  const audit = useAudit();
  const { settings, configured, loading } = useBillingSettings();
  const [electric, setElectric] = useState<number | "">("");
  const [water, setWater] = useState<number | "">("");
  const [fees, setFees] = useState<FixedFee[]>([]);
  const { text: payText, loading: payLoading } = usePaymentInfo();
  const [payInfo, setPayInfo] = useState("");
  const [payInit, setPayInit] = useState(false);
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [init, setInit] = useState(false);

  // Nạp giá trị đã lưu đúng một lần, tránh ghi đè khi đang gõ
  useEffect(() => {
    if (loading || init) return;
    setElectric(settings.electricRate); setWater(settings.waterRate); setFees(settings.fixedFees);
    setInit(true);
  }, [loading, init, settings]);

  useEffect(() => { if (!payLoading && !payInit) { setPayInfo(payText); setPayInit(true); } }, [payLoading, payInit, payText]);

  if (!isAdminRole(profile?.role)) {
    return <section className="ct"><div className="ct-empty"><strong>Chỉ admin mới được chỉnh đơn giá.</strong></div></section>;
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(""); setBad(false);
    if (electric === "" || water === "" || +electric < 0 || +water < 0) { setBad(true); setMsg("Đơn giá điện và nước phải là số không âm."); return; }
    const clean = fees.filter((f) => f.label.trim() && Number(f.amount) > 0).map((f) => ({ label: f.label.trim(), amount: Math.round(+f.amount) }));
    setBusy(true);
    try {
      await setDoc(doc(db, "settings", "billing"), {
        electricRate: +electric, waterRate: +water, fixedFees: clean, updatedAt: serverTimestamp(), updatedBy: profile?.uid ?? "",
      });
      await setDoc(doc(db, "settings", "payment"), { text: payInfo.trim(), updatedAt: serverTimestamp(), updatedBy: profile?.uid ?? "" });
      setFees(clean);
      audit("billing.settings", "Cap nhat don gia dien nuoc", { type: "settings", id: "billing" });
      setMsg("Đã lưu đơn giá. Áp dụng cho các hóa đơn lập từ bây giờ.");
    } catch (ex) {
      console.error("save billing settings failed", ex);
      setBad(true); setMsg("Lỗi: " + ((ex as Error)?.message ?? String(ex)));
    } finally { setBusy(false); }
  };

  const setFee = (i: number, patch: Partial<FixedFee>) => setFees(fees.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  return (
    <section className="ct" style={{ maxWidth: 760 }}>
      <div className="ct-head">
        <div>
          <h2>Đơn giá điện, nước &amp; phí</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Dùng khi lập hóa đơn tháng. Hóa đơn đã lập không bị đổi khi bạn sửa đơn giá.</p>
        </div>
        <Link className="linkbtn" style={{ color: "var(--brand)" }} to="/app/settings">← Cài đặt</Link>
      </div>

      {!loading && !configured && (
        <p className="ct-alert warn" role="note" style={{ marginBottom: 12 }}>Chưa lưu đơn giá. Các giá trị dưới đây là gợi ý, hãy kiểm tra rồi bấm Lưu.</p>
      )}

      <form className="card ct-form" onSubmit={save}>
        <div className="ct-grid2">
          <label>Giá điện (đ / kWh)<NumInput min={0} value={electric} onChange={(e) => setElectric(e.target.value === "" ? "" : +e.target.value)} /></label>
          <label>Giá nước (đ / m³)<NumInput min={0} value={water} onChange={(e) => setWater(e.target.value === "" ? "" : +e.target.value)} /></label>
        </div>

        <h4 className="rm-sec">Phí cố định mỗi phòng / tháng</h4>
        {fees.length === 0 && <p className="info" style={{ margin: "0 0 8px" }}>Chưa có phí nào. Thêm rác, internet, giữ xe…</p>}
        <div className="bl-fees">
          {fees.map((f, i) => (
            <div className="bl-fee" key={i}>
              <label>Tên phí<input value={f.label} onChange={(e) => setFee(i, { label: e.target.value })} placeholder="Rác, Internet…" /></label>
              <label>Số tiền (đ)<NumInput min={0} value={f.amount || ""} onChange={(e) => setFee(i, { amount: e.target.value === "" ? 0 : +e.target.value })} /></label>
              <button type="button" className="ghost danger" onClick={() => setFees(fees.filter((_, k) => k !== i))} aria-label={`Xóa phí ${f.label || i + 1}`}>Xóa</button>
            </div>
          ))}
        </div>
        <button type="button" className="ghost" style={{ marginTop: 8 }} onClick={() => setFees([...fees, { label: "", amount: 0 }])}><IcPlus /> Thêm phí</button>

        <h4 className="rm-sec">Thông tin chuyển khoản (khách sẽ thấy)</h4>
        <label>Ngân hàng, số tài khoản, chủ tài khoản, nội dung chuyển khoản
          <textarea rows={4} maxLength={600} value={payInfo} onChange={(e) => setPayInfo(e.target.value)} placeholder={"Ngân hàng ABC · STK 0123456789 · Nguyễn Văn A\nNội dung: Phòng <mã phòng> <tháng>"} />
        </label>

        {msg && <p className={bad ? "error" : "info"} role="status" style={{ marginTop: 12 }}>{msg}</p>}
        <div className="ct-actions"><button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Lưu đơn giá"}</button></div>
      </form>
    </section>
  );
}

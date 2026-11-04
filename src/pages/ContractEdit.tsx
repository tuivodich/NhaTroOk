// [PHASE4A] Sửa hợp đồng nháp + kích hoạt
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useAudit } from "../lib/audit";
import NumInput from "../components/NumInput";
import type { ContractDoc } from "../lib/types";

export default function ContractEdit() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const audit = useAudit();
  const [c, setC] = useState<ContractDoc | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "contracts", id)).then((s) => {
      if (s.exists()) setC({ id: s.id, ...(s.data() as object) } as ContractDoc);
      else setErr("Không tìm thấy hợp đồng.");
    }).catch((e) => setErr(e.message));
  }, [id]);

  if (!c) return <section>{err ? <p className="error">{err}</p> : <p>Đang tải…</p>}</section>;
  const editable = c.status === "draft";
  const set = (p: Partial<ContractDoc>) => setC({ ...c, ...p });

  const payload = () => ({
    startDate: c.startDate, endDate: c.endDate,
    rent: Number(c.rent) || 0, deposit: Number(c.deposit) || 0,
    paymentCycle: c.paymentCycle ?? "monthly",
    dueDay: Math.min(28, Math.max(1, Number(c.dueDay) || 5)),
    notes: c.notes ?? "",
  });

  const save = async (e: FormEvent, activate = false) => {
    e.preventDefault();
    if (!user) return;
    setErr("");
    if (activate) {
      if (!c.startDate || !c.endDate) return setErr("Cần ngày bắt đầu và kết thúc trước khi kích hoạt.");
      if (c.endDate < c.startDate) return setErr("Ngày kết thúc phải sau ngày bắt đầu.");
      if (!window.confirm("Kích hoạt hợp đồng " + (c.code ?? c.id) + "?")) return;
      if (!window.confirm("XÁC NHẬN LẦN 2: sau khi kích hoạt sẽ không sửa được bản nháp. Tiếp tục?")) return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "contracts", c.id), {
        ...payload(),
        ...(activate ? { status: "active" } : {}),
        timeline: arrayUnion({ at: Date.now(), by: user.uid, action: activate ? "activated" : "updated" }),
      });
      audit(activate ? "contract.activate" : "contract.update", (activate ? "Kích hoạt " : "Sửa ") + (c.code ?? c.id), { type: "contract", id: c.id });
      if (activate) nav("/app/contracts"); else setC({ ...c });
    } catch (ex) { setErr("Lỗi: " + ((ex as Error).message ?? ex)); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <h2>Hợp đồng {c.code ?? c.id} <span className={"tag " + c.status}>{c.status}</span></h2>
      {sp.get("fromInquiry") && <p className="info">Hợp đồng nháp vừa được tạo từ yêu cầu thuê. Bổ sung thông tin rồi kích hoạt.</p>}
      {err && <p className="error">{err}</p>}
      <form className="card" onSubmit={(e) => save(e)}>
        <fieldset disabled={!editable || busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="row">
            <label>Ngày bắt đầu<input type="date" value={c.startDate} onChange={(e) => set({ startDate: e.target.value })} /></label>
            <label>Ngày kết thúc<input type="date" value={c.endDate} onChange={(e) => set({ endDate: e.target.value })} /></label>
          </div>
          <div className="row">
            <label>Tiền thuê/tháng<NumInput min={0} value={c.rent} onChange={(e) => set({ rent: +e.target.value })} /></label>
            <label>Tiền cọc<NumInput min={0} value={c.deposit ?? 0} onChange={(e) => set({ deposit: +e.target.value })} /></label>
          </div>
          <div className="row">
            <label>Chu kỳ thanh toán
              <select value={c.paymentCycle ?? "monthly"} onChange={(e) => set({ paymentCycle: e.target.value as any })}>
                <option value="monthly">Hàng tháng</option>
                <option value="quarterly">Hàng quý</option>
                <option value="yearly">Hàng năm</option>
              </select>
            </label>
            <label>Ngày đến hạn (1-28)<input type="number" min={1} max={28} value={c.dueDay ?? 5} onChange={(e) => set({ dueDay: +e.target.value })} /></label>
          </div>
          <label>Ghi chú / điều khoản<textarea rows={3} value={c.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></label>
        </fieldset>
        <div className="row" style={{ marginTop: 12 }}>
          {editable && <button type="submit" disabled={busy}>Lưu nháp</button>}
          {editable && <button type="button" disabled={busy} onClick={(e) => save(e as any, true)}>Kích hoạt</button>}
          <Link className="linkbtn" to="/app/contracts">← Danh sách</Link>
        </div>
      </form>
      {c.timeline && c.timeline.length > 0 && (
        <div className="card"><h3>Lịch sử</h3>
          {c.timeline.map((ev, i) => <div key={i}><small>{new Date(ev.at).toLocaleString("vi-VN")} · {ev.action}</small></div>)}
        </div>
      )}
    </section>
  );
}

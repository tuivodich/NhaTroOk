// [PHASE4A] Trang fallback /app/inquiries/:id/convert
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { convertInquiry, convertErrorMessage } from "../lib/convertInquiry";

export default function ConvertInquiry() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async () => {
    if (!id || !user) return;
    if (!window.confirm("Chốt yêu cầu này và tạo hợp đồng nháp + khách thuê?")) return;
    if (!window.confirm("XÁC NHẬN LẦN 2: phòng sẽ chuyển sang 'đã thuê'. Tiếp tục?")) return;
    setBusy(true); setErr("");
    try {
      const r = await convertInquiry(db, { inquiryId: id, actorUid: user.uid, actorEmail: user.email });
      nav(`/app/contracts/${r.contractId}/edit?fromInquiry=1`);
    } catch (e) { setErr(convertErrorMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <h2>Chốt yêu cầu thuê</h2>
      <p className="info">Tạo hợp đồng nháp và khách thuê từ yêu cầu #{id}.</p>
      {err && <p className="error">{err}</p>}
      <div className="row">
        <button onClick={run} disabled={busy}>Chốt & tạo hợp đồng</button>
        <Link className="linkbtn" to="/app/inquiries">← Quay lại</Link>
      </div>
    </section>
  );
}

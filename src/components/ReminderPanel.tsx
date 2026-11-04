import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { usePaymentInfo } from "../lib/usePaymentInfo";
import { normalizePhone } from "../lib/convertInquiry";
import { buildReminderText, type RemindItem } from "../lib/reminder";
import type { ReminderLog } from "../lib/types";

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

interface Props {
  tenantName?: string; tenantId?: string; phone?: string; email?: string;
  roomId: string; roomCode: string;
  items: (RemindItem & { invoiceId: string })[];
  onClose: () => void;
}

/** [PHASE5] Soạn và gửi nhắc nợ thủ công: sao chép, Zalo, SMS, email. Mỗi lần gửi ghi vào reminderLogs. */
export default function ReminderPanel({ tenantName, tenantId, phone, email, roomId, roomCode, items, onClose }: Props) {
  const { user } = useAuth();
  const { text: payText } = usePaymentInfo();
  const portalUrl = typeof window !== "undefined" ? window.location.origin + "/toi" : undefined;
  const initial = useMemo(
    () => buildReminderText({ name: tenantName, roomCode, items, paymentText: payText, today: localToday(), portalUrl }),
    [tenantName, roomCode, items, payText, portalUrl]
  );
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? initial;
  const [note, setNote] = useState("");
  const phoneN = phone ? normalizePhone(phone) : "";

  const log = async (channel: ReminderLog["channel"]) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "reminderLogs"), {
        ...(tenantId ? { tenantId } : {}), roomId, invoiceIds: items.map((x) => x.invoiceId),
        channel, by: user.uid, day: localToday(), at: serverTimestamp(),
      });
    } catch (e) { console.error("reminder log failed", e); }
  };

  const copy = async (): Promise<boolean> => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.getElementById("rm-text") as HTMLTextAreaElement | null;
      if (ta) { ta.select(); try { return document.execCommand("copy"); } catch { /* ignore */ } }
      return false;
    }
  };

  const doCopy = async () => { const ok = await copy(); setNote(ok ? "Đã sao chép. Dán vào Zalo, SMS hoặc email." : "Không sao chép tự động được. Hãy chọn nội dung và sao chép tay."); if (ok) log("copy"); };
  const doZalo = async () => {
    const ok = await copy();   // Zalo không nhận sẵn nội dung qua đường dẫn, nên sao chép trước để bạn dán
    setNote(ok ? "Đã sao chép nội dung. Mở Zalo, dán và gửi." : "Hãy sao chép nội dung thủ công rồi dán vào Zalo.");
    window.open(`https://zalo.me/${phoneN}`, "_blank", "noopener");
    log("zalo");
  };
  const doSms = () => { window.location.href = `sms:${phoneN}?&body=${encodeURIComponent(text)}`; log("sms"); setNote("Đã mở ứng dụng nhắn tin."); };
  const doEmail = () => {
    const subject = `Nhắc thanh toán tiền phòng ${roomCode}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    log("email"); setNote("Đã mở ứng dụng email.");
  };

  return (
    <div className="rm-panel" role="group" aria-label={`Nhắc nợ phòng ${roomCode}`}>
      <label className="iq-field">Nội dung nhắc (có thể chỉnh trước khi gửi)
        <textarea id="rm-text" rows={9} value={text} onChange={(e) => setEdited(e.target.value)} />
      </label>
      <div className="ct-actions" style={{ marginTop: 8 }}>
        <button onClick={doCopy}>Sao chép</button>
        <button className="ghost" onClick={doZalo} disabled={!phoneN} title={phoneN ? "" : "Khách chưa có số điện thoại"}>Zalo</button>
        <button className="ghost" onClick={doSms} disabled={!phoneN} title={phoneN ? "" : "Khách chưa có số điện thoại"}>SMS</button>
        <button className="ghost" onClick={doEmail} disabled={!email} title={email ? "" : "Khách chưa có email"}>Email</button>
        <button className="ghost" onClick={onClose}>Đóng</button>
      </div>
      {!phoneN && !email && <p className="ct-sub" style={{ margin: "8px 0 0" }}>Hồ sơ khách chưa có số điện thoại hay email. Bạn vẫn sao chép được nội dung.</p>}
      {note && <p className="info" role="status" style={{ margin: "8px 0 0" }}>{note}</p>}
    </div>
  );
}

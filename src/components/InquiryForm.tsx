import { useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { RoomDoc } from "../lib/types";

export default function InquiryForm({ room }: { room: RoomDoc }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const n = name.trim();
    const p = phone.trim();
    if (!n || !p) { setErr("Vui lòng nhập họ tên và số điện thoại."); return; }
    if (p.replace(/\D/g, "").length < 8) { setErr("Số điện thoại không hợp lệ."); return; }

    if (room.status !== "vacant") {
      setErr("Phòng này hiện không còn trống. Vui lòng chọn phòng khác.");
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, "inquiries"), {
        name: n,
        phone: p,
        email: email.trim() || null,
        message: message.trim() || null,
        preferredDate: preferredDate || null,
        roomId: room.id,
        roomCode: room.code,
        status: "new",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDone(true);
    } catch (e: any) {
      setErr(e?.message || "Gửi thất bại, vui lòng thử lại sau.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div style={{ padding: 20, background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Cảm ơn bạn!</h3>
        <p style={{ marginBottom: 0 }}>Yêu cầu đã được gửi. Chúng tôi sẽ liên hệ với bạn sớm nhất có thể.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <h2 style={{ margin: 0 }}>Đăng ký thuê / hẹn xem phòng</h2>
      <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>
        Điền thông tin để chúng tôi liên hệ xác nhận. Bạn cũng có thể gọi trực tiếp nếu cần gấp.
      </p>

      <label>
        Họ tên <span style={{ color: "#c62828" }}>*</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100}
          style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box" }} />
      </label>

      <label>
        Số điện thoại <span style={{ color: "#c62828" }}>*</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={30}
          inputMode="tel" style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box" }} />
      </label>

      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120}
          style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box" }} />
      </label>

      <label>
        Ngày muốn xem phòng
        <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box" }} />
      </label>

      <label>
        Lời nhắn
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000}
          style={{ width: "100%", padding: "8px 10px", boxSizing: "border-box", resize: "vertical" }} />
      </label>

      {err && <div style={{ color: "#c62828" }}>{err}</div>}

      <button type="submit" disabled={sending}
        style={{ padding: "10px 22px", cursor: sending ? "wait" : "pointer", fontSize: 15 }}>
        {sending ? "Đang gửi…" : "Gửi yêu cầu"}
      </button>
    </form>
  );
}

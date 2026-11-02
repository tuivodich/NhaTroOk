import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

type StaffInvite = {
  id: string;
  email: string;
  name?: string;
  active?: boolean;
  acceptedAt?: any;
};

export default function StaffInvites() {
  const { profile } = useAuth();
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "staffInvites"), (snap) => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffInvite)));
      setLoading(false);
    });
    return unsub;
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const emailLower = email.trim().toLowerCase();
    if (!emailLower.includes("@")) { setErr("Email không hợp lệ"); return; }
    setBusy(true);
    try {
      await setDoc(doc(db, "staffInvites", emailLower), {
        email: emailLower,
        name: name.trim() || "",
        active: true,
        createdAt: serverTimestamp(),
        createdBy: profile?.uid || "",
      });
      setEmail(""); setName("");
    } catch (e: any) {
      setErr(e?.message || "Lỗi tạo lời mời");
    } finally { setBusy(false); }
  }

  async function toggleActive(inv: StaffInvite) {
    await updateDoc(doc(db, "staffInvites", inv.id), {
      active: inv.active === false ? true : false,
    });
  }

  if (profile?.role !== "admin") {
    return <div className="p-4">Chỉ admin mới có quyền truy cập.</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mời nhân viên</h1>
      <form onSubmit={handleAdd} className="flex gap-2 mb-6 flex-wrap">
        <input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="border p-2 rounded flex-1 min-w-[220px]" required />
        <input type="text" placeholder="Tên gợi ý (tuỳ chọn)" value={name} onChange={(e) => setName(e.target.value)} className="border p-2 rounded flex-1 min-w-[180px]" />
        <button type="submit" disabled={busy} className="btn btn-primary px-4">{busy ? "Đang lưu..." : "Thêm lời mời"}</button>
      </form>
      {err && <div className="text-red-600 mb-3">{err}</div>}
      {loading ? <div>Đang tải...</div> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Email</th><th>Tên</th><th>Trạng thái</th><th>Đã dùng</th><th></th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id} className="border-b">
                <td className="py-2">{inv.email}</td>
                <td>{inv.name || "—"}</td>
                <td>{inv.active === false ? <span className="text-red-600">Đã thu hồi</span> : <span className="text-green-600">Đang hiệu lực</span>}</td>
                <td>{inv.acceptedAt ? "✓" : "—"}</td>
                <td><button onClick={() => toggleActive(inv)} className="text-blue-600 underline">{inv.active === false ? "Kích hoạt lại" : "Thu hồi"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

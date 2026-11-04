import { useEffect, useState, type FormEvent } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { IcMail } from "../components/Icons";

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
      setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffInvite)));
      setLoading(false);
    }, (e) => { setErr(e.message); setLoading(false); });
    return unsub;
  }, []);

  async function handleAdd(e: FormEvent) {
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
    const revoke = inv.active !== false;
    if (!window.confirm((revoke ? "Thu hồi lời mời của " : "Kích hoạt lại lời mời của ") + inv.email + "?")) return;
    try {
      await updateDoc(doc(db, "staffInvites", inv.id), { active: !revoke });
    } catch (e: any) {
      setErr(e?.message || "Không cập nhật được lời mời");
    }
  }

  if (profile?.role !== "admin") {
    return <section className="ct"><div className="ct-empty"><strong>Chỉ admin mới có quyền truy cập.</strong></div></section>;
  }

  return (
    <section className="ct" style={{ maxWidth: 820 }}>
      <div className="ct-head">
        <div>
          <h2>Mời nhân viên</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Người có email trong danh sách này sẽ nhận vai trò nhân viên ngay khi đăng nhập lần đầu.</p>
        </div>
      </div>

      <form className="card ct-form" onSubmit={handleAdd}>
        <div className="ct-grid2">
          <label>Email nhân viên<input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Tên gợi ý (tuỳ chọn)<input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
        </div>
        {err && <p className="error" role="alert" style={{ marginTop: 12 }}>{err}</p>}
        <div className="ct-actions"><button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Thêm lời mời"}</button></div>
      </form>

      {loading ? (
        <div className="ct-list" aria-busy="true">{[0, 1].map((i) => <div key={i} className="ct-card ct-skel" style={{ minHeight: 90 }} />)}</div>
      ) : invites.length === 0 ? (
        <div className="ct-empty"><strong>Chưa có lời mời nào.</strong><span>Thêm email nhân viên ở trên.</span></div>
      ) : (
        <div className="ct-list">
          {invites.map((inv) => {
            const revoked = inv.active === false;
            return (
              <article className="ct-card" key={inv.id} style={{ borderLeftColor: revoked ? "#dc2626" : "#059669" }}>
                <header className="ct-card-head">
                  <div className="iq-who">
                    <span className="iq-avatar" aria-hidden="true"><IcMail /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="ct-code" style={{ overflowWrap: "anywhere", fontSize: 14 }}>{inv.email}</div>
                      {inv.name && <div className="ct-sub">{inv.name}</div>}
                    </div>
                  </div>
                  <span className={"tag " + (revoked ? "cancelled" : "active")}>{revoked ? "Đã thu hồi" : "Đang hiệu lực"}</span>
                </header>
                <div className="ct-sub">{inv.acceptedAt ? "Đã đăng nhập bằng lời mời này" : "Chưa có ai dùng"}</div>
                <footer className="ct-actions">
                  <button className={revoked ? "" : "ghost danger"} onClick={() => toggleActive(inv)}>{revoked ? "Kích hoạt lại" : "Thu hồi"}</button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

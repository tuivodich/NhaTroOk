import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole } from "../lib/types";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setMsg(""); setBad(false);
    try {
      await updateProfile(user, { displayName: name.trim() });
      await updateDoc(doc(db, "users", user.uid), { displayName: name.trim() });
      setMsg(t("saved"));
    } catch (ex) {
      console.error("save profile failed", ex);
      setMsg(t("error")); setBad(true);
    } finally { setBusy(false); }
  };

  return (
    <section className="ct" style={{ maxWidth: 720 }}>
      <div className="ct-head">
        <div>
          <h2>{t("settings")}</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Thông tin tài khoản và ngôn ngữ hiển thị.</p>
        </div>
      </div>

      <form className="card ct-form" onSubmit={save}>
        <h3>{t("profile")}</h3>
        <div className="ct-grid2">
          <label>{t("displayName")}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>{t("email")}<input value={user?.email ?? ""} disabled /></label>
          <label>{t("language")}
            <select value={lang} onChange={(e) => setLang(e.target.value as "vi" | "en")}>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        {msg && <p className={bad ? "error" : "info"} role="status">{msg}</p>}
        <div className="ct-actions"><button type="submit" disabled={busy}>{busy ? "Đang lưu…" : t("save")}</button></div>
      </form>

      {isAdminRole(profile?.role) && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("brandTitle")}</h3>
          <p className="info" style={{ marginTop: 0 }}>Đổi tên hiển thị, khẩu hiệu và màu chủ đạo của hệ thống.</p>
          <Link className="ct-btn" to="/app/settings/brand">Chỉnh thương hiệu</Link>
        </div>
      )}
      {isAdminRole(profile?.role) && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Đơn giá điện, nước &amp; phí</h3>
          <p className="info" style={{ marginTop: 0 }}>Giá điện, giá nước và các khoản phí cố định dùng khi lập hóa đơn tháng.</p>
          <Link className="ct-btn" to="/app/settings/billing">Chỉnh đơn giá</Link>
        </div>
      )}
    </section>
  );
}

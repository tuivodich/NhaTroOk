import { useState, type FormEvent } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db } from "../lib/firebase";
import { auth } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setMsg("");
    try {
      await updateProfile(user, { displayName: name.trim() });
      await updateDoc(doc(db, "users", user.uid), { displayName: name.trim() });
      setMsg(t("saved"));
    } catch (ex) {
      console.error("save profile failed", ex);
      setMsg(t("error"));
    } finally { setBusy(false); }
  };

  return (
    <section>
      <h2>{t("settings")}</h2>
      <form className="card" onSubmit={save}>
        <h3>{t("profile")}</h3>
        <label>{t("displayName")}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{t("email")}<input value={user?.email ?? ""} disabled /></label>
        <label>{t("language")}
          <select value={lang} onChange={(e) => setLang(e.target.value as "vi" | "en")}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        {msg && <p className="info">{msg}</p>}
        <div className="row"><button type="submit" disabled={busy}>{t("save")}</button></div>
      </form>
    </section>
  );
}

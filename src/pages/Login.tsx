import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useBrand } from "../brand/BrandProvider";

export default function Login() {
  const { user, loading, login, register, loginGoogle } = useAuth();
  const { t } = useI18n();
  const brand = useBrand();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/app";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) navigate(next, { replace: true }); }, [user, loading, navigate, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    } catch (ex) {
      setErr((ex as Error).message.replace(/^Firebase:\s*/, ""));
    } finally { setBusy(false); }
  };

  const google = async () => {
    setErr(""); setBusy(true);
    try { await loginGoogle(); } catch (ex) { setErr((ex as Error).message.replace(/^Firebase:\s*/, "")); } finally { setBusy(false); }
  };

  return (
    <div className="authpage">
      <div className="card authcard">
        <h1 style={{ color: brand.brandColor, marginTop: 0 }}>{brand.name}</h1>
        <h2 style={{ color: "var(--muted)", textAlign: "center", fontSize: 15, marginTop: 0 }}>
          {mode === "login" ? t("signInTitle") : t("signUpTitle")}
        </h2>
        <form onSubmit={submit}>
          <label>{t("email")}<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>{t("password")}<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {err && <p className="error">{err}</p>}
          <button type="submit" disabled={busy}>{mode === "login" ? t("login") : t("register")}</button>
        </form>
        <button type="button" className="ghost block" onClick={google} disabled={busy}>{t("loginGoogle")}</button>
        <p style={{ textAlign: "center", marginTop: 12 }}>
          <button type="button" className="linkbtn" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? t("noAccount") : t("haveAccount")}
          </button>
        </p>
        {mode === "register" && <p className="info">{t("firstUserHint")}</p>}
      </div>
    </div>
  );
}

import FeaturedRooms from "../components/FeaturedRooms";
import { Link } from "react-router-dom";
import { useBrand } from "../brand/BrandProvider";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { BrandLogo } from "../brand/BrandName";

export default function Landing() {
  const brand = useBrand();
  const { user, profile } = useAuth();
  const { t, lang, setLang } = useI18n();

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="brand">
          <BrandLogo size={32} />
          <span>{brand.name}</span>
        </div>
        <div className="row">
          <button className="ghost" onClick={() => setLang(lang === "vi" ? "en" : "vi")}>{lang === "vi" ? "EN" : "VI"}</button>
          {user ? (
            <Link className="linkbtn primary" to={profile?.role === "tenant" ? "/" : "/app"}>{t("goToAdmin")}</Link>
          ) : (
            <Link className="linkbtn primary" to="/dang-nhap">{t("login")}</Link>
          )}
        </div>
      </header>

      <main className="landing-hero">
        <h1 style={{ color: brand.brandColor }}>{brand.name}</h1>
        {brand.tagline && <p className="tagline">{brand.tagline}</p>}
        <p className="info">{t("comingSoonDesc")}</p>
        <FeaturedRooms />
      </main>

      <footer className="landing-footer">
        <small>© {new Date().getFullYear()} {brand.name}</small>
      </footer>
    </div>
  );
}

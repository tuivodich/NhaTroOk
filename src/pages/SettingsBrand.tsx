import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useBrand } from "../brand/BrandProvider";
import { useI18n } from "../lib/i18n";

export default function SettingsBrand() {
  const { t } = useI18n();
  const brand = useBrand();
  const [name, setName] = useState(brand.name);
  const [tagline, setTagline] = useState(brand.tagline);
  const [color, setColor] = useState(brand.brandColor);
  const [msg, setMsg] = useState("");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      await brand.update({ name: name.trim() || "Nha Tro", tagline: tagline.trim(), brandColor: color });
      setMsg(t("saved"));
    } catch (ex) {
      console.error("save brand failed", ex);
      setMsg(t("error"));
    }
  };

  return (
    <section className="ct" style={{ maxWidth: 720 }}>
      <div className="ct-head">
        <div>
          <h2>{t("brandTitle")}</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Áp dụng cho toàn hệ thống trên trình duyệt này.</p>
        </div>
        <Link className="linkbtn" style={{ color: "var(--brand)" }} to="/app/settings">← Cài đặt</Link>
      </div>

      <form className="card ct-form" onSubmit={save}>
        <div className="ct-grid2">
          <label>{t("brandName")}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>{t("brandTagline")}<input value={tagline} onChange={(e) => setTagline(e.target.value)} /></label>
          <label>{t("brandColor")}<input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ padding: 4 }} /></label>
        </div>
        <div className="card" style={{ marginTop: 16, boxShadow: "none" }}>
          <div className="ct-sub" style={{ marginBottom: 8 }}>Xem trước</div>
          <div className="row">
            <span className="m-logo" style={{ width: 32, height: 32, borderRadius: 10, background: color, display: "inline-block" }} aria-hidden="true" />
            <div><strong style={{ color }}>{name || "Nha Tro"}</strong><div className="ct-sub">{tagline}</div></div>
          </div>
        </div>
        {msg && <p className="info" role="status">{msg}</p>}
        <div className="ct-actions">
          <button type="submit">{t("save")}</button>
          <button type="button" className="ghost" onClick={() => { brand.reset(); setColor("#0F766E"); setName("Nha Tro"); setTagline("Quản lý nhà trọ gọn gàng, hiện đại"); }}>{t("reset")}</button>
        </div>
      </form>
    </section>
  );
}

import { useState, type FormEvent } from "react";
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
    <section>
      <h2>{t("brandTitle")}</h2>
      <form className="card" onSubmit={save}>
        <label>{t("brandName")}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{t("brandTagline")}<input value={tagline} onChange={(e) => setTagline(e.target.value)} /></label>
        <label>{t("brandColor")}<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        {msg && <p className="info">{msg}</p>}
        <div className="row">
          <button type="submit">{t("save")}</button>
          <button type="button" className="ghost" onClick={() => brand.reset()}>{t("reset")}</button>
        </div>
      </form>
    </section>
  );
}

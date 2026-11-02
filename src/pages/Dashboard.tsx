import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCollection } from "../lib/useCollection";
import type { PropertyDoc, RoomDoc } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { useBrand } from "../brand/BrandProvider";

export default function Dashboard() {
  const { t } = useI18n();
  const brand = useBrand();
  const { data: properties } = useCollection<PropertyDoc>("properties");
  const { data: rooms } = useCollection<RoomDoc>("rooms");

  const stats = useMemo(() => ({
    properties: properties.length,
    rooms: rooms.length,
    vacant: rooms.filter((r) => r.status === "vacant").length,
    occupied: rooms.filter((r) => r.status === "occupied").length,
  }), [properties, rooms]);

  return (
    <section>
      <h2>{t("dashboard")}</h2>
      <p className="info">{brand.tagline || brand.name}</p>

      <div className="stats">
        <div className="stat"><div className="num">{stats.properties}</div><div className="label">{t("totalProperties")}</div></div>
        <div className="stat"><div className="num">{stats.rooms}</div><div className="label">{t("totalRooms")}</div></div>
        <div className="stat"><div className="num">{stats.vacant}</div><div className="label">{t("vacantRooms")}</div></div>
        <div className="stat"><div className="num">{stats.occupied}</div><div className="label">{t("occupiedRooms")}</div></div>
      </div>

      <h3 style={{ marginTop: 20, fontSize: 16, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{t("quickActions")}</h3>
      <div className="row">
        <Link className="linkbtn primary" to="/app/properties">{t("addProperty")}</Link>
        <Link className="linkbtn primary" to="/app/rooms">{t("addRoom")}</Link>
        <Link className="linkbtn" to="/app/settings/brand">{t("brandTitle")}</Link>
      </div>
    </section>
  );
}

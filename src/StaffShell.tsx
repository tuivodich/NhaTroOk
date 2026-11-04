import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { useI18n } from "./lib/i18n";
import { useBrand } from "./brand/BrandProvider";
import { BrandLogo } from "./brand/BrandName";
import { isAdminRole } from "./lib/types";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Rooms from "./pages/Rooms";
import Tenants from "./pages/Tenants";
import Contracts from "./pages/Contracts";
import Invoices from "./pages/Invoices";
import Users from "./pages/Users";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import SettingsBrand from "./pages/SettingsBrand";
import RoomExtras from "./pages/RoomExtras";
import StaffInvites from "./pages/StaffInvites";
import Billing from "./pages/Billing"; // [PHASE4B]
import Maintenance from "./pages/Maintenance"; // [PHASE4C]
import SettingsBilling from "./pages/SettingsBilling"; // [PHASE4B]
import Inquiries from "./pages/Inquiries";
import ContractEdit from "./pages/ContractEdit"; // [PHASE4A]
import ConvertInquiry from "./pages/ConvertInquiry"; // [PHASE4A]

export default function StaffShell() {
  const { user, profile, loading, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const brand = useBrand();
  const navigate = useNavigate();

  if (loading) return <div className="authpage"><p>{t("loading")}</p></div>;
  if (!user) return <Navigate to="/dang-nhap?next=/app" replace />;
  if (profile?.role === "tenant") return <Navigate to="/toi" replace />;

  const isAdmin = isAdminRole(profile?.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo size={26} />
          <span>{brand.name}</span>
        </div>
        <nav>
          <NavLink to="/app" end>{t("dashboard")}</NavLink>
          <NavLink to="/app/properties">{t("properties")}</NavLink>
          <NavLink to="/app/rooms">{t("rooms")}</NavLink>
          <NavLink to="/app/room-extras">Ảnh & Hiển thị</NavLink>
          <NavLink to="/app/tenants">{t("tenants")}</NavLink>
          <NavLink to="/app/contracts">{t("contracts")}</NavLink>
        <NavLink to="/app/inquiries">Yêu cầu thuê</NavLink>
          <NavLink to="/app/maintenance">Sửa chữa</NavLink>
          <NavLink to="/app/billing">Lập hóa đơn</NavLink>
          <NavLink to="/app/invoices">{t("invoices")}</NavLink>
          {isAdmin && <NavLink to="/app/users">{t("users")}</NavLink>}
          {isAdmin && <NavLink to="/app/staff-invites">Mời nhân viên</NavLink>}
          {isAdmin && <NavLink to="/app/audit">{t("auditLog")}</NavLink>}
          <NavLink to="/app/settings">{t("settings")}</NavLink>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div />
          <div className="row">
            <button className="ghost" onClick={() => setLang(lang === "vi" ? "en" : "vi")}>{lang === "vi" ? "EN" : "VI"}</button>
            <span>{profile?.displayName || user.email}</span>
            <button className="ghost" onClick={async () => { await logout(); navigate("/"); }}>{t("logout")}</button>
          </div>
        </header>
        <div className="content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="properties" element={<Properties />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="room-extras" element={<RoomExtras />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="contracts/:id/edit" element={<ContractEdit />} />
            <Route path="inquiries" element={<Inquiries />} />
            <Route path="inquiries/:id/convert" element={<ConvertInquiry />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="billing" element={<Billing />} />
            <Route path="invoices" element={<Invoices />} />
            {isAdmin && <Route path="users" element={<Users />} />}
            {isAdmin && <Route path="staff-invites" element={<StaffInvites />} />}
            {isAdmin && <Route path="audit" element={<AuditLog />} />}
            <Route path="settings" element={<Settings />} />
            {isAdmin && <Route path="settings/billing" element={<SettingsBilling />} />}
            {isAdmin && <Route path="settings/brand" element={<SettingsBrand />} />}
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
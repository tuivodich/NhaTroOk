import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { useMyDocs } from "./lib/useMyDocs";
import { useBrand } from "./brand/BrandProvider";
import { BrandLogo } from "./brand/BrandName";
import type { ContractDoc, InvoiceDoc, TenantDoc } from "./lib/types";
import TenantRoom from "./pages/tenant/TenantRoom";
import TenantInvoices from "./pages/tenant/TenantInvoices";
import TenantContracts from "./pages/tenant/TenantContracts";
import TenantMaintenance from "./pages/tenant/TenantMaintenance";
import { IcDoor, IcFile, IcInbox, IcWarn } from "./components/Icons";

const TABS = [
  { key: "phong", label: "Phòng của tôi", Icon: IcDoor },
  { key: "hoadon", label: "Hóa đơn", Icon: IcInbox },
  { key: "hopdong", label: "Hợp đồng", Icon: IcFile },
  { key: "yeucau", label: "Sửa chữa", Icon: IcWarn },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function TenantShell() {
  const { user, profile, loading, logout } = useAuth();
  const brand = useBrand();
  const [tab, setTab] = useState<TabKey>("phong");
  const uid = user?.uid ?? null;
  const { data: tenants, loading: lt } = useMyDocs<TenantDoc>("tenants", uid);
  const { data: contracts, loading: lc } = useMyDocs<ContractDoc>("contracts", uid);
  const { data: invoices, loading: li } = useMyDocs<InvoiceDoc>("invoices", uid);

  if (loading) return <div className="authpage"><p>Đang tải...</p></div>;
  if (!user) return <Navigate to="/dang-nhap?next=/toi" replace />;
  if (profile?.role !== "tenant") return <Navigate to="/app" replace />;

  const tenant = tenants[0];
  const room = contracts.find((c) => c.status === "active") ?? contracts[0];

  return (
    <div className="tp">
      <header className="tp-head">
        <div className="brand"><BrandLogo size={28} /><div><div>{brand.name}</div><div className="ct-sub" style={{ fontWeight: 400 }}>{tenant?.name || profile.displayName || profile.email}</div></div></div>
        <button className="ghost" onClick={() => logout()}>Đăng xuất</button>
      </header>
      <nav className="tp-tabs" aria-label="Cổng cư dân">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} type="button" className={"tp-tab" + (tab === key ? " on" : "")} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}>
            <Icon /> {label}
          </button>
        ))}
      </nav>
      <main className="tp-main ct">
        {lt ? <div className="ct-card ct-skel" /> : !tenant ? (
          <div className="ct-empty">
            <strong>Tài khoản của bạn chưa được liên kết với hồ sơ khách thuê.</strong>
            <span>Hãy gửi email đăng nhập <b>{profile.email || user.email}</b> cho chủ trọ để được liên kết.</span>
          </div>
        ) : (
          <>
            {tab === "phong" && <TenantRoom contracts={contracts} />}
            {tab === "hoadon" && <TenantInvoices invoices={invoices} loading={li} uid={user.uid} tenantId={tenant.id} />}
            {tab === "hopdong" && <TenantContracts contracts={contracts} loading={lc} />}
            {tab === "yeucau" && <TenantMaintenance uid={user.uid} tenantId={tenant.id} roomId={room?.roomId} />}
          </>
        )}
      </main>
    </div>
  );
}

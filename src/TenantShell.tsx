import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";

const TABS = [
  { key: "phong",   label: "Phòng của tôi",    icon: "🏠" },
  { key: "hoadon",  label: "Hóa đơn",          icon: "🧾" },
  { key: "hopdong", label: "Hợp đồng",         icon: "📄" },
  { key: "yeucau",  label: "Yêu cầu sửa chữa", icon: "🔧" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function TenantShell() {
  const { user, profile, loading, logout } = useAuth();
  const [tab, setTab] = useState<TabKey>("phong");

  if (loading) return <div className="authpage"><p>Đang tải...</p></div>;
  if (!user) return <Navigate to="/dang-nhap?next=/toi" replace />;
  if (profile?.role !== "tenant") return <Navigate to="/app" replace />;

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f8" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Cổng cư dân</div>
          <div style={{ fontSize: 12, color: "#888" }}>{profile.displayName || profile.email}</div>
        </div>
        <button className="ghost" onClick={() => logout()}>Đăng xuất</button>
      </header>
      <nav style={{ background: "#fff", borderBottom: "1px solid #eee", display: "flex", overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "12px 16px", fontSize: 14, whiteSpace: "nowrap",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === t.key ? "2px solid #2563eb" : "2px solid transparent",
              color: tab === t.key ? "#2563eb" : "#666",
              fontWeight: tab === t.key ? 600 : 400,
            }}>
            <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
      <main style={{ padding: 16, maxWidth: 800, margin: "0 auto" }}>
        {tab === "phong"   && <Placeholder title="Phòng của tôi" hint="Thông tin phòng & hợp đồng đang thuê." />}
        {tab === "hoadon"  && <Placeholder title="Hóa đơn" hint="Danh sách hóa đơn & nút 'Tôi đã chuyển khoản'." />}
        {tab === "hopdong" && <Placeholder title="Hợp đồng" hint="Hợp đồng & thời hạn thuê." />}
        {tab === "yeucau"  && <Placeholder title="Yêu cầu sửa chữa" hint="Form gửi & lịch sử xử lý." />}
      </main>
    </div>
  );
}

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: 24, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: "#666" }}>{hint}</div>
    </div>
  );
}
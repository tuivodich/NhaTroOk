import { useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type Role, type UserProfile } from "../lib/types";

const ROLE_LABEL: Record<Role, string> = { admin: "Quản trị", staff: "Nhân viên", tenant: "Khách thuê" };

export default function Users() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: users, loading } = useCollection<UserProfile>("users");
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<Role | "all">("all");
  const [q, setQ] = useState("");

  const changeRole = async (u: UserProfile, role: Role) => {
    if (!canEdit) return;
    if (!window.confirm("Xác nhận đổi vai trò?\n\n" + (u.email ?? u.id) + "\nĐổi thành: " + ROLE_LABEL[role] + "\n\nBấm OK để xác nhận, Hủy để giữ nguyên.")) return;
    try {
      await updateDoc(doc(db, "users", u.id), { role });
      audit("user.role", "Doi quyen " + (u.email ?? u.id) + " -> " + role, { type: "user", id: u.id });
    } catch (ex) {
      console.error("change role failed", ex);
      setErr(t("error"));
    }
  };

  const count = (r: Role) => users.filter((u) => u.role === r).length;
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users
      .filter((u) => filter === "all" || u.role === filter)
      .filter((u) => !needle || (u.displayName ?? "").toLowerCase().includes(needle) || (u.email ?? "").toLowerCase().includes(needle));
  }, [users, filter, q]);

  const chips: { key: Role | "all"; label: string; n: number }[] = [
    { key: "all", label: "Tất cả", n: users.length },
    { key: "admin", label: ROLE_LABEL.admin, n: count("admin") },
    { key: "staff", label: ROLE_LABEL.staff, n: count("staff") },
    { key: "tenant", label: ROLE_LABEL.tenant, n: count("tenant") },
  ];

  return (
    <section className="ct">
      <div className="ct-head">
        <div>
          <h2>{t("users")}</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Tài khoản đã đăng nhập và vai trò của từng người.</p>
        </div>
      </div>
      {err && <p className="error" role="alert">{err}</p>}

      {users.length > 0 && (
        <div className="ct-toolbar">
          <div className="ct-chips" role="group" aria-label="Lọc theo vai trò">
            {chips.map((c) => (
              <button key={c.key} type="button" className={"ct-chip" + (filter === c.key ? " on" : "")} aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}>
                {c.label} <span className="ct-chip-n">{c.n}</span>
              </button>
            ))}
          </div>
          <label className="ct-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Tìm tên, email…" aria-label="Tìm người dùng" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      )}
      <p className="ct-count" role="status" aria-atomic="true">{!loading && users.length > 0 ? `Hiển thị ${visible.length} / ${users.length} người` : ""}</p>

      {loading ? (
        <div className="ct-list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="ct-card ct-skel" style={{ minHeight: 110 }} />)}</div>
      ) : users.length === 0 ? (
        <div className="ct-empty"><strong>{t("noUsers")}</strong></div>
      ) : visible.length === 0 ? (
        <div className="ct-empty"><strong>Không có người dùng phù hợp.</strong><button className="ghost" onClick={() => { setFilter("all"); setQ(""); }}>Xóa bộ lọc</button></div>
      ) : (
        <div className="ct-list">
          {visible.map((u) => {
            const name = u.displayName || u.email || u.id;
            const isMe = u.id === profile?.id || u.uid === profile?.uid;
            return (
              <article className="ct-card" key={u.id} style={{ borderLeftColor: "var(--border)" }}>
                <header className="ct-card-head">
                  <div className="iq-who">
                    <span className="iq-avatar" aria-hidden="true">{(name.trim()[0] || "?").toUpperCase()}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="ct-code" style={{ overflowWrap: "anywhere" }}>{name}{isMe && <span className="ct-sub"> (bạn)</span>}</div>
                      {u.email && u.displayName && <div className="ct-sub" style={{ overflowWrap: "anywhere" }}>{u.email}</div>}
                    </div>
                  </div>
                  <span className={"tag role-" + u.role}>{ROLE_LABEL[u.role] ?? u.role}</span>
                </header>
                {canEdit && (
                  <label className="iq-field">Vai trò
                    <select value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)}>
                      <option value="admin">{ROLE_LABEL.admin}</option>
                      <option value="staff">{ROLE_LABEL.staff}</option>
                      <option value="tenant">{ROLE_LABEL.tenant}</option>
                    </select>
                  </label>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

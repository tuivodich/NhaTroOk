import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type Role, type UserProfile } from "../lib/types";

export default function Users() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: users, loading } = useCollection<UserProfile>("users");
  const [err, setErr] = useState("");

  const changeRole = async (u: UserProfile, role: Role) => {
    if (!canEdit) return;
    try {
      await updateDoc(doc(db, "users", u.id), { role });
      audit("user.role", "Doi quyen " + (u.email ?? u.id) + " -> " + role, { type: "user", id: u.id });
    } catch (ex) {
      console.error("change role failed", ex);
      setErr(t("error"));
    }
  };

  return (
    <section>
      <h2>{t("users")}</h2>
      {err && <p className="error">{err}</p>}
      {loading ? <p>{t("loading")}</p> : users.length === 0 ? (
        <p className="info">{t("noUsers")}</p>
      ) : (
        <div className="list">
          {users.map((u) => (
            <div className="card" key={u.id}>
              <div className="row between">
                <strong>{u.displayName || u.email || u.id}</strong>
                {canEdit ? (
                  <select value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)}>
                    <option value="admin">admin</option>
                    <option value="staff">staff</option>
                    <option value="tenant">tenant</option>
                  </select>
                ) : (
                  <span className="tag">{u.role}</span>
                )}
              </div>
              {u.email ? <small>{u.email}</small> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

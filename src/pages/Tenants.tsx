import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type ContractDoc, type RoomDoc, type TenantDoc } from "../lib/types";
import { IcDoor, IcFile, IcMail, IcPhone, IcPlus } from "../components/Icons";

interface F { id?: string; name: string; phone: string; email: string; idNumber: string; roomId: string; notes: string; }
const empty: F = { name: "", phone: "", email: "", idNumber: "", roomId: "", notes: "" };

type Filter = "all" | "withContract" | "noContract";

export default function Tenants() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: tenants, loading } = useCollection<TenantDoc>("tenants");
  const { data: rooms } = useCollection<RoomDoc>("rooms");
  const { data: contracts } = useCollection<ContractDoc>("contracts");
  const [form, setForm] = useState<F | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const roomLabel = (id?: string) => {
    if (!id) return "";
    const r = rooms.find((x) => x.id === id);
    return r ? r.code : id;
  };

  // Hợp đồng của từng khách (tra theo tenantId — nguồn sự thật)
  const byTenant = useMemo(() => {
    const m = new Map<string, ContractDoc[]>();
    for (const c of contracts) {
      const arr = m.get(c.tenantId) ?? [];
      arr.push(c); m.set(c.tenantId, arr);
    }
    return m;
  }, [contracts]);

  const hasLive = (id: string) => (byTenant.get(id) ?? []).some((c) => c.status === "active" || c.status === "draft");

  const counts = useMemo(() => ({
    all: tenants.length,
    withContract: tenants.filter((x) => (byTenant.get(x.id) ?? []).length > 0).length,
    noContract: tenants.filter((x) => (byTenant.get(x.id) ?? []).length === 0).length,
  }), [tenants, byTenant]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tenants
      .filter((x) => {
        const n = (byTenant.get(x.id) ?? []).length;
        return filter === "all" ? true : filter === "withContract" ? n > 0 : n === 0;
      })
      .filter((x) => !needle || [x.name, x.phone ?? "", x.email ?? "", x.code ?? "", x.idNumber ?? "", roomLabel(x.roomId)]
        .some((v) => v.toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [tenants, byTenant, filter, q, rooms]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErr(""); setBusy(true);
    try {
      if (!form.name.trim()) { setErr(t("tenantName")); return; }

      const payload: Record<string, unknown> = { name: form.name.trim() };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.idNumber.trim()) payload.idNumber = form.idNumber.trim();
      if (form.roomId) payload.roomId = form.roomId;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      if (form.id) {
        await updateDoc(doc(db, "tenants", form.id), payload);
        audit("tenant.update", "Sua khach " + form.name.trim(), { type: "tenant", id: form.id });
      } else {
        const ref = await addDoc(collection(db, "tenants"), payload);
        audit("tenant.create", "Them khach " + form.name.trim(), { type: "tenant", id: ref.id });
      }
      setForm(null);
    } catch (ex) {
      console.error("tenant save failed", ex);
      setErr("Lỗi: " + ((ex as Error)?.message ?? String(ex)));
    } finally { setBusy(false); }
  };

  const remove = async (x: TenantDoc) => {
    const n = (byTenant.get(x.id) ?? []).length;
    if (!confirm(n > 0
      ? `Khách "${x.name}" đang có ${n} hợp đồng liên kết. Xóa khách sẽ làm các hợp đồng mất thông tin khách.\n\nVẫn tiếp tục?`
      : t("deleteTenantSure"))) return;
    if (!confirm(`XÁC NHẬN LẦN 2: xóa khách "${x.name}"? Không thể hoàn tác.`)) return;
    try {
      await deleteDoc(doc(db, "tenants", x.id));
      audit("tenant.delete", "Xoa khach " + x.name, { type: "tenant", id: x.id });
    } catch (ex) {
      console.error("delete tenant failed", ex);
      setErr(t("error"));
    }
  };

  const chips: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "Tất cả", n: counts.all },
    { key: "withContract", label: "Có hợp đồng", n: counts.withContract },
    { key: "noContract", label: "Chưa có hợp đồng", n: counts.noContract },
  ];
  const statusText: Record<string, string> = { draft: "Nháp", active: t("contractActive"), expired: t("contractExpired"), cancelled: t("contractCancelled") };

  return (
    <section className="ct tn">
      <div className="ct-head">
        <div>
          <h2>{t("tenants")}</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Hồ sơ khách thuê và các hợp đồng liên quan.</p>
        </div>
        {canEdit && !form && (
          <button className="ct-btn-primary" onClick={() => { setErr(""); setForm({ ...empty }); }}>
            <IcPlus /> {t("addTenant")}
          </button>
        )}
      </div>

      {err && <p className="error" role="alert">{err}</p>}

      {form && (
        <form className="card ct-form" onSubmit={save}>
          <h3>{form.id ? t("editTenant") : t("addTenant")}</h3>
          <div className="ct-grid2">
            <label>{t("tenantName")}<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>{t("tenantPhone")}<input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>{t("tenantEmail")}<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>{t("tenantIdNumber")}<input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} /></label>
            <label>{t("tenantRoom")}
              <select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">{t("none")}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
              </select>
            </label>
          </div>
          <label style={{ marginTop: 12 }}>{t("notes")}<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="ct-actions">
            <button type="submit" disabled={busy}>{busy ? "Đang lưu…" : t("save")}</button>
            <button type="button" className="ghost" onClick={() => { setForm(null); setErr(""); }}>{t("cancel")}</button>
          </div>
        </form>
      )}

      {tenants.length > 0 && (
        <div className="ct-toolbar">
          <div className="ct-chips" role="group" aria-label="Lọc khách thuê">
            {chips.map((c) => (
              <button key={c.key} type="button" className={"ct-chip" + (filter === c.key ? " on" : "")}
                aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}>
                {c.label} <span className="ct-chip-n">{c.n}</span>
              </button>
            ))}
          </div>
          <label className="ct-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Tìm tên, SĐT, mã TN, CCCD…" aria-label="Tìm khách thuê" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      )}
      <p className="ct-count" role="status" aria-atomic="true">
        {!loading && tenants.length > 0 ? `Hiển thị ${visible.length} / ${tenants.length} khách` : ""}
      </p>

      {loading ? (
        <div className="ct-list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="ct-card ct-skel" />)}</div>
      ) : tenants.length === 0 && !form ? (
        <div className="ct-empty">
          <strong>{t("noTenants")}</strong>
          <span>Khách thuê được tạo tự động khi bạn chốt một yêu cầu thuê{canEdit ? ", hoặc thêm thủ công." : "."}</span>
          <Link className="linkbtn primary" to="/app/inquiries">Đi tới Yêu cầu thuê</Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="ct-empty"><strong>Không có khách phù hợp bộ lọc.</strong>
          <button className="ghost" onClick={() => { setFilter("all"); setQ(""); }}>Xóa bộ lọc</button></div>
      ) : (
        <div className="ct-list">
          {visible.map((x) => {
            const cs = (byTenant.get(x.id) ?? []).slice().sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
            const room = roomLabel(x.roomId);
            return (
              <article className={"ct-card" + (hasLive(x.id) ? "" : " tn-idle")} key={x.id}>
                <header className="ct-card-head">
                  <div className="iq-who">
                    <span className="iq-avatar" aria-hidden="true">{(x.name.trim()[0] || "?").toUpperCase()}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="ct-code" style={{ overflowWrap: "anywhere" }}>{x.name}</div>
                      {x.code && <div className="ct-sub ct-num">{x.code}</div>}
                    </div>
                  </div>
                  {hasLive(x.id)
                    ? <span className="tag active">Đang thuê</span>
                    : <span className="tag draft">Chưa có HĐ hiệu lực</span>}
                </header>

                <dl className="ct-meta">
                  {x.phone && <div><dt><span className="sr">Điện thoại</span><IcPhone /></dt><dd><a href={`tel:${x.phone}`}>{x.phone}</a></dd></div>}
                  {x.email && <div><dt><span className="sr">Email</span><IcMail /></dt><dd><a href={`mailto:${x.email}`}>{x.email}</a></dd></div>}
                  {room && <div><dt><span className="sr">Phòng</span><IcDoor /></dt><dd>Phòng {room}</dd></div>}
                  {x.idNumber && <div><dt><span className="sr">CCCD</span><IcFile /></dt><dd className="ct-num">CCCD/CMND: {x.idNumber}</dd></div>}
                </dl>

                {cs.length > 0 && (
                  <div className="tn-contracts">
                    <div className="ct-sub">Hợp đồng ({cs.length})</div>
                    <ul>
                      {cs.slice(0, 3).map((c) => (
                        <li key={c.id}>
                          <Link to={`/app/contracts/${c.id}/edit`}>
                            <span className="ct-num">{c.code ?? "Hợp đồng"}</span>
                            <span className={"tag " + c.status}>{statusText[c.status] ?? c.status}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {cs.length > 3 && <Link to="/app/contracts" className="ct-sub">+{cs.length - 3} hợp đồng khác</Link>}
                  </div>
                )}
                {x.notes ? <p className="ct-notes">{x.notes}</p> : null}

                {canEdit && (
                  <footer className="ct-actions">
                    <button className="ghost" onClick={() => { setErr(""); setForm({ id: x.id, name: x.name, phone: x.phone ?? "", email: x.email ?? "", idNumber: x.idNumber ?? "", roomId: x.roomId ?? "", notes: x.notes ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t("edit")}</button>
                    <button className="ghost danger" onClick={() => remove(x)}>{t("delete")}</button>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

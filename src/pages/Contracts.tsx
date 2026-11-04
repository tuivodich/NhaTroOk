import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAudit } from "../lib/audit";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { isAdminRole, type ContractDoc, type RoomDoc, type TenantDoc, type ContractStatus } from "../lib/types";
import MoneyText from "../components/MoneyText";
import NumInput from "../components/NumInput";

interface F {
  id?: string;
  tenantId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  rent: number | "";
  deposit: number | "";
  status: ContractStatus;
  notes: string;
}
const empty: F = { tenantId: "", roomId: "", startDate: "", endDate: "", rent: "", deposit: "", status: "draft", notes: "" };

const EXPIRING_DAYS = 30;
type Filter = "all" | ContractStatus | "expiring";

/* ---------- Icon SVG (stroke 1.75, cùng một bộ) ---------- */
const Svg = ({ children }: { children: ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
const IcUser = () => <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></Svg>;
const IcDoor = () => <Svg><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" /><path d="M3 21h18" /><circle cx="15" cy="12" r=".6" /></Svg>;
const IcCal = () => <Svg><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
const IcCash = () => <Svg><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></Svg>;
const IcWarn = () => <Svg><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17.5v.01" /></Svg>;
const IcSearch = () => <Svg><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
const IcPlus = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>;
const IcFile = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
);

/* ---------- Helpers ---------- */
function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr + "T00:00:00");
  if (isNaN(end.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}
const fmtDate = (s: string) => (s ? s.split("-").reverse().join("/") : "—");

export default function Contracts() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const audit = useAudit();
  const canEdit = isAdminRole(profile?.role);
  const { data: contracts, loading } = useCollection<ContractDoc>("contracts");
  const { data: tenants } = useCollection<TenantDoc>("tenants");
  const { data: rooms } = useCollection<RoomDoc>("rooms");
  const [form, setForm] = useState<F | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const tenantName = (id: string) => tenants.find((x) => x.id === id)?.name ?? id;
  const roomCode = (id: string) => rooms.find((x) => x.id === id)?.code ?? id;
  const statusLabel = (s: ContractStatus) =>
    s === "draft" ? "Nháp" : s === "active" ? t("contractActive") : s === "expired" ? t("contractExpired") : t("contractCancelled");

  const isExpiring = (c: ContractDoc) => {
    if (c.status !== "active") return false;
    const d = daysUntil(c.endDate);
    return d !== null && d <= EXPIRING_DAYS;
  };

  const counts = useMemo(() => ({
    all: contracts.length,
    draft: contracts.filter((c) => c.status === "draft").length,
    active: contracts.filter((c) => c.status === "active").length,
    expiring: contracts.filter(isExpiring).length,
    expired: contracts.filter((c) => c.status === "expired").length,
    cancelled: contracts.filter((c) => c.status === "cancelled").length,
    monthly: contracts.filter((c) => c.status === "active").reduce((s, c) => s + (Number(c.rent) || 0), 0),
  }), [contracts]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contracts
      .filter((c) => (filter === "all" ? true : filter === "expiring" ? isExpiring(c) : c.status === filter))
      .filter((c) => {
        if (!needle) return true;
        return [c.code ?? "", tenantName(c.tenantId), roomCode(c.roomId)].some((v) => v.toLowerCase().includes(needle));
      })
      .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
  }, [contracts, filter, q, tenants, rooms]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErr(""); setBusy(true);
    try {
      if (!form.tenantId || !form.roomId) { setErr("Vui lòng chọn khách và phòng."); return; }
      if (!form.startDate || !form.endDate) { setErr("Vui lòng chọn ngày bắt đầu và kết thúc."); return; }
      if (form.endDate < form.startDate) { setErr("Ngày kết thúc phải sau ngày bắt đầu."); return; }
      if (form.rent === "" || +form.rent < 0) { setErr("Tiền thuê không hợp lệ."); return; }

      const payload: Record<string, unknown> = {
        tenantId: form.tenantId, roomId: form.roomId,
        startDate: form.startDate, endDate: form.endDate,
        rent: +form.rent, status: form.status,
      };
      if (form.deposit !== "") payload.deposit = +form.deposit;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      if (form.id) {
        await updateDoc(doc(db, "contracts", form.id), payload);
        audit("contract.update", "Sua hop dong", { type: "contract", id: form.id });
      } else {
        const ref = await addDoc(collection(db, "contracts"), payload);
        audit("contract.create", "Them hop dong", { type: "contract", id: ref.id });
      }
      setForm(null);
    } catch (ex) {
      console.error("contract save failed", ex);
      setErr("Lỗi: " + ((ex as Error)?.message ?? String(ex)));
    } finally { setBusy(false); }
  };

  const remove = async (c: ContractDoc) => {
    if (!confirm(t("deleteContractSure"))) return;
    if (!confirm("XÁC NHẬN LẦN 2: xóa hợp đồng " + (c.code ?? c.id) + "? Không thể hoàn tác.")) return;
    try {
      await deleteDoc(doc(db, "contracts", c.id));
      audit("contract.delete", "Xoa hop dong", { type: "contract", id: c.id });
    } catch (ex) {
      console.error("delete contract failed", ex);
      setErr(t("error"));
    }
  };

  const chips: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "Tất cả", n: counts.all },
    { key: "draft", label: "Nháp", n: counts.draft },
    { key: "active", label: t("contractActive"), n: counts.active },
    { key: "expiring", label: `Sắp hết hạn (≤${EXPIRING_DAYS} ngày)`, n: counts.expiring },
    { key: "expired", label: t("contractExpired"), n: counts.expired },
    { key: "cancelled", label: t("contractCancelled"), n: counts.cancelled },
  ];

  return (
    <section className="ct">
      <div className="ct-head">
        <div>
          <h2>{t("contracts")}</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Quản lý hợp đồng thuê, theo dõi thời hạn và tiền thuê.</p>
        </div>
        {canEdit && !form && (
          <button className="ct-btn-primary" onClick={() => { setErr(""); setForm({ ...empty }); }}>
            <IcPlus /> {t("addContract")}
          </button>
        )}
      </div>

      {/* Tóm tắt */}
      <div className="ct-stats">
        <div className="ct-stat"><span className="ct-stat-n">{counts.active}</span><span className="ct-stat-l">Đang hiệu lực</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{counts.draft}</span><span className="ct-stat-l">Bản nháp</span></div>
        <div className={"ct-stat" + (counts.expiring ? " warn" : "")}>
          <span className="ct-stat-n">{counts.expiring}</span><span className="ct-stat-l">Sắp hết hạn</span>
        </div>
        <div className="ct-stat"><span className="ct-stat-n ct-num"><MoneyText value={counts.monthly} /></span><span className="ct-stat-l">Tiền thuê / tháng (đang hiệu lực)</span></div>
      </div>

      {err && <p className="error" role="alert">{err}</p>}

      {/* Form */}
      {form && (
        <form className="card ct-form" onSubmit={save}>
          <h3>{form.id ? t("editContract") : t("addContract")}</h3>
          <div className="ct-grid2">
            <label>{t("contractTenant")}
              <select required value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>
                <option value="">{t("none")}</option>
                {tenants.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>{t("contractRoom")}
              <select required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                <option value="">{t("none")}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
              </select>
            </label>
            <label>{t("contractStart")}<input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label>{t("contractEnd")}<input type="date" required value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
            <label>{t("contractRent")}<NumInput min={0} value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("contractDeposit")}<NumInput min={0} value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("status")}
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })}>
                <option value="draft">Nháp</option>
                <option value="active">{t("contractActive")}</option>
                <option value="expired">{t("contractExpired")}</option>
                <option value="cancelled">{t("contractCancelled")}</option>
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

      {/* Bộ lọc */}
      {contracts.length > 0 && (
        <div className="ct-toolbar">
          <div className="ct-chips" role="group" aria-label="Lọc theo trạng thái">
            {chips.map((c) => (
              <button key={c.key} type="button" className={"ct-chip" + (filter === c.key ? " on" : "")}
                aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}>
                {c.label} <span className="ct-chip-n">{c.n}</span>
              </button>
            ))}
          </div>
          <label className="ct-search">
            <IcSearch />
            <input type="search" placeholder="Tìm mã HĐ, khách, phòng…" aria-label="Tìm hợp đồng"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      )}
      <p className="ct-count" role="status" aria-atomic="true">
        {contracts.length > 0 ? `Hiển thị ${visible.length} / ${contracts.length} hợp đồng` : ""}
      </p>

      {/* Danh sách */}
      {loading ? (
        <div className="ct-list" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="ct-card ct-skel" />)}
        </div>
      ) : contracts.length === 0 && !form ? (
        <div className="ct-empty">
          <IcFile />
          <strong>{t("noContracts")}</strong>
          <span>Hợp đồng nháp được tạo tự động khi bạn chốt một yêu cầu thuê.</span>
          <Link className="linkbtn primary" to="/app/inquiries">Đi tới Yêu cầu thuê</Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="ct-empty"><strong>Không có hợp đồng phù hợp bộ lọc.</strong>
          <button className="ghost" onClick={() => { setFilter("all"); setQ(""); }}>Xóa bộ lọc</button></div>
      ) : (
        <div className="ct-list">
          {visible.map((c) => {
            const left = c.status === "active" ? daysUntil(c.endDate) : null;
            const overdue = left !== null && left < 0;
            const soon = left !== null && left >= 0 && left <= EXPIRING_DAYS;
            return (
              <article className={"ct-card" + (overdue ? " bad" : soon ? " warn" : "")} key={c.id}>
                <header className="ct-card-head">
                  <div className="ct-code">{c.code ?? "Hợp đồng"}</div>
                  <span className={"tag " + c.status}>{statusLabel(c.status)}</span>
                </header>

                <dl className="ct-meta">
                  <div><dt><IcUser /><span className="sr">Khách thuê</span></dt><dd>{tenantName(c.tenantId)}</dd></div>
                  <div><dt><IcDoor /><span className="sr">Phòng</span></dt><dd>Phòng {roomCode(c.roomId)}</dd></div>
                  <div><dt><IcCal /><span className="sr">Thời hạn</span></dt><dd className="ct-num">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</dd></div>
                  <div><dt><IcCash /><span className="sr">Tiền thuê</span></dt>
                    <dd className="ct-num"><strong><MoneyText value={c.rent} /></strong> / {t("month")}
                      {c.deposit ? <span className="ct-sub"> · cọc <MoneyText value={c.deposit} /></span> : null}</dd></div>
                </dl>

                {(overdue || soon) && (
                  <div className={"ct-alert " + (overdue ? "bad" : "warn")} role="note">
                    <IcWarn />
                    {overdue ? `Đã quá hạn ${Math.abs(left!)} ngày — cần gia hạn hoặc kết thúc` : left === 0 ? "Hết hạn hôm nay" : `Còn ${left} ngày hết hạn`}
                  </div>
                )}
                {c.notes ? <p className="ct-notes">{c.notes}</p> : null}

                <footer className="ct-actions">
                  <Link className="ct-btn" to={`/app/contracts/${c.id}/edit`}>
                    {c.status === "draft" ? "Hoàn thiện & kích hoạt" : "Chi tiết"}
                  </Link>
                  {canEdit && (
                    <>
                      <button className="ghost" onClick={() => { setErr(""); setForm({ id: c.id, tenantId: c.tenantId, roomId: c.roomId, startDate: c.startDate, endDate: c.endDate, rent: c.rent, deposit: c.deposit ?? "", status: c.status, notes: c.notes ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t("edit")}</button>
                      <button className="ghost danger" onClick={() => remove(c)}>{t("delete")}</button>
                    </>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

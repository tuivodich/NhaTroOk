import { useState, type FormEvent } from "react";
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
const empty: F = { tenantId: "", roomId: "", startDate: "", endDate: "", rent: "", deposit: "", status: "active", notes: "" };

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

  const tenantName = (id: string) => tenants.find((x) => x.id === id)?.name ?? id;
  const roomCode = (id: string) => rooms.find((x) => x.id === id)?.code ?? id;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErr(""); setBusy(true);
    try {
      if (!form.tenantId || !form.roomId) { setErr("Vui lòng chọn khách và phòng."); return; }
      if (!form.startDate || !form.endDate) { setErr("Vui lòng chọn ngày bắt đầu và kết thúc."); return; }
      if (form.rent === "" || +form.rent < 0) { setErr("Tiền thuê không hợp lệ."); return; }

      const payload: Record<string, unknown> = {
        tenantId: form.tenantId,
        roomId: form.roomId,
        startDate: form.startDate,
        endDate: form.endDate,
        rent: +form.rent,
        status: form.status,
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
    try {
      await deleteDoc(doc(db, "contracts", c.id));
      audit("contract.delete", "Xoa hop dong", { type: "contract", id: c.id });
    } catch (ex) {
      console.error("delete contract failed", ex);
      setErr(t("error"));
    }
  };

  return (
    <section>
      <div className="row between">
        <h2>{t("contracts")}</h2>
        {canEdit && !form && <button onClick={() => { setErr(""); setForm({ ...empty }); }}>+ {t("addContract")}</button>}
      </div>
      {err && <p className="error">{err}</p>}

      {form && (
        <form className="card" onSubmit={save}>
          <h3>{form.id ? t("editContract") : t("addContract")}</h3>
          <div className="row">
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
          </div>
          <div className="row">
            <label>{t("contractStart")}<input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label>{t("contractEnd")}<input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
          </div>
          <div className="row">
            <label>{t("contractRent")}<NumInput min={0} value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("contractDeposit")}<NumInput min={0} value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value === "" ? "" : +e.target.value })} /></label>
            <label>{t("status")}
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })}>
                <option value="active">{t("contractActive")}</option>
                <option value="expired">{t("contractExpired")}</option>
                <option value="cancelled">{t("contractCancelled")}</option>
              </select>
            </label>
          </div>
          <label>{t("notes")}<textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="row">
            <button type="submit" disabled={busy}>{t("save")}</button>
            <button type="button" className="ghost" onClick={() => { setForm(null); setErr(""); }}>{t("cancel")}</button>
          </div>
        </form>
      )}

      {loading ? <p>{t("loading")}</p> : contracts.length === 0 && !form ? (
        <p className="info">{t("noContracts")}</p>
      ) : (
        <div className="list">
          {contracts.map((c) => (
            <div className="card" key={c.id}>
              <div className="row between">
                <strong>{tenantName(c.tenantId)} · {roomCode(c.roomId)}</strong>
                {canEdit && (
                  <div className="row">
                    <button className="ghost" onClick={() => { setErr(""); setForm({ id: c.id, tenantId: c.tenantId, roomId: c.roomId, startDate: c.startDate, endDate: c.endDate, rent: c.rent, deposit: c.deposit ?? "", status: c.status, notes: c.notes ?? "" }); }}>{t("edit")}</button>
                    <button className="ghost danger" onClick={() => remove(c)}>{t("delete")}</button>
                  </div>
                )}
              </div>
              <div className="row wrap">
                <span>{c.startDate} → {c.endDate}</span>
                <span><MoneyText value={c.rent} /> / {t("month")}</span>
                <span className={"tag " + c.status}>
                  {c.status === "active" ? t("contractActive") : c.status === "expired" ? t("contractExpired") : t("contractCancelled")}
                </span>
              </div>
              {c.notes ? <small>{c.notes}</small> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { doc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useAuth } from "../lib/auth";
import { useAudit } from "../lib/audit";
import { useBillingSettings } from "../lib/useBillingSettings";
import { computeBill, dueDateFor, invoiceId, readingId } from "../lib/billing";
import { isAdminRole, type ContractDoc, type InvoiceDoc, type MeterReadingDoc, type RoomDoc, type TenantDoc } from "../lib/types";
import MoneyText from "../components/MoneyText";
import { IcDoor, IcUser, IcWarn } from "../components/Icons";

type Draft = { e?: string; w?: string; pe?: string; pw?: string };
const num = (s: string | undefined): number | null => (s === undefined || s.trim() === "" ? null : Number(s));
const fmtMonth = (m: string) => m.split("-").reverse().join("/");

export default function Billing() {
  const { user, profile } = useAuth();
  const audit = useAudit();
  const isAdmin = isAdminRole(profile?.role);
  const { settings, configured, loading: loadingSettings } = useBillingSettings();
  const { data: contracts } = useCollection<ContractDoc>("contracts");
  const { data: rooms } = useCollection<RoomDoc>("rooms");
  const { data: tenants } = useCollection<TenantDoc>("tenants");
  const { data: invoices } = useCollection<InvoiceDoc>("invoices");
  const { data: readings } = useCollection<MeterReadingDoc>("meterReadings");

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);

  const rows = useMemo(() => {
    const list = contracts.filter((c) => c.status === "active");
    return list.map((c) => {
      const room = rooms.find((r) => r.id === c.roomId);
      const tenant = tenants.find((t) => t.id === c.tenantId);
      const saved = readings.find((r) => r.id === readingId(c.roomId, month));
      const existing = invoices.find((i) => i.id === invoiceId(c.id, month) || (i.roomId === c.roomId && i.month === month));
      // chỉ số kỳ trước: kỳ gần nhất < tháng đang lập; nếu chưa có thì dùng chỉ số đầu của phòng
      const prevR = readings.filter((r) => r.roomId === c.roomId && r.month < month).sort((a, b) => b.month.localeCompare(a.month))[0];
      const knownPrevE = prevR?.electric ?? room?.meter?.electricStart;
      const knownPrevW = prevR?.water ?? room?.meter?.waterStart;
      const d = draft[c.id] ?? {};
      const prevE = knownPrevE ?? num(d.pe);
      const prevW = knownPrevW ?? num(d.pw);
      const currE = num(d.e ?? (saved ? String(saved.electric) : undefined));
      const currW = num(d.w ?? (saved ? String(saved.water) : undefined));
      let bill = null as ReturnType<typeof computeBill> | null;
      if (prevE != null && prevW != null && currE != null && currW != null)
        bill = computeBill({ rent: c.rent, electricPrev: prevE, electricCurr: currE, waterPrev: prevW, waterCurr: currW, settings });
      return { c, room, tenant, saved, existing, d, knownPrevE, knownPrevW, prevE, prevW, currE, currW, bill };
    }).sort((a, b) => (a.room?.code ?? "").localeCompare(b.room?.code ?? "", "vi", { numeric: true }));
  }, [contracts, rooms, tenants, invoices, readings, draft, month, settings]);

  const ready = rows.filter((r) => !r.existing && r.bill?.ok);
  const done = rows.filter((r) => r.existing).length;
  const estimate = ready.reduce((s, r) => s + (r.bill?.total ?? 0), 0);

  const set = (id: string, patch: Draft) => setDraft((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const flash = (text: string, isBad = false) => { setMsg(text); setBad(isBad); };

  const saveReadings = async () => {
    flash("");
    const targets = rows.filter((r) => !r.existing && r.currE != null && r.currW != null);
    if (targets.length === 0) return flash("Chưa có chỉ số nào để lưu.", true);
    setBusy(true);
    try {
      for (const r of targets) {
        await setDoc(doc(db, "meterReadings", readingId(r.c.roomId, month)),
          { roomId: r.c.roomId, month, electric: r.currE, water: r.currW, createdAt: serverTimestamp() }, { merge: true });
      }
      flash(`Đã lưu chỉ số cho ${targets.length} phòng.`);
    } catch (ex) { flash("Lỗi: " + ((ex as Error)?.message ?? String(ex)), true); }
    finally { setBusy(false); }
  };

  const createAll = async () => {
    flash("");
    if (!user) return;
    if (!configured) return flash("Chưa cấu hình đơn giá điện nước. Admin cần lưu đơn giá trước.", true);
    if (ready.length === 0) return flash("Không có phòng nào sẵn sàng. Nhập đủ chỉ số điện và nước.", true);
    if (!window.confirm(`Tạo ${ready.length} hóa đơn kỳ ${fmtMonth(month)}?\n\nTổng tạm tính: ${new Intl.NumberFormat("vi-VN").format(estimate)} đ\nPhòng đã có hóa đơn sẽ được bỏ qua.`)) return;
    if (!window.confirm(`XÁC NHẬN LẦN 2: lập ${ready.length} hóa đơn kỳ ${fmtMonth(month)}?`)) return;
    setBusy(true);
    let created = 0, skipped = 0;
    const failed: string[] = [];
    for (const r of ready) {
      const b = r.bill!;
      const invRef = doc(db, "invoices", invoiceId(r.c.id, month));
      try {
        const made = await runTransaction(db, async (tx) => {
          const snap = await tx.get(invRef);               // đọc trước khi ghi
          if (snap.exists()) return false;                 // chống tạo trùng
          tx.set(invRef, {
            roomId: r.c.roomId, tenantId: r.c.tenantId, contractId: r.c.id, month,
            items: b.items, total: b.total, status: "unpaid",
            dueDate: dueDateFor(month, r.c.dueDay),
            meter: { electricPrev: r.prevE!, electricCurr: r.currE!, waterPrev: r.prevW!, waterCurr: r.currW! },
            createdAt: serverTimestamp(),
          });
          tx.set(doc(db, "meterReadings", readingId(r.c.roomId, month)),
            { roomId: r.c.roomId, month, electric: r.currE, water: r.currW, createdAt: serverTimestamp() }, { merge: true });
          return true;
        });
        if (made) created++; else skipped++;
      } catch (ex) {
        console.error("create invoice failed", r.c.id, ex);
        failed.push(r.room?.code ?? r.c.roomId);
      }
    }
    audit("billing.batch", `Lap ${created} hoa don ky ${month}`, { type: "invoice", id: month });
    setBusy(false);
    setDraft({});
    const parts = [`Đã tạo ${created} hóa đơn`];
    if (skipped) parts.push(`bỏ qua ${skipped} (đã có)`);
    if (failed.length) parts.push(`lỗi ${failed.length} phòng: ${failed.join(", ")}`);
    flash(parts.join(" · ") + ".", failed.length > 0);
  };

  return (
    <section className="ct">
      <div className="ct-head">
        <div>
          <h2>Lập hóa đơn tháng</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Nhập chỉ số điện nước của từng phòng đang thuê, hệ thống tính tiền và tạo hóa đơn hàng loạt. Hạn thanh toán là ngày hạn của hợp đồng trong tháng sau.</p>
        </div>
        {isAdmin && <Link className="ct-btn" to="/app/settings/billing">Đơn giá điện nước</Link>}
      </div>

      {!loadingSettings && !configured && (
        <p className="ct-alert warn" role="note" style={{ marginBottom: 12 }}>
          <IcWarn /> Chưa cấu hình đơn giá điện nước.{isAdmin ? <> <Link to="/app/settings/billing">Thiết lập ngay</Link></> : " Hãy nhờ admin thiết lập."}
        </p>
      )}

      <div className="ct-toolbar">
        <label className="bl-month">Kỳ hóa đơn
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setDraft({}); setMsg(""); }} />
        </label>
        <div className="ct-actions" style={{ margin: 0, padding: 0 }}>
          <button className="ghost" onClick={saveReadings} disabled={busy}>Lưu chỉ số</button>
          <button onClick={createAll} disabled={busy || ready.length === 0}>{busy ? "Đang tạo…" : `Tạo ${ready.length} hóa đơn`}</button>
        </div>
      </div>

      <div className="ct-stats" style={{ marginTop: 14 }}>
        <div className="ct-stat"><span className="ct-stat-n">{rows.length}</span><span className="ct-stat-l">Phòng đang thuê</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{ready.length}</span><span className="ct-stat-l">Sẵn sàng lập hóa đơn</span></div>
        <div className="ct-stat"><span className="ct-stat-n">{done}</span><span className="ct-stat-l">Đã lập kỳ {fmtMonth(month)}</span></div>
        <div className="ct-stat"><span className="ct-stat-n ct-num"><MoneyText value={estimate} /></span><span className="ct-stat-l">Tạm tính sẽ lập</span></div>
      </div>

      {msg && <p className={bad ? "error" : "info"} role="status" style={{ marginTop: 12 }}>{msg}</p>}

      {rows.length === 0 ? (
        <div className="ct-empty" style={{ marginTop: 14 }}>
          <strong>Chưa có hợp đồng hiệu lực.</strong>
          <span>Chỉ phòng có hợp đồng "Hiệu lực" mới được lập hóa đơn.</span>
          <Link className="linkbtn primary" to="/app/contracts">Đi tới Hợp đồng</Link>
        </div>
      ) : (
        <div className="ct-list" style={{ marginTop: 14 }}>
          {rows.map((r) => {
            const locked = !!r.existing;
            const b = r.bill;
            return (
              <article className={"ct-card" + (locked ? "" : b && !b.ok ? " bad" : b?.ok ? "" : " warn")} key={r.c.id}>
                <header className="ct-card-head">
                  <div>
                    <div className="ct-code"><IcDoor /> Phòng {r.room?.code ?? r.c.roomId}</div>
                    <div className="ct-sub"><IcUser /> {r.tenant?.name ?? "—"}</div>
                  </div>
                  {locked ? <span className="tag active">Đã lập hóa đơn</span> : b?.ok ? <span className="tag draft">Sẵn sàng</span> : <span className="tag unpaid">Chưa đủ chỉ số</span>}
                </header>

                <div className="bl-meters">
                  <div className="bl-meter">
                    <span className="bl-k">Điện (kWh)</span>
                    {r.knownPrevE == null
                      ? <label className="bl-in">Chỉ số đầu<input type="number" min={0} inputMode="decimal" disabled={locked} value={r.d.pe ?? ""} onChange={(e) => set(r.c.id, { pe: e.target.value })} /></label>
                      : <span className="ct-sub ct-num">Kỳ trước: {r.knownPrevE}</span>}
                    <label className="bl-in">Chỉ số mới
                      <input type="number" min={0} inputMode="decimal" disabled={locked} value={r.d.e ?? (r.saved ? String(r.saved.electric) : "")} onChange={(e) => set(r.c.id, { e: e.target.value })} />
                    </label>
                  </div>
                  <div className="bl-meter">
                    <span className="bl-k">Nước (m³)</span>
                    {r.knownPrevW == null
                      ? <label className="bl-in">Chỉ số đầu<input type="number" min={0} inputMode="decimal" disabled={locked} value={r.d.pw ?? ""} onChange={(e) => set(r.c.id, { pw: e.target.value })} /></label>
                      : <span className="ct-sub ct-num">Kỳ trước: {r.knownPrevW}</span>}
                    <label className="bl-in">Chỉ số mới
                      <input type="number" min={0} inputMode="decimal" disabled={locked} value={r.d.w ?? (r.saved ? String(r.saved.water) : "")} onChange={(e) => set(r.c.id, { w: e.target.value })} />
                    </label>
                  </div>
                </div>

                {locked ? (
                  <div className="bl-total"><span className="ct-sub">Tổng hóa đơn</span><b className="ct-num"><MoneyText value={r.existing!.total} /></b></div>
                ) : b?.ok ? (
                  <>
                    <ul className="bl-items">
                      {b.items.map((it, i) => <li key={i}><span>{it.label}</span><span className="ct-num"><MoneyText value={it.amount} /></span></li>)}
                    </ul>
                    <div className="bl-total"><span className="ct-sub">Tổng cộng</span><b className="ct-num"><MoneyText value={b.total} /></b></div>
                  </>
                ) : b && !b.ok ? (
                  <div className="ct-alert bad" role="alert"><IcWarn />{b.error}</div>
                ) : (
                  <div className="ct-sub">Nhập chỉ số điện và nước để xem tiền.</div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

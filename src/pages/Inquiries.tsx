import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom"; // [PHASE4A]
import { IcPhone, IcMail, IcDoor, IcCal } from "../components/Icons";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { InquiryDoc, InquiryStatus } from "../lib/types";
import { useAuth } from "../lib/auth";
import { convertInquiry, convertErrorMessage } from "../lib/convertInquiry"; // [PHASE4A]

const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  scheduled: "Đã hẹn",
  converted: "Đã chốt",
  rejected: "Từ chối",
};

export default function Inquiries() {
  const auth = useAuth() as any;
  const uid: string | null = auth?.profile?.uid ?? auth?.user?.uid ?? null;
  const navigate = useNavigate(); // [PHASE4A]

  const [list, setList] = useState<InquiryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InquiryStatus | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const q = query(collection(db, "inquiries"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q,
      (snap) => {
        setList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InquiryDoc)));
        setLoading(false);
      },
      (e) => { console.error(e); setErr(e.message); setLoading(false); }
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list
      .filter((x) => filter === "all" || x.status === filter)
      .filter((x) => !needle || [x.name, x.phone, x.email ?? "", x.roomCode ?? ""].some((v) => v.toLowerCase().includes(needle)));
  }, [list, filter, q]);

  const update = async (it: InquiryDoc, p: Partial<InquiryDoc>) => {
    if (p.status !== undefined && p.status !== it.status) {
      const userOk = window.confirm(
        "Xác nhận chuyển trạng thái?\n\n" +
        "Khách hàng: " + it.name + "\n" +
        "Phòng: " + (it.roomCode ?? it.roomId ?? "—") + "\n\n" +
        "Từ: " + STATUS_LABEL[it.status] + "\n" +
        "Sang: " + STATUS_LABEL[p.status] + "\n\n" +
        "Bấm OK để xác nhận, Hủy để giữ nguyên."
      );
      if (!userOk) return;
    }
    setBusy(it.id);
    // [PHASE4A] Chốt lần đầu → tạo tenant + hợp đồng nháp qua convertInquiry
    if (p.status === "converted" && it.status !== "converted" && !it.contractId && uid) {
      try {
        const r = await convertInquiry(db, { inquiryId: it.id, actorUid: uid, actorEmail: auth?.user?.email });
        navigate(`/app/contracts/${r.contractId}/edit?fromInquiry=1`);
      } catch (e: any) {
        console.error("[Inquiry] convert failed:", e);
        alert(convertErrorMessage(e));
      } finally { setBusy(null); }
      return;
    }
    try {
      const statusChanged = p.status !== undefined && p.status !== it.status;
      console.log("[Inquiry] updating", {
        id: it.id,
        from: it.status,
        to: p.status ?? it.status,
        statusChanged,
        roomId: it.roomId,
        roomCode: it.roomCode,
        patch: p,
      });

      let resolvedRoomId: string | null = it.roomId ?? null;
      if (!resolvedRoomId && it.roomCode) {
        const snap = await getDocs(
          query(collection(db, "rooms"), where("code", "==", it.roomCode))
        );
        if (!snap.empty) {
          resolvedRoomId = snap.docs[0].id;
          console.log("[Inquiry] resolved roomId by code:", resolvedRoomId);
        }
      }

      let siblingCount = 0;
      if (
        statusChanged &&
        it.status === "converted" &&
        p.status !== "converted" &&
        resolvedRoomId
      ) {
        const sibSnap = await getDocs(
          query(
            collection(db, "inquiries"),
            where("roomId", "==", resolvedRoomId),
            where("status", "==", "converted")
          )
        );
        siblingCount = sibSnap.docs.filter((d) => d.id !== it.id).length;
        console.log("[Inquiry] siblings still converted:", siblingCount);
      }

      await runTransaction(db, async (tx) => {
        let roomRef: any = null;
        let roomSnap: any = null;

        if (resolvedRoomId && statusChanged) {
          roomRef = doc(db, "rooms", resolvedRoomId);
          roomSnap = await tx.get(roomRef);
          console.log("[Inquiry] room snapshot", {
            id: resolvedRoomId,
            exists: roomSnap.exists(),
            status: roomSnap.exists() ? roomSnap.data().status : null,
          });
        }

        tx.update(doc(db, "inquiries", it.id), {
          ...p,
          updatedAt: serverTimestamp(),
          ...(uid ? { handledBy: uid } : {}),
        });

        if (roomRef && roomSnap && roomSnap.exists() && statusChanged) {
          const cur = roomSnap.data().status;

          if (p.status === "converted" && cur === "vacant") {
            tx.update(roomRef, { status: "occupied" });
            console.log("[Inquiry] room -> occupied");
          } else if (
            it.status === "converted" &&
            p.status !== "converted" &&
            cur === "occupied" &&
            siblingCount === 0
          ) {
            tx.update(roomRef, { status: "vacant" });
            console.log("[Inquiry] room -> vacant (no sibling converted)");
          } else if (
            it.status === "converted" &&
            p.status !== "converted" &&
            cur === "occupied" &&
            siblingCount > 0
          ) {
            console.log(
              "[Inquiry] room stays occupied — still has",
              siblingCount,
              "converted inquiry"
            );
          } else {
            console.log("[Inquiry] room unchanged (no condition matched)", {
              cur,
              from: it.status,
              to: p.status,
            });
          }
        } else if (!statusChanged) {
          console.log("[Inquiry] status unchanged — room untouched");
        }
      });
      console.log("[Inquiry] transaction committed OK");
    } catch (e: any) {
      console.error("[Inquiry] failed:", e);
      alert(e?.message || "Cập nhật thất bại");
    } finally {
      setBusy(null);
    }
  };

  const fmtTime = (ts: any) =>
    ts?.seconds ? new Date(ts.seconds * 1000).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "";
  const initial = (n: string) => (n.trim()[0] || "?").toUpperCase();
  const keys = Object.keys(STATUS_LABEL) as InquiryStatus[];

  return (
    <section className="ct iq">
      <div className="ct-head">
        <div>
          <h2>Yêu cầu thuê</h2>
          <p className="info" style={{ margin: "2px 0 0" }}>Khách gửi từ trang phòng. Liên hệ, hẹn xem và chốt thành hợp đồng.</p>
        </div>
      </div>

      {err && <p className="error" role="alert">{err}</p>}

      <div className="ct-toolbar">
        <div className="ct-chips" role="group" aria-label="Lọc theo trạng thái">
          <button type="button" className={"ct-chip" + (filter === "all" ? " on" : "")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            Tất cả <span className="ct-chip-n">{list.length}</span>
          </button>
          {keys.map((k) => (
            <button key={k} type="button" className={"ct-chip" + (filter === k ? " on" : "")} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {STATUS_LABEL[k]} <span className="ct-chip-n">{list.filter((x) => x.status === k).length}</span>
            </button>
          ))}
        </div>
        <label className="ct-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" placeholder="Tìm tên, SĐT, phòng…" aria-label="Tìm yêu cầu" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <p className="ct-count" role="status" aria-atomic="true">
        {!loading && list.length > 0 ? `Hiển thị ${filtered.length} / ${list.length} yêu cầu` : ""}
      </p>

      {loading ? (
        <div className="ct-list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="ct-card ct-skel" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="ct-empty">
          <strong>{list.length === 0 ? "Chưa có yêu cầu nào." : "Không có yêu cầu phù hợp bộ lọc."}</strong>
          {list.length === 0
            ? <span>Yêu cầu sẽ xuất hiện khi khách gửi form ở trang chi tiết phòng đang trống.</span>
            : <button className="ghost" onClick={() => { setFilter("all"); setQ(""); }}>Xóa bộ lọc</button>}
        </div>
      ) : (
        <div className="ct-list">
          {filtered.map((it) => (
            <article className={"ct-card iq-" + it.status} key={it.id} aria-busy={busy === it.id}>
              <header className="ct-card-head">
                <div className="iq-who">
                  <span className="iq-avatar" aria-hidden="true">{initial(it.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="ct-code" style={{ overflowWrap: "anywhere" }}>{it.name}</div>
                    <div className="ct-sub">{fmtTime(it.createdAt)}</div>
                  </div>
                </div>
                <span className={"tag iqs-" + it.status}>{STATUS_LABEL[it.status]}</span>
              </header>

              <dl className="ct-meta">
                <div><dt><span className="sr">Điện thoại</span><IcPhone /></dt><dd><a href={`tel:${it.phone}`}>{it.phone}</a></dd></div>
                {it.email ? <div><dt><span className="sr">Email</span><IcMail /></dt><dd><a href={`mailto:${it.email}`}>{it.email}</a></dd></div> : null}
                <div><dt><span className="sr">Phòng</span><IcDoor /></dt><dd>Phòng {it.roomCode ?? it.roomId ?? "—"}</dd></div>
                {it.preferredDate ? <div><dt><span className="sr">Hẹn xem</span><IcCal /></dt><dd className="ct-num">Hẹn xem: {it.preferredDate.split("-").reverse().join("/")}</dd></div> : null}
              </dl>

              {it.message && <p className="iq-msg">{it.message}</p>}

              <div className="iq-controls">
                <label className="iq-field">Trạng thái
                  <select value={it.status} disabled={busy === it.id}
                    onChange={(e) => update(it, { status: e.target.value as InquiryStatus })}>
                    {keys.map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
                  </select>
                </label>
                <label className="iq-field">Ghi chú nội bộ
                  <input placeholder="Thêm ghi chú…" defaultValue={it.notes ?? ""}
                    onBlur={(e) => { if ((e.target.value || "") !== (it.notes ?? "")) update(it, { notes: e.target.value }); }} />
                </label>
              </div>

              {(it.contractId || it.status === "converted") && (
                <footer className="ct-actions">
                  {it.contractId
                    ? <Link className="ct-btn" to={`/app/contracts/${it.contractId}/edit`}>Xem hợp đồng</Link>
                    : <Link className="ct-btn" to={`/app/inquiries/${it.id}/convert`}>Tạo hợp đồng cho yêu cầu này</Link>}
                </footer>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

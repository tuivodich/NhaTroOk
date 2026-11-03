import { useEffect, useMemo, useState } from "react";
import {
  collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, runTransaction, getDocs, where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { InquiryDoc, InquiryStatus } from "../lib/types";
import { useAuth } from "../lib/auth";

const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  scheduled: "Đã hẹn",
  converted: "Đã chốt",
  rejected: "Từ chối",
};

const STATUS_COLOR: Record<InquiryStatus, string> = {
  new: "#1976d2",
  contacted: "#f57c00",
  scheduled: "#7b1fa2",
  converted: "#388e3c",
  rejected: "#c62828",
};

export default function Inquiries() {
  const auth = useAuth() as any;
  const uid: string | null = auth?.profile?.uid ?? auth?.user?.uid ?? null;

  const [list, setList] = useState<InquiryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InquiryStatus | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    return filter === "all" ? list : list.filter((x) => x.status === filter);
  }, [list, filter]);

  const update = async (it: InquiryDoc, p: Partial<InquiryDoc>) => {
    setBusy(it.id);
    try {
      console.log("[Inquiry] updating", { id: it.id, roomId: it.roomId, roomCode: it.roomCode, patch: p });

      // Fallback: nếu thiếu roomId mà có roomCode thì tìm room theo code
      let resolvedRoomId: string | null = it.roomId ?? null;
      if (p.status === "converted" && !resolvedRoomId && it.roomCode) {
        console.log("[Inquiry] no roomId, lookup by roomCode:", it.roomCode);
        const snap = await getDocs(query(collection(db, "rooms"), where("code", "==", it.roomCode)));
        if (!snap.empty) {
          resolvedRoomId = snap.docs[0].id;
          console.log("[Inquiry] resolved roomId by code:", resolvedRoomId);
        } else {
          console.warn("[Inquiry] no room found with code", it.roomCode);
        }
      }

      await runTransaction(db, async (tx) => {
        // ============ READS FIRST (Firestore bắt buộc) ============
        let roomRef: any = null;
        let roomSnap: any = null;
        if (p.status === "converted" && resolvedRoomId) {
          roomRef = doc(db, "rooms", resolvedRoomId);
          roomSnap = await tx.get(roomRef);
          console.log("[Inquiry] room snapshot", {
            id: resolvedRoomId,
            exists: roomSnap.exists(),
            status: roomSnap.exists() ? roomSnap.data().status : null,
          });
        }

        // ============ WRITES AFTER ============
        tx.update(doc(db, "inquiries", it.id), {
          ...p,
          updatedAt: serverTimestamp(),
          ...(uid ? { handledBy: uid } : {}),
        });

        if (roomRef && roomSnap && roomSnap.exists() && roomSnap.data().status === "vacant") {
          tx.update(roomRef, { status: "occupied" });
          console.log("[Inquiry] scheduling room -> occupied");
        } else if (p.status === "converted") {
          console.warn("[Inquiry] room NOT updated. Reasons:", {
            hasRoomRef: !!roomRef,
            roomExists: roomSnap?.exists?.() ?? false,
            currentStatus: roomSnap?.data?.()?.status ?? null,
          });
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

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Yêu cầu thuê</h1>

      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>Lọc trạng thái:&nbsp;
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">Tất cả ({list.length})</option>
            {(Object.keys(STATUS_LABEL) as InquiryStatus[]).map((k) => (
              <option key={k} value={k}>
                {STATUS_LABEL[k]} ({list.filter((x) => x.status === k).length})
              </option>
            ))}
          </select>
        </label>
      </div>

      {err && <div style={{ color: "#c62828", marginBottom: 12 }}>{err}</div>}
      {loading && <div>Đang tải…</div>}
      {!loading && filtered.length === 0 && <div style={{ opacity: 0.6 }}>Chưa có yêu cầu nào.</div>}

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((it) => (
          <div key={it.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <strong>{it.name}</strong> — <a href={`tel:${it.phone}`}>{it.phone}</a>
                {it.email ? <> · <a href={`mailto:${it.email}`}>{it.email}</a></> : null}
              </div>
              <span style={{
                background: STATUS_COLOR[it.status], color: "#fff",
                padding: "2px 10px", borderRadius: 12, fontSize: 12,
              }}>
                {STATUS_LABEL[it.status]}
              </span>
            </div>

            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
              Phòng: {it.roomCode ?? it.roomId ?? "—"}
              {it.preferredDate ? ` · Hẹn xem: ${it.preferredDate}` : ""}
              {it.createdAt?.seconds
                ? ` · Gửi: ${new Date(it.createdAt.seconds * 1000).toLocaleString("vi-VN")}`
                : ""}
            </div>

            {it.message && (
              <div style={{ marginTop: 8, padding: 8, background: "#fafafa", borderRadius: 6, whiteSpace: "pre-wrap" }}>
                {it.message}
              </div>
            )}

            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select value={it.status} disabled={busy === it.id}
                onChange={(e) => update(it, { status: e.target.value as InquiryStatus })}>
                {(Object.keys(STATUS_LABEL) as InquiryStatus[]).map((k) => (
                  <option key={k} value={k}>{STATUS_LABEL[k]}</option>
                ))}
              </select>
              <input
                placeholder="Ghi chú nội bộ…"
                defaultValue={it.notes ?? ""}
                onBlur={(e) => {
                  if ((e.target.value || "") !== (it.notes ?? "")) update(it, { notes: e.target.value });
                }}
                style={{ flex: 1, minWidth: 220, padding: "6px 8px" }}
              />
            </div>

            {it.handledBy && (
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>Xử lý bởi: {it.handledBy}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// [PHASE4A] Chốt inquiry → tạo Tenant (link-or-create) + Contract draft + room occupied.
import { doc, runTransaction, collection, serverTimestamp, type Firestore } from "firebase/firestore";
import { readSeq, writeSeq } from "./counters";

export function normalizePhone(raw: string): string {
  let p = (raw || "").replace(/[^\d+]/g, "");
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  else if (p.startsWith("84") && p.length >= 11) p = "0" + p.slice(2);
  return p.replace(/\D/g, "");
}

export type ConvertResult = { contractId: string; tenantId: string };

export async function convertInquiry(
  db: Firestore,
  opts: { inquiryId: string; actorUid: string; actorEmail?: string | null }
): Promise<ConvertResult> {
  const { inquiryId, actorUid, actorEmail } = opts;
  const year = new Date().getFullYear();
  const inqRef = doc(db, "inquiries", inquiryId);
  const contractRef = doc(collection(db, "contracts"));
  const auditRef = doc(collection(db, "auditLogs"));

  return runTransaction(db, async (tx) => {
    // ===== READS =====
    const inqSnap = await tx.get(inqRef);
    if (!inqSnap.exists()) throw new Error("INQUIRY_NOT_FOUND");
    const inq = inqSnap.data() as any;
    if (inq.contractId) throw new Error("ALREADY_CONVERTED");
    if (!inq.roomId) throw new Error("ROOM_NOT_FOUND");

    const roomRef = doc(db, "rooms", inq.roomId);
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error("ROOM_NOT_FOUND");
    const room = roomSnap.data() as any;

    const phone = normalizePhone(inq.phone);
    const tenantId = phone ? "t_" + phone : "t_inq_" + inquiryId;
    const tenantRef = doc(db, "tenants", tenantId);
    const tenantSnap = await tx.get(tenantRef);

    const cSeq = await readSeq(tx, db, "contracts_" + year);
    const tSeq = tenantSnap.exists() ? 0 : await readSeq(tx, db, "tenants");

    // ===== WRITES =====
    const contractCode = `HD-${year}-${String(cSeq + 1).padStart(4, "0")}`;
    writeSeq(tx, db, "contracts_" + year, cSeq + 1);

    if (tenantSnap.exists()) {
      const ids: string[] = (tenantSnap.data() as any).contractIds ?? [];
      tx.update(tenantRef, {
        contractIds: [...ids, contractRef.id],
        roomId: inq.roomId,
        status: "active",
        updatedAt: serverTimestamp(),
      });
    } else {
      writeSeq(tx, db, "tenants", tSeq + 1);
      tx.set(tenantRef, {
        code: `TN-${String(tSeq + 1).padStart(4, "0")}`,
        name: inq.name,
        phone: inq.phone,
        email: inq.email ?? null,
        roomId: inq.roomId,
        inquiryId,
        contractIds: [contractRef.id],
        status: "active",
        createdBy: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const tenantUserId: string | undefined = tenantSnap.exists() ? (tenantSnap.data() as any).userId : undefined;
    tx.set(contractRef, {
      ...(tenantUserId ? { userId: tenantUserId } : {}), // [PHASE4C]
      code: contractCode,
      tenantId,
      roomId: inq.roomId,
      inquiryId,
      startDate: inq.preferredDate || "",
      endDate: "",
      rent: Number(room.baseRent) || 0,
      deposit: Number(room.deposit) || 0,
      status: "draft",
      paymentCycle: "monthly",
      dueDay: 5,
      timeline: [{ at: Date.now(), by: actorUid, action: "created_from_inquiry" }],
      createdAt: serverTimestamp(),
    });

    if (room.status === "vacant") tx.update(roomRef, { status: "occupied" });

    tx.update(inqRef, {
      status: "converted",
      contractId: contractRef.id,
      handledBy: actorUid,
      updatedAt: serverTimestamp(),
    });

    tx.set(auditRef, {
      action: "convertInquiryToContract",
      message: `Chốt yêu cầu ${inq.name} → ${contractCode}`,
      target: { type: "contract", id: contractRef.id },
      uid: actorUid,
      email: actorEmail ?? null,
      at: serverTimestamp(),
    });

    return { contractId: contractRef.id, tenantId };
  });
}

export function convertErrorMessage(e: any): string {
  const m = String(e?.message || e);
  if (m.includes("ALREADY_CONVERTED")) return "Yêu cầu này đã được chốt và có hợp đồng.";
  if (m.includes("INQUIRY_NOT_FOUND")) return "Không tìm thấy yêu cầu.";
  if (m.includes("ROOM_NOT_FOUND")) return "Yêu cầu chưa gắn phòng hợp lệ.";
  return m;
}

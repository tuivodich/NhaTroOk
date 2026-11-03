#!/usr/bin/env node
// Fix: read-before-write transaction + fallback lookup roomCode + rich logging
import fs from "node:fs";

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const f = "src/pages/Inquiries.tsx";

if (!fs.existsSync(f)) { console.error("✗ missing", f); process.exit(1); }
fs.copyFileSync(f, `${f}.bak.${TS}`);
console.log(`✓ backup ${f}.bak.${TS}`);

let src = fs.readFileSync(f, "utf8");

// ---- 1) Đảm bảo imports ----
const needImports = ["runTransaction", "getDocs", "query", "where", "collection"];
const im = src.match(/import\s*\{([^}]+)\}\s*from\s*["']firebase\/firestore["'];?/);
if (!im) { console.error("✗ không tìm thấy import firebase/firestore"); process.exit(1); }
const parts = im[1].split(",").map(s => s.trim()).filter(Boolean);
for (const n of needImports) if (!parts.includes(n)) parts.push(n);
src = src.replace(im[0], `import {\n  ${parts.join(", ")},\n} from "firebase/firestore";`);
console.log("✓ imports updated");

// ---- 2) Thay toàn bộ hàm update ----
const fnRe = /const update = async \(it: InquiryDoc, p: Partial<InquiryDoc>\) => \{[\s\S]*?\n  \};/;

const newFn = `const update = async (it: InquiryDoc, p: Partial<InquiryDoc>) => {
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
  };`;

if (fnRe.test(src)) {
  src = src.replace(fnRe, newFn);
  console.log("✓ Đã thay hàm update");
} else {
  console.error("✗ Không match được hàm update — paste 30 dòng quanh 'const update' cho tôi");
  process.exit(1);
}

fs.writeFileSync(f, src, "utf8");
console.log(`\n✅ Đã ghi ${f}`);
console.log("\nTiếp theo:");
console.log("  1) npm run build");
console.log("  2) npm run dev (hoặc deploy)");
console.log("  3) Mở F12 → Console → thử đổi 1 inquiry sang 'Đã chốt'");
console.log("  4) Xem log: nếu thấy 'transaction committed OK' + 'room -> occupied' → FIX THÀNH CÔNG");
console.log("  5) Nếu vẫn thấy 'room NOT updated. Reasons: ...' → gửi log đó cho tôi");
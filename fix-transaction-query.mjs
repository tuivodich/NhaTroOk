#!/usr/bin/env node
// Fix TS: tx.get(query) không hợp lệ → dùng getDocs(query) ngoài transaction
import fs from "node:fs";

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const f = "src/pages/Inquiries.tsx";

if (!fs.existsSync(f)) { console.error("✗ missing", f); process.exit(1); }
fs.copyFileSync(f, `${f}.bak.${TS}`);
console.log(`✓ backup ${f}.bak.${TS}`);

let src = fs.readFileSync(f, "utf8");

// ---- 1) Đảm bảo imports ----
const needImports = ["getDocs", "query", "where", "collection", "runTransaction", "serverTimestamp", "doc", "updateDoc", "onSnapshot", "orderBy"];
const im = src.match(/import\s*\{([^}]+)\}\s*from\s*["']firebase\/firestore["'];?/);
if (!im) { console.error("✗ không thấy import firebase/firestore"); process.exit(1); }
const parts = im[1].split(",").map(s => s.trim()).filter(Boolean);
for (const n of needImports) if (!parts.includes(n)) parts.push(n);
src = src.replace(im[0], `import {\n  ${parts.join(", ")},\n} from "firebase/firestore";`);
console.log("✓ imports updated");

// ---- 2) Thay hàm update ----
const fnRe = /const update = async \(it: InquiryDoc, p: Partial<InquiryDoc>\) => \{[\s\S]*?\n  \};/;
if (!fnRe.test(src)) {
  console.error("✗ Không match được hàm update. Paste 40 dòng quanh 'const update' cho tôi.");
  process.exit(1);
}

const newFn = `const update = async (it: InquiryDoc, p: Partial<InquiryDoc>) => {
    setBusy(it.id);
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

      // Fallback: nếu thiếu roomId mà có roomCode thì tra room theo code
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

      // Đếm sibling converted TRƯỚC transaction (ngoài tx)
      // Lý do: tx.get() chỉ nhận DocumentReference, không nhận Query
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
        // ============ READS (trước mọi write) ============
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

        // ============ WRITES (sau reads) ============
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
  };`;

src = src.replace(fnRe, newFn);
fs.writeFileSync(f, src, "utf8");
console.log(`✓ Đã thay hàm update trong ${f}`);
console.log("\n✅ Done. Tiếp theo:");
console.log("  1) npm run build  → phải xanh");
console.log("  2) npm run dev → test: converted -> rejected, room về vacant");
console.log("  3) git add -A && git commit -m 'Fix TS: tx.get(query) -> getDocs(query)' && git push");
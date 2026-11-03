#!/usr/bin/env node
// Fix: revert room status khi inquiry rời "converted"
// + không đụng room khi chỉ sửa notes (status unchanged)
import fs from "node:fs";

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const f = "src/pages/Inquiries.tsx";

if (!fs.existsSync(f)) { console.error("✗ missing", f); process.exit(1); }
fs.copyFileSync(f, `${f}.bak.${TS}`);
console.log(`✓ backup ${f}.bak.${TS}`);

let src = fs.readFileSync(f, "utf8");

// ---- 1) Đảm bảo imports cho query ----
const needImports = ["getDocs", "query", "where", "collection", "runTransaction", "serverTimestamp"];
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
        const snap = await getDocs(query(collection(db, "rooms"), where("code", "==", it.roomCode)));
        if (!snap.empty) {
          resolvedRoomId = snap.docs[0].id;
          console.log("[Inquiry] resolved roomId by code:", resolvedRoomId);
        }
      }

      await runTransaction(db, async (tx) => {
        // ============ READS (trước mọi write) ============
        let roomRef: any = null;
        let roomSnap: any = null;
        let siblingConverted: any[] = [];

        if (resolvedRoomId && statusChanged) {
          roomRef = doc(db, "rooms", resolvedRoomId);
          roomSnap = await tx.get(roomRef);
          console.log("[Inquiry] room snapshot", {
            id: resolvedRoomId,
            exists: roomSnap.exists(),
            status: roomSnap.exists() ? roomSnap.data().status : null,
          });

          // Nếu đang RỜI "converted" → kiểm tra còn inquiry converted nào khác cùng phòng không
          if (it.status === "converted" && p.status !== "converted") {
            const q = query(
              collection(db, "inquiries"),
              where("roomId", "==", resolvedRoomId),
              where("status", "==", "converted")
            );
            const sib = await tx.get(q);
            siblingConverted = sib.docs.filter((d: any) => d.id !== it.id);
            console.log("[Inquiry] siblings still converted:", siblingConverted.length);
          }
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
            cur === "occupied"
          ) {
            if (siblingConverted.length === 0) {
              tx.update(roomRef, { status: "vacant" });
              console.log("[Inquiry] room -> vacant (no sibling converted)");
            } else {
              console.log(
                "[Inquiry] room stays occupied — still has",
                siblingConverted.length,
                "converted inquiry"
              );
            }
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

// ---- 3) Ghi rules mới ra file để user paste tay ----
const rulesSnippet = `# === Phase 3 (v3) — match /rooms ===
# THAY THẾ block match /rooms/{id} cũ bằng block dưới đây
# Cho phép staff đổi status CẢ HAI CHIỀU vacant <-> occupied
# (admin đã có "allow write: if isAdmin()" nên không bị ảnh hưởng)

    match /rooms/{id} {
      allow read: if isSignedIn() || resource.data.published == true;
      allow write: if isAdmin();

      // Staff: chỉ được đổi status (một trong hai chiều)
      allow update: if isSignedIn()
        && userRole() in ['admin','staff']
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
        && (
          (resource.data.status == 'vacant' && request.resource.data.status == 'occupied')
          ||
          (resource.data.status == 'occupied' && request.resource.data.status == 'vacant')
        );
    }
`;
fs.writeFileSync("firestore-rules-phase3-v3.txt", rulesSnippet, "utf8");
console.log("✓ wrote firestore-rules-phase3-v3.txt (rules cho phép revert)");

console.log("\n✅ Done.");
console.log("Tiếp theo:");
console.log("  1) npm run build");
console.log("  2) Publish firestore-rules-phase3-v3.txt lên Console (bắt buộc — nếu không staff revert sẽ bị permission-denied)");
console.log("  3) Test: converted -> rejected  => phòng về vacant");
console.log("  4) Test: rejected  -> converted => phòng về occupied");
console.log("  5) Test: chỉ sửa ghi chú       => phòng KHÔNG đổi");
#!/usr/bin/env node
// Fix Phase 3 v2 — xử lý 3 vấn đề:
//   #1 Nút "Đăng nhập" hiện sai trên /phong
//   #2 Inquiries: khi status → "converted" phải set room.status = "occupied" (transaction)
//   #3 Firestore rules chặn create inquiry khi phòng không vacant + client check
import fs from "node:fs";
import path from "node:path";

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const bak = (f) => { try { if (fs.existsSync(f)) fs.copyFileSync(f, `${f}.bak.${TS}`); } catch {} };
const write = (f, c) => { fs.mkdirSync(path.dirname(f), { recursive: true }); bak(f); fs.writeFileSync(f, c, "utf8"); console.log("✓ wrote  ", f); };

const patch = (f, fn) => {
  if (!fs.existsSync(f)) { console.error("✗ missing", f); return false; }
  bak(f);
  const src = fs.readFileSync(f, "utf8");
  const out = fn(src);
  if (out == null || out === src) { console.log("· no-change", f); return false; }
  fs.writeFileSync(f, out, "utf8");
  console.log("✓ patched", f);
  return true;
};

/* ============================================================
 * TASK 2 — Inquiries.tsx: transaction converted → occupied
 * ========================================================== */
patch("src/pages/Inquiries.tsx", (src) => {
  if (src.includes("runTransaction")) { console.log("  · already patched"); return null; }

  // 2a. Thêm runTransaction vào import
  const im = src.match(/import\s*\{([^}]+)\}\s*from\s*["']firebase\/firestore["'];?/);
  if (!im) { console.error("  ✗ không tìm thấy import firebase/firestore"); return null; }
  const parts = im[1].split(",").map(s => s.trim()).filter(Boolean);
  if (!parts.includes("runTransaction")) parts.push("runTransaction");
  src = src.replace(im[0], `import {\n  ${parts.join(", ")},\n} from "firebase/firestore";`);

  // 2b. Thay hàm update
  const oldFn = `  const update = async (id: string, p: Partial<InquiryDoc>) => {
    setBusy(id);
    try {
      await updateDoc(doc(db, "inquiries", id), {
        ...p,
        updatedAt: serverTimestamp(),
        ...(uid ? { handledBy: uid } : {}),
      });
    } catch (e: any) {
      alert(e?.message || "Cập nhật thất bại");
    } finally {
      setBusy(null);
    }
  };`;

  const newFn = `  const update = async (it: InquiryDoc, p: Partial<InquiryDoc>) => {
    setBusy(it.id);
    try {
      await runTransaction(db, async (tx) => {
        const inquiryRef = doc(db, "inquiries", it.id);
        tx.update(inquiryRef, {
          ...p,
          updatedAt: serverTimestamp(),
          ...(uid ? { handledBy: uid } : {}),
        });
        // Khi chuyển sang "converted": đánh dấu phòng đã thuê (atomic)
        if (p.status === "converted" && it.roomId) {
          const roomRef = doc(db, "rooms", it.roomId);
          const roomSnap = await tx.get(roomRef);
          if (roomSnap.exists() && roomSnap.data().status === "vacant") {
            tx.update(roomRef, { status: "occupied" });
          }
        }
      });
    } catch (e: any) {
      alert(e?.message || "Cập nhật thất bại");
    } finally {
      setBusy(null);
    }
  };`;

  if (src.includes(oldFn)) {
    src = src.replace(oldFn, newFn);
  } else {
    const fnRe = /const update = async \(id: string, p: Partial<InquiryDoc>\) => \{[\s\S]*?\n  \};/;
    if (!fnRe.test(src)) { console.error("  ✗ không tìm thấy hàm update"); return null; }
    src = src.replace(fnRe, newFn);
  }

  // 2c. Đổi mọi call site update(it.id, → update(it,
  src = src.replace(/update\(it\.id,/g, "update(it,");

  return src;
});

/* ============================================================
 * TASK 3a — InquiryForm.tsx: client-side check room.status
 * ========================================================== */
patch("src/components/InquiryForm.tsx", (src) => {
  if (src.includes("Phòng này hiện không còn trống")) { console.log("  · already patched"); return null; }

  const anchor = `    if (p.replace(/\\D/g, "").length < 8) { setErr("Số điện thoại không hợp lệ."); return; }`;
  if (!src.includes(anchor)) { console.error("  ✗ không tìm thấy anchor phone-check"); return null; }

  const add = anchor + `

    if (room.status !== "vacant") {
      setErr("Phòng này hiện không còn trống. Vui lòng chọn phòng khác.");
      return;
    }`;

  return src.replace(anchor, add);
});

/* ============================================================
 * TASK 3b — Firestore rules (ghi ra file để paste tay)
 * ========================================================== */
write("firestore-rules-phase3.txt", `# === Phase 3 (v2) — Rules chặn create inquiry khi phòng không vacant ===
# THAY THẾ block match /inquiries cũ trong Firestore Rules

    match /inquiries/{id} {
      // Public create — chỉ khi phòng tương ứng còn trống
      allow create: if
        request.resource.data.keys().hasAll(['name','phone','status','createdAt','roomId'])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 100
        && request.resource.data.phone is string
        && request.resource.data.phone.size() >= 8
        && request.resource.data.phone.size() <= 30
        && request.resource.data.status == 'new'
        && get(/databases/$(database)/documents/rooms/$(request.resource.data.roomId)).data.status == 'vacant';

      // Staff/admin đọc & cập nhật
      allow read, update, delete: if
        isSignedIn()
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','staff'];
    }
`);

/* ============================================================
 * TASK 1 — Nút "Đăng nhập" (best-effort auto-patch)
 * ========================================================== */
function fixLoginButtons() {
  const dirs = ["src/pages", "src/pages/public", "src/components"];
  const files = [];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith(".tsx")) files.push(path.join(d, f));
    }
  }

  let totalPatched = 0, totalFound = 0, manualNeeded = [];

  for (const f of files) {
    let src = fs.readFileSync(f, "utf8");
    if (!src.includes("Đăng nhập")) continue;
    totalFound++;

    console.log(`\n📄 ${f}`);

    const hasUseAuth = /useAuth\s*\(\s*\)/.test(src);
    if (!hasUseAuth) {
      console.log(`   ⚠ Không có useAuth() — cần sửa tay`);
      manualNeeded.push({ file: f, reason: "no useAuth" });
      continue;
    }

    const patterns = [
      /<Link\s+to=["']\/login["'][^>]*>\s*Đăng nhập\s*<\/Link>/,
      /<NavLink\s+to=["']\/login["'][^>]*>\s*Đăng nhập\s*<\/NavLink>/,
      /<a\s+href=["']\/login["'][^>]*>\s*Đăng nhập\s*<\/a>/,
      /<Link\s+to=["'][^"']*login[^"']*["'][^>]*>\s*Đăng nhập\s*<\/Link>/,
    ];

    let match = null;
    for (const p of patterns) { const m = src.match(p); if (m) { match = m[0]; break; } }

    if (!match) {
      console.log(`   ⚠ Không match pattern. Đoạn xung quanh "Đăng nhập":`);
      const idx = src.indexOf("Đăng nhập");
      console.log("   ---");
      console.log(src.substring(Math.max(0, idx - 200), idx + 60));
      console.log("   ---");
      manualNeeded.push({ file: f, reason: "pattern not matched", idx });
      continue;
    }

    const idx = src.indexOf(match);
    const before = src.substring(Math.max(0, idx - 40), idx);

    // Đã wrap sẵn?
    if (/\{!\s*\w+(?:\?*\.?\w*)?\s*&&\s*$/.test(before)) {
      console.log(`   · Đã được wrap sẵn, bỏ qua`);
      continue;
    }
    // Đang ở trong JSX expression phức tạp ({cond && ...} hoặc {cond ? ...} hoặc ... : ...)
    if (/\{[^{}]*&&\s*$/.test(before) || /\{[^{}]*\?\s*$/.test(before) || /\{[^{}]*:\s*$/.test(before)) {
      console.log(`   ⚠ Nút nằm trong JSX expression phức tạp — cần sửa tay`);
      console.log(`   Context trước match: "${before.replace(/\n/g, " ")}"`);
      manualNeeded.push({ file: f, reason: "already inside JSX expr", before });
      continue;
    }

    // Tìm user var
    let userVar = "user";
    const dm = src.match(/const\s*\{([^}]+)\}\s*=\s*useAuth\s*\(\s*\)/);

    if (dm) {
      if (!/\buser\b/.test(dm[1])) {
        src = src.replace(dm[0], `const {${dm[1].trim()}, user } = useAuth()`);
        console.log(`   · Đã thêm "user" vào destructure`);
      }
    } else {
      const vm = src.match(/const\s+(\w+)\s*=\s*useAuth\s*\(\s*\)/);
      if (!vm) {
        console.log(`   ⚠ Không tìm được biến useAuth — cần sửa tay`);
        manualNeeded.push({ file: f, reason: "useAuth var not found" });
        continue;
      }
      userVar = `${vm[1]}?.user`;
      console.log(`   · Sẽ dùng ${userVar}`);
    }

    const wrapped = `{!${userVar} && (\n            ${match}\n          )}`;
    src = src.replace(match, wrapped);

    bak(f);
    fs.writeFileSync(f, src, "utf8");
    console.log(`   ✓ Đã wrap nút với {!${userVar} && (...)}`);
    totalPatched++;
  }

  console.log(`\n📊 Tổng: ${totalFound} file có "Đăng nhập", đã patch ${totalPatched}`);
  if (totalFound === 0) {
    console.log(`\n⚠ Không file .tsx nào trong src/pages hoặc src/components chứa "Đăng nhập"`);
    console.log(`   Kiểm tra thêm App.tsx, StaffShell.tsx, TenantShell.tsx`);
  }
  if (manualNeeded.length > 0) {
    console.log(`\n📋 Cần sửa tay các file sau:`);
    for (const it of manualNeeded) console.log(`   - ${it.file}  (${it.reason})`);
  }
}

fixLoginButtons();

console.log("\n============================================================");
console.log("✅ Done Phase 3 fix (v2).");
console.log("============================================================");
console.log("Tiếp theo:");
console.log("  1) npm run build  → phải xanh");
console.log("  2) Publish firestore-rules-phase3.txt lên Firebase Console");
console.log("  3) Test: đổi inquiry → converted → phòng tự 'occupied'");
console.log("  4) Thử gửi form cho phòng occupied → phải bị chặn");
console.log("  5) git add -A && git commit -m 'Phase 3 fix' && git push");
console.log("============================================================\n");
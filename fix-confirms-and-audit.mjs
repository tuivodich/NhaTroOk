#!/usr/bin/env node
import fs from "node:fs";

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const bak = (f) => { if (fs.existsSync(f)) fs.copyFileSync(f, `${f}.bak.${TS}`); };
let ok = true;

// =============== FEATURE 1: Inquiries.tsx ===============
(function () {
  const f = "src/pages/Inquiries.tsx";
  if (!fs.existsSync(f)) { console.error("X missing", f); ok = false; return; }
  let src = fs.readFileSync(f, "utf8");
  if (src.includes("Xác nhận chuyển trạng thái?")) { console.log("· Inquiries.tsx: đã có confirm, skip"); return; }
  const anchor = `  const update = async (it: InquiryDoc, p: Partial<InquiryDoc>) => {
    setBusy(it.id);
    try {`;
  if (!src.includes(anchor)) { console.error("X Inquiries.tsx: không tìm thấy anchor hàm update."); ok = false; return; }
  const newHead = `  const update = async (it: InquiryDoc, p: Partial<InquiryDoc>) => {
    if (p.status !== undefined && p.status !== it.status) {
      const userOk = window.confirm(
        "Xác nhận chuyển trạng thái?\\n\\n" +
        "Khách hàng: " + it.name + "\\n" +
        "Phòng: " + (it.roomCode ?? it.roomId ?? "—") + "\\n\\n" +
        "Từ: " + STATUS_LABEL[it.status] + "\\n" +
        "Sang: " + STATUS_LABEL[p.status] + "\\n\\n" +
        "Bấm OK để xác nhận, Hủy để giữ nguyên."
      );
      if (!userOk) return;
    }
    setBusy(it.id);
    try {`;
  src = src.replace(anchor, newHead);
  bak(f); fs.writeFileSync(f, src, "utf8");
  console.log("✓ Inquiries.tsx: đã thêm confirm khi đổi trạng thái");
})();

// =============== FEATURE 2: Users.tsx ===============
(function () {
  const f = "src/pages/Users.tsx";
  if (!fs.existsSync(f)) { console.error("X missing", f); ok = false; return; }
  let src = fs.readFileSync(f, "utf8");
  if (src.includes("Xác nhận đổi vai trò")) { console.log("· Users.tsx: đã có confirm, skip"); return; }
  const patterns = [
    /(const\s+(\w*(?:[Rr]ole\w*|updateRole|changeRole|setRole))\s*=\s*(?:async\s+)?\(\s*(\w+)\s*(?::\s*[^,)]+)?\s*,\s*(\w+)\s*(?::\s*[^,)]+)?\s*\)\s*(?::[^=]+)?=>\s*\{)/,
    /((?:async\s+)?function\s+(\w*(?:[Rr]ole\w*|updateRole|changeRole|setRole))\s*\(\s*(\w+)\s*(?::\s*[^,)]+)?\s*,\s*(\w+)\s*(?::\s*[^,)]+)?\s*\)\s*\{)/,
  ];
  let patched = false;
  for (const re of patterns) {
    const m = src.match(re);
    if (!m) continue;
    const [full, , fnName, arg1, arg2] = m;
    console.log(`  · Users.tsx: matched "${fnName}" (args: ${arg1}, ${arg2})`);
    const confirm = `if (!window.confirm("Xác nhận đổi vai trò?\\n\\nĐổi thành: " + ${arg2} + "\\n\\nBấm OK để xác nhận, Hủy để giữ nguyên.")) return;`;
    src = src.replace(full, `${full}\n      ${confirm}`);
    bak(f); fs.writeFileSync(f, src, "utf8");
    console.log("✓ Users.tsx: đã thêm confirm khi đổi vai trò");
    patched = true;
    break;
  }
  if (!patched) {
    console.error("X Users.tsx: không match được hàm đổi role.");
    console.error("  Get-Content src\\pages\\Users.tsx");
    ok = false;
  }
})();

// =============== FEATURE 3: AuditLog.tsx ===============
(function () {
  const f = "src/pages/AuditLog.tsx";
  if (!fs.existsSync(f)) { console.error("X missing", f); ok = false; return; }
  let src = fs.readFileSync(f, "utf8");
  const hasDeleteUI = /Xóa nhật ký|purgeAudit|purgeAllLogs|deleteAllLogs|clearLogs/i.test(src);
  const hasConfirm = /Xác nhận xóa|window\.confirm[^)]*xóa/i.test(src);
  if (hasDeleteUI && hasConfirm) { console.log("· AuditLog.tsx: đã có delete + confirm, skip"); return; }
  if (hasDeleteUI && !hasConfirm) {
    console.log("  · AuditLog.tsx: có delete nhưng thiếu confirm, đang thêm...");
    const clickRe = /(onClick=\{\s*(?:async\s+)?\(\s*\)\s*=>\s*\{)/;
    const m = src.match(clickRe);
    if (m) {
      const confirm = `if (!window.confirm("Xác nhận xóa nhật ký?\\n\\nHành động này không thể hoàn tác.\\n\\nBấm OK để tiếp tục.")) return; `;
      src = src.replace(m[0], m[0] + confirm);
      bak(f); fs.writeFileSync(f, src, "utf8");
      console.log("✓ AuditLog.tsx: đã thêm confirm cho delete button");
      return;
    }
    console.error("X AuditLog.tsx: có delete nhưng không match onClick.");
    console.error("  Get-Content src\\pages\\AuditLog.tsx");
    ok = false;
    return;
  }
  console.log("  · AuditLog.tsx: chưa có delete, đang thêm button + purge 2 lớp...");
  const neededImports = ["addDoc", "writeBatch", "getDocs", "collection", "serverTimestamp"];
  const im = src.match(/import\s*\{([^}]+)\}\s*from\s*["']firebase\/firestore["'];?/);
  if (!im) { console.error("X AuditLog.tsx: không có import firebase/firestore"); ok = false; return; }
  const parts = im[1].split(",").map(s => s.trim()).filter(Boolean);
  for (const n of neededImports) if (!parts.includes(n)) parts.push(n);
  src = src.replace(im[0], `import {\n  ${parts.join(", ")},\n} from "firebase/firestore";`);
  const retMatch = src.match(/^(\s*return\s*\()/m);
  if (!retMatch) { console.error("X AuditLog.tsx: không có 'return ('"); ok = false; return; }
  const ind = retMatch[1].match(/^\s*/)?.[0] || "  ";
  const purgeFn = `${ind}const purgeAllLogs = async () => {
${ind}  if (!window.confirm("Xóa toàn bộ nhật ký?\\n\\nHành động này không thể hoàn tác.\\n\\nBấm OK để tiếp tục.")) return;
${ind}  if (!window.confirm("XÁC NHẬN LẦN 2:\\n\\nChắc chắn xóa toàn bộ nhật ký?")) return;
${ind}  try {
${ind}    const snap = await getDocs(collection(db, "auditLogs"));
${ind}    const total = snap.size;
${ind}    if (total === 0) { alert("Không có nhật ký."); return; }
${ind}    let count = 0;
${ind}    let batch = writeBatch(db);
${ind}    const promises: Promise<void>[] = [];
${ind}    for (const d of snap.docs) {
${ind}      batch.delete(d.ref);
${ind}      count++;
${ind}      if (count === 500) {
${ind}        promises.push(batch.commit());
${ind}        batch = writeBatch(db);
${ind}        count = 0;
${ind}      }
${ind}    }
${ind}    if (count > 0) promises.push(batch.commit());
${ind}    await Promise.all(promises);
${ind}    try {
${ind}      await addDoc(collection(db, "auditLogs"), {
${ind}        action: "purgeAuditLogs",
${ind}        count: total,
${ind}        createdAt: serverTimestamp(),
${ind}      });
${ind}    } catch {}
${ind}    alert("Đã xóa " + total + " nhật ký.");
${ind}  } catch (e: any) {
${ind}    console.error(e);
${ind}    alert("Xóa thất bại: " + (e?.message || "unknown"));
${ind}  }
${ind}};

${retMatch[1]}`;
  src = src.replace(retMatch[0], purgeFn);
  const h1Match = src.match(/(<h1[^>]*>[\s\S]*?<\/h1>)/);
  const btn = `
        <button
          onClick={purgeAllLogs}
          style={{ padding: "8px 16px", background: "#c62828", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", marginTop: 12, fontSize: 14 }}
        >
          Xóa toàn bộ nhật ký
        </button>`;
  if (!h1Match) { console.error("X AuditLog.tsx: không tìm thấy <h1>."); console.error("  Get-Content src\\pages\\AuditLog.tsx"); ok = false; return; }
  src = src.replace(h1Match[1], h1Match[1] + btn);
  bak(f); fs.writeFileSync(f, src, "utf8");
  console.log("✓ AuditLog.tsx: đã thêm nút Xóa toàn bộ nhật ký (2 lớp confirm)");
})();

// Rules snippet
fs.writeFileSync("firestore-rules-audit-delete.txt", `# Them allow delete cho auditLogs

    match /auditLogs/{id} {
      allow read: if isAdmin();
      allow create: if isSignedIn();
      allow delete: if isAdmin();
    }
`, "utf8");
console.log("✓ Đã ghi firestore-rules-audit-delete.txt");

console.log("\n============================================================");
console.log(ok ? "DONE - cả 3 tính năng đã patch" : "Một số tính năng chưa patch được");
console.log("============================================================");
process.exit(ok ? 0 : 1);

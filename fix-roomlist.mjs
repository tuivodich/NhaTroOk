#!/usr/bin/env node
// Fix Task 1 — ẩn nút "Đăng nhập" trong src/pages/public/RoomList.tsx khi user đã login
import fs from "node:fs";

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const target = "src/pages/public/RoomList.tsx";

if (!fs.existsSync(target)) { console.error("✗ not found", target); process.exit(1); }
fs.copyFileSync(target, `${target}.bak.${TS}`);
console.log("✓ backup", `${target}.bak.${TS}`);

let src = fs.readFileSync(target, "utf8");
let changed = 0;

// --- Nếu file đã được patch từ trước thì dừng ---
if (src.includes("useAuth") && /\{!\w*(authLoading|user)\b/.test(src)) {
  console.log("· File đã được patch, không làm gì.");
  process.exit(0);
}

// --- 1) Kiểm tra auth.tsx có expose "loading" không ---
let hasLoading = false;
try {
  const authSrc = fs.readFileSync("src/lib/auth.tsx", "utf8");
  if (/loading\s*[?:]\s*boolean/.test(authSrc)) hasLoading = true;
  else if (/type\s+\w*(Auth\w*Context|Context\w*Auth)\w*\s*=\s*\{[\s\S]{0,800}loading/.test(authSrc)) hasLoading = true;
  console.log(`· auth.tsx: ${hasLoading ? "CÓ" : "KHÔNG có"} "loading"`);
} catch {
  console.log("· Không đọc được auth.tsx → mặc định chỉ dùng user");
}

// --- 2) Inject import useAuth ---
if (!/from\s+["']\.\.\/\.\.\/lib\/auth["']/.test(src)) {
  const imports = [...src.matchAll(/^import[^\n]+\n/gm)];
  const last = imports[imports.length - 1];
  if (!last) { console.error("✗ Không tìm thấy import nào"); process.exit(1); }
  const at = last.index + last[0].length;
  src = src.slice(0, at) + 'import { useAuth } from "../../lib/auth";\n' + src.slice(at);
  changed++;
  console.log("✓ Đã inject import useAuth");
} else {
  console.log("· Đã có import useAuth");
}

// --- 3) Inject hook vào đầu component ---
const fnRe = /(export\s+default\s+function\s+RoomList\s*\(\s*\)\s*\{)/;
const fm = src.match(fnRe);
if (!fm) { console.error('✗ Không tìm thấy "export default function RoomList() {"'); process.exit(1); }

if (!/= useAuth\s*\(\s*\)/.test(src)) {
  const destructure = hasLoading
    ? '\n  const { user, loading: authLoading } = useAuth();'
    : '\n  const { user } = useAuth();';
  const at = fm.index + fm[0].length;
  src = src.slice(0, at) + destructure + src.slice(at);
  changed++;
  console.log(`✓ Đã inject ${hasLoading ? "{ user, loading: authLoading }" : "{ user }"} = useAuth()`);
} else {
  console.log("· Đã có useAuth() trong component");
}

// --- 4) Wrap nút login ---
// Match <Link to="/dang-nhap" ...>...</Link> — phần tag là ASCII, an toàn với encoding
const linkRe = /<Link\s+to=["']\/dang-nhap["'][^>]*>[\s\S]*?<\/Link>/;
const lm = src.match(linkRe);
if (!lm) { console.error('✗ Không tìm thấy <Link to="/dang-nhap">...</Link>'); process.exit(1); }

// Nếu đã bị wrap rồi (ví dụ {cond && ( ... )}) thì bỏ qua
const beforeLink = src.slice(Math.max(0, lm.index - 30), lm.index);
if (/\{\s*![\w]/.test(beforeLink)) {
  console.log("· Nút đã được wrap sẵn, không làm gì thêm");
  process.exit(0);
}

const cond = hasLoading ? "!authLoading && !user" : "!user";
// Tự căn lề theo dòng chứa nút
const lineStart = src.lastIndexOf("\n", lm.index) + 1;
const indent = src.slice(lineStart, lm.index).match(/^\s*/)?.[0] ?? "        ";
const wrapped = `{${cond} && (\n${indent}  ${lm[0]}\n${indent})}`;
src = src.replace(lm[0], wrapped);
changed++;
console.log(`✓ Đã wrap nút với {${cond} && (...)}`);

// --- 5) Ghi file ---
if (changed === 0) { console.log("· Không có thay đổi"); process.exit(0); }
fs.writeFileSync(target, src, "utf8");
console.log(`\n✅ Đã ghi ${target} (${changed} thay đổi)`);
console.log("\n⚠ LƯU Ý:");
console.log("  - Component RoomList đã có state `loading` cho room list,");
console.log("    nên dùng biến mới `authLoading` để tránh xung đột.");
console.log("  - Sau khi chạy, mở file kiểm tra nhanh destructure & JSX.");
import fs from "node:fs";

const f = "setup-phase3.mjs";
let src = fs.readFileSync(f, "utf8");

const bad = '{room.code}{property ? ` — ${property.name}` : ""}';
const good = '{room.code}{property ? \\` — \\${property.name}\\` : ""}';

if (src.includes(bad)) {
  src = src.replace(bad, good);
  fs.writeFileSync(f, src);
  console.log("✓ Đã fix template literal trong setup-phase3.mjs\n");
} else if (src.includes('\\` — \\${property.name}\\`')) {
  console.log("· File đã được fix từ trước, tiếp tục...\n");
} else {
  console.error("✗ Không tìm thấy pattern cần fix.");
  console.error("Mở setup-phase3.mjs, tìm dòng chứa 'property.name' và escape ` + $.");
  process.exit(1);
}

console.log("▶ Chạy setup-phase3.mjs...\n");
await import("./setup-phase3.mjs");
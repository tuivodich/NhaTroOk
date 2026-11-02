# setup-min.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path "src" | Out-Null

# ============ package.json ============
$c = @'
{
  "name": "nhatro",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.3.1",
    "react-dom": "^19.3.1"
  },
  "devDependencies": {
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.2",
    "typescript": "^7.0.2",
    "vite": "^8.3.5"
  }
}
'@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "package.json"), $c, [System.Text.UTF8Encoding]::new($false))
Write-Host "  OK package.json"

# ============ index.html ============
$c = @'
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nha tro</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
'@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "index.html"), $c, [System.Text.UTF8Encoding]::new($false))
Write-Host "  OK index.html"

# ============ tsconfig.json ============
$c = @'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
'@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "tsconfig.json"), $c, [System.Text.UTF8Encoding]::new($false))
Write-Host "  OK tsconfig.json"

# ============ src/main.tsx ============
$c = @'
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ color: "#2d6a4f" }}>Xin chao tu Nha tro!</h1>
      <p>Neu ban thay dong nay, moi thu da chay duoc.</p>
      <p style={{ color: "#666", fontSize: 14 }}>
        Buoc tiep theo: tich hop Firebase + them cac trang quan tri.
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
'@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "src\main.tsx"), $c, [System.Text.UTF8Encoding]::new($false))
Write-Host "  OK src/main.tsx"

Write-Host ""
Write-Host "Xong 4 file. Tiep theo chay:"
Write-Host "  npm install"
Write-Host "  npm run dev"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface BrandConfig {
  name: string;
  tagline: string;
  brandColor: string;
}

interface BrandContextValue extends BrandConfig {
  update: (patch: Partial<BrandConfig>) => Promise<void>;
  reset: () => void;
}

const DEFAULTS: BrandConfig = {
  name: "Nha Tro",
  tagline: "Quản lý nhà trọ gọn gàng, hiện đại",
  brandColor: "#0F766E", // Theme B: teal tin cậy
};

const KEY = "brand-config-v1";

const Ctx = createContext<BrandContextValue | null>(null);

function readStore(): BrandConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const stored = { ...DEFAULTS, ...JSON.parse(raw) } as BrandConfig;
    // Màu xanh dương mặc định cũ → chuyển sang teal của Theme B (màu tuỳ chỉnh khác giữ nguyên)
    if (String(stored.brandColor).toLowerCase() === "#2563eb") stored.brandColor = DEFAULTS.brandColor;
    return stored;
  } catch { return DEFAULTS; }
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BrandConfig>(() => readStore());

  useEffect(() => {
    document.documentElement.style.setProperty("--brand", config.brandColor);
    document.title = config.name;
  }, [config]);

  const update = async (patch: Partial<BrandConfig>) => {
    const next = { ...config, ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    setConfig(next);
  };

  const reset = () => {
    localStorage.removeItem(KEY);
    setConfig(DEFAULTS);
  };

  return <Ctx.Provider value={{ ...config, update, reset }}>{children}</Ctx.Provider>;
}

export function useBrand() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBrand must be inside BrandProvider");
  return v;
}

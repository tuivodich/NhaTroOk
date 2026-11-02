import { useBrand } from "./BrandProvider";

export function BrandLogo({ size = 28 }: { size?: number }) {
  const brand = useBrand();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill={brand.brandColor} />
      <path d="M14 34 L32 18 L50 34 V50 H40 V40 H24 V50 H14 Z" fill="#fff" opacity="0.95" />
    </svg>
  );
}

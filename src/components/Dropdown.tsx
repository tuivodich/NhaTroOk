import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export interface DdItem {
  label: string;
  to?: string;
  onClick?: () => void;
  active?: boolean;
}

export default function Dropdown({ label, items, align = "left", active = false }: {
  label: string; items: DdItem[]; align?: "left" | "right"; active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className={"dd " + (open ? "open " : "") + (active ? "active" : "")}>
      <button type="button" className="dd-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}<span className="dd-caret" />
      </button>
      <div className={"dd-menu " + (align === "right" ? "right" : "")} role="menu">
        {items.map((it) => it.to
          ? <Link key={it.label} to={it.to} role="menuitem" className={it.active ? "on" : ""} onClick={() => setOpen(false)}>{it.label}</Link>
          : <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick?.(); }}>{it.label}</button>)}
      </div>
    </div>
  );
}

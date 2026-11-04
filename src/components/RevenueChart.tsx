import { useId, useState } from "react";
import { compactVnd, niceMax, type MonthRow } from "../lib/reports";

const W = 720, H = 280, ML = 58, MR = 8, MT = 22, MB = 30;
const IW = W - ML - MR, IH = H - MT - MB, SLOT = IW / 12, BW = Math.min(24, SLOT * 0.5), GAP = 2, R = 4;
const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " đ";

/** Cột có đầu trên bo 4px, chân vuông (neo vào đường nền). */
const topRound = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(R, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

export default function RevenueChart({ rows }: { rows: MonthRow[] }) {
  const uid = useId();
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = niceMax(Math.max(...rows.map((r) => r.billed), 0));
  const y0 = MT + IH;
  const hOf = (v: number) => (v > 0 ? Math.max(3, (v / max) * IH) : 0);
  const peak = rows.reduce((b, r, i) => (r.billed > (rows[b]?.billed ?? 0) ? i : b), 0);
  const ticks = [0, 1, 2, 3, 4].map((k) => (max * k) / 4);
  const sum = rows.reduce((s, r) => s + r.billed, 0);
  const label = `Doanh thu theo tháng: tổng đã lập ${vnd(sum)}, đã thu ${vnd(rows.reduce((s, r) => s + r.collected, 0))}.`;

  return (
    <div className="rp-chart">
      <div className="rp-legend" aria-label="Chú giải">
        <span><i className="rp-sw s1" aria-hidden="true" /> Đã thu</span>
        <span><i className="rp-sw s2" aria-hidden="true" /> Còn nợ</span>
        <button type="button" className="ghost rp-toggle" aria-pressed={table} onClick={() => setTable(!table)}>{table ? "Xem biểu đồ" : "Xem dạng bảng"}</button>
      </div>

      {table ? (
        <div className="rp-table-wrap">
          <table className="rp-table">
            <thead><tr><th scope="col">Tháng</th><th scope="col">Hóa đơn</th><th scope="col">Đã lập</th><th scope="col">Đã thu</th><th scope="col">Còn nợ</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.month}><th scope="row">{i + 1}/{r.month.slice(0, 4)}</th><td className="ct-num">{r.count}</td><td className="ct-num">{vnd(r.billed)}</td><td className="ct-num">{vnd(r.collected)}</td><td className="ct-num">{vnd(r.outstanding)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rp-svgwrap">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={uid + "t"} preserveAspectRatio="xMidYMid meet">
            <title id={uid + "t"}>{label}</title>
            {ticks.map((t, k) => (
              <g key={k}>
                <line x1={ML} x2={W - MR} y1={MT + IH - (t / max) * IH} y2={MT + IH - (t / max) * IH} className="rp-grid" />
                <text x={ML - 8} y={MT + IH - (t / max) * IH + 4} textAnchor="end" className="rp-axis">{compactVnd(t)}</text>
              </g>
            ))}
            {rows.map((r, i) => {
              const cx = ML + SLOT * (i + 0.5), x = cx - BW / 2;
              const hc = hOf(r.collected), ho = hOf(r.outstanding);
              const both = hc > 0 && ho > 0;
              return (
                <g key={r.month}>
                  {active === i && <rect x={ML + SLOT * i + 2} y={MT} width={SLOT - 4} height={IH} className="rp-hl" />}
                  {hc > 0 && (ho > 0
                    ? <rect x={x} y={y0 - hc} width={BW} height={hc} className="rp-s1" />
                    : <path d={topRound(x, y0 - hc, BW, hc)} className="rp-s1" />)}
                  {ho > 0 && <path d={topRound(x, y0 - hc - ho - (both ? GAP : 0), BW, ho)} className="rp-s2" />}
                  {i === peak && r.billed > 0 && <text x={cx} y={y0 - hc - ho - (both ? GAP : 0) - 6} textAnchor="middle" className="rp-val">{compactVnd(r.billed)}</text>}
                  <text x={cx} y={H - 10} textAnchor="middle" className="rp-axis">T{i + 1}</text>
                  <rect x={ML + SLOT * i} y={MT} width={SLOT} height={IH + MB} fill="transparent" tabIndex={0}
                    aria-label={`Tháng ${i + 1}: đã lập ${vnd(r.billed)}, đã thu ${vnd(r.collected)}, còn nợ ${vnd(r.outstanding)}`}
                    onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)} onBlur={() => setActive(null)} />
                </g>
              );
            })}
            <line x1={ML} x2={W - MR} y1={y0} y2={y0} className="rp-base" />
          </svg>
          {active !== null && (
            <div className={"rp-tip" + (active >= 6 ? " left" : "")} role="status" style={{ left: `${((ML + SLOT * (active + 0.5)) / W) * 100}%` }}>
              <b>Tháng {active + 1}/{rows[active].month.slice(0, 4)}</b>
              <span><i className="rp-sw s1" aria-hidden="true" /> Đã thu <b className="ct-num">{vnd(rows[active].collected)}</b></span>
              <span><i className="rp-sw s2" aria-hidden="true" /> Còn nợ <b className="ct-num">{vnd(rows[active].outstanding)}</b></span>
              <span className="ct-sub">Đã lập {vnd(rows[active].billed)} · {rows[active].count} hóa đơn</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

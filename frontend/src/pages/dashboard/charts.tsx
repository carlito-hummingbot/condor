/**
 * Inline SVG charts for the showcase Dashboard. No library, no network: each
 * one draws the numbers it is given. Colours come from the app's tokens, so
 * the colour-blind palette and the light theme apply.
 *
 * `MiniPriceChart` is shared with Explore's Live Bots cards.
 */

const UP = "var(--color-green)";
const DOWN = "var(--color-red)";
const GRID = "var(--color-border)";
const MUTED = "var(--color-text-muted)";

function money(n: number): string {
  const abs = Math.abs(n);
  const text = abs >= 1000 && abs % 1000 === 0 ? `${abs / 1000}k` : abs.toLocaleString("en-US");
  return `${n < 0 ? "-" : ""}$${text}`;
}

/** A small line with no axes, for the KPI cards. */
export function Sparkline({ values }: { values: readonly number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * 106 + 2).toFixed(1)},${(36 - ((v - min) / span) * 32).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 110 40" className="h-10 w-[110px] shrink-0" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={UP} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Up bars above the zero line, down bars below it. */
export function BarChart({
  values,
  labels,
  labelEvery,
  ticks,
}: {
  values: readonly number[];
  labels: readonly string[];
  labelEvery: number;
  ticks: readonly number[];
}) {
  const W = 560;
  const H = 190;
  const left = 44;
  const right = 8;
  const top = 18;
  const bottom = 34;
  const hi = Math.max(...ticks, ...values);
  const lo = Math.min(0, ...values);
  const plotH = H - top - bottom;
  const y = (v: number) => top + ((hi - v) / (hi - lo)) * plotH;
  const slot = (W - left - right) / values.length;
  const bw = slot * 0.62;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bar chart (sample data)">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
          <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill={MUTED}>
            {money(t)}
          </text>
        </g>
      ))}
      <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke={MUTED} strokeWidth="1" opacity="0.6" />
      <text x={left - 6} y={y(0) + 4} textAnchor="end" fontSize="12" fill={MUTED}>
        $0
      </text>
      {values.map((v, i) => {
        const x = left + i * slot + (slot - bw) / 2;
        const top0 = v >= 0 ? y(v) : y(0);
        return (
          <rect key={i} x={x} y={top0} width={bw} height={Math.abs(y(v) - y(0))} rx="2" fill={v >= 0 ? UP : DOWN} />
        );
      })}
      {labels.map((l, i) =>
        (values.length - 1 - i) % labelEvery === 0 ? (
          <text key={i} x={left + i * slot + slot / 2} y={H - 10} textAnchor="middle" fontSize="12" fill={MUTED}>
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** The BTC line with a soft fill and a price tag on the last point. */
export function PriceChart({ values, labels }: { values: readonly number[]; labels: readonly string[] }) {
  const W = 740;
  const H = 290;
  const left = 66;
  const right = 62;
  const top = 18;
  const bottom = 34;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const x = (i: number) => left + (i / (values.length - 1)) * (W - left - right);
  const y = (v: number) => top + ((max - v) / (max - min)) * (H - top - bottom);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1)},${H - bottom} L${left},${H - bottom} Z`;
  const ticks = [0, 1, 2, 3].map((k) => min + ((max - min) * k) / 3);
  const last = values[values.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="BTC hourly price chart (sample data)">
      <defs>
        <linearGradient id="dash-btc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={UP} stopOpacity="0.3" />
          <stop offset="1" stopColor={UP} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
          <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill={MUTED}>
            ${Math.round(t).toLocaleString("en-US")}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#dash-btc-fill)" />
      <path d={line} fill="none" stroke={UP} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(last)} r="4" fill={UP} />
      <circle cx={x(values.length - 1)} cy={y(last)} r="8" fill={UP} opacity="0.25" />
      <rect x={W - right + 4} y={y(last) - 10} width="54" height="20" rx="4" fill={UP} />
      <text x={W - right + 31} y={y(last) + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#04210f">
        ${last.toLocaleString("en-US")}
      </text>
      {labels.map((l, i) =>
        (values.length - 1 - i) % 12 === 0 ? (
          <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="12" fill={MUTED}>
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

const ZONES = [
  { from: 0, to: 20, color: DOWN },
  { from: 20, to: 40, color: "#f59e0b" },
  { from: 40, to: 60, color: "#eab308" },
  { from: 60, to: 80, color: "#84cc16" },
  { from: 80, to: 100, color: UP },
] as const;

/** Fear on the left, greed on the right; 0 to 100. */
export function Gauge({ value }: { value: number }) {
  const cx = 100;
  const cy = 96;
  const r = 74;
  const at = (v: number, radius = r) => {
    const a = Math.PI * (1 - v / 100);
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)] as const;
  };
  const [nx, ny] = at(value, 52);
  return (
    <svg viewBox="0 0 200 118" className="w-[190px]" role="img" aria-label={`Fear and greed meter: ${value} (sample data)`}>
      {ZONES.map((z) => {
        const [x1, y1] = at(z.from + 0.8);
        const [x2, y2] = at(z.to - 0.8);
        return <path key={z.from} d={`M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`} fill="none" stroke={z.color} strokeWidth="12" />;
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--color-text)" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="var(--color-text)" />
      <text x="20" y="114" textAnchor="middle" fontSize="12.5" fill={MUTED}>
        Fear
      </text>
      <text x="180" y="114" textAnchor="middle" fontSize="12.5" fill={MUTED}>
        Greed
      </text>
    </svg>
  );
}

/**
 * The 7-day P&L bars on a bot card: the slot between the P&L block and the
 * Exchange row, on Explore's Live Bots and the Dashboard's bot cards alike.
 *
 * Drawn like the Dashboard's Daily P&L (Combined) — green above the zero line
 * for a good day, red below it for a bad one, one bar per day, day labels along
 * the bottom — shrunk to about 88px across the card. No gradient and no ids,
 * so several cards on a page cannot share one.
 *
 * The numbers are each card's own sample series, daily dollars oldest first,
 * with a red day or two in different places per bot. Sample data; nothing is
 * fetched.
 */
export function MiniPriceChart({
  values,
  labels,
  pair,
}: {
  values: readonly number[];
  labels: readonly string[];
  pair: string;
}) {
  const W = 300;
  const H = 88;
  const left = 34;
  const right = 6;
  const top = 12;
  const bottom = 18;
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const span = hi - lo || 1;
  const plotH = H - top - bottom;
  const y = (v: number) => top + ((hi - v) / span) * plotH;
  const slot = (W - left - right) / values.length;
  const bw = slot * 0.58;
  // Just two guide labels, top and bottom, so the dollars fit a mini card.
  const guides = [
    { v: hi, text: `+${money(hi)}` },
    { v: lo, text: lo < 0 ? `-${money(Math.abs(lo))}` : money(0) },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[88px] w-full"
      role="img"
      aria-label={`${pair} daily P&L, last 7 days, sample data`}
    >
      {guides.map((g) => (
        <text key={g.text} x={left - 4} y={y(g.v) + 3} textAnchor="end" fontSize="7.5" fill={MUTED} className="tabular-nums">
          {g.text}
        </text>
      ))}
      <line
        x1={left}
        x2={W - right}
        y1={y(0)}
        y2={y(0)}
        stroke={MUTED}
        strokeWidth="1"
        opacity="0.6"
        data-zero="true"
      />
      {values.map((v, i) => {
        const x = left + i * slot + (slot - bw) / 2;
        const top0 = v >= 0 ? y(v) : y(0);
        return (
          <rect
            key={i}
            x={x}
            y={top0}
            width={bw}
            height={Math.max(Math.abs(y(v) - y(0)), v === 0 ? 1 : 1.5)}
            rx="1"
            fill={v >= 0 ? UP : DOWN}
          />
        );
      })}
      {labels.map((label, i) => (
        <text
          key={label}
          x={left + i * slot + slot / 2}
          y={H - 5}
          textAnchor="middle"
          fontSize="7.5"
          fill={MUTED}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

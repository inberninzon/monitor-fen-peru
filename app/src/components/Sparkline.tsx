import { useState } from "react";
import { fmt } from "../data";

// Línea mínima en SVG; al pasar el cursor (o arrastrar el dedo) muestra el valor de cada punto
export function Sparkline({ v, etq, unidad, color = "var(--accent)" }: { v: number[]; etq: string[]; unidad: string; color?: string }) {
  const [i, setI] = useState<number | null>(null);
  if (v.length < 2) return null;
  const min = Math.min(...v), max = Math.max(...v);
  const y = (x: number) => (max === min ? 15 : 28 - ((x - min) / (max - min)) * 26);
  const x = (k: number) => (k / (v.length - 1)) * 100;
  const d = v.map((p, k) => `${k ? "L" : "M"}${x(k).toFixed(2)},${y(p).toFixed(2)}`).join("");
  const sel = i ?? v.length - 1;
  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setI(Math.max(0, Math.min(v.length - 1, Math.round(((e.clientX - r.left) / r.width) * (v.length - 1)))));
  };
  return (
    <div className="spark" onPointerMove={mover} onPointerLeave={() => setI(null)} aria-hidden>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none">
        <path d={`${d}L100,30L0,30Z`} fill={color} opacity={0.1} />
        <path d={d} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {min < 0 && max > 0 && <line x1={0} x2={100} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />}
      </svg>
      <span className="spark-dot" style={{ left: `${x(sel)}%`, top: `${(y(v[sel]) / 30) * 100}%`, background: color }} />
      {i !== null && (
        <span className="spark-tip" style={{ left: `${Math.min(80, Math.max(20, x(sel)))}%` }}>
          {etq[sel]} · <b>{fmt(v[sel], 1)} {unidad}</b>
        </span>
      )}
    </div>
  );
}

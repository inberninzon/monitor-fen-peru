import { useEffect, useState } from "react";
import { Kpi, valorTexto } from "../kpis";
import type { Metrica } from "../views/Mapa";
import { Sparkline } from "./Sparkline";

const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const conCursor = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

// Número que sube desde cero al aparecer
function useConteo(objetivo: number, ms = 900) {
  const [v, setV] = useState(sinMovimiento() ? objetivo : 0);
  useEffect(() => {
    if (sinMovimiento()) { setV(objetivo); return; }
    let raf = 0;
    const t0 = performance.now();
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(objetivo * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo, ms]);
  return v;
}

// Tarjeta de indicador: con cursor, el desglose aparece al pasar por encima y el clic lleva al mapa;
// en pantallas táctiles, el primer toque abre el desglose y el botón "Ver en el mapa" navega.
export function KpiCard({ k, irAlMapa, retraso = 0 }: { k: Kpi; irAlMapa: (region: string | null, m?: Metrica) => void; retraso?: number }) {
  const v = useConteo(k.valor);
  const [abierto, setAbierto] = useState(false);
  const hayDetalle = !!k.detalle?.length;
  const principal = () => {
    if (conCursor()) { if (k.metrica) irAlMapa(null, k.metrica); }
    else setAbierto(!abierto);
  };
  return (
    <div className={`kpi2 est-${k.estado}${abierto ? " abierto" : ""}${hayDetalle ? " con-detalle" : ""}`} style={{ animationDelay: `${retraso}ms` }}>
      <button className="kpi2-main" onClick={principal} aria-expanded={hayDetalle ? abierto : undefined}
        aria-label={`${k.label}: ${valorTexto(k, k.valor)} ${k.unidad ?? ""}. ${k.ctx}`}>
        <span className="kpi2-label"><i className="est-dot" aria-hidden />{k.label}</span>
        <span className="kpi2-valor num">{valorTexto(k, v)}{k.unidad && <small>{k.unidad}</small>}</span>
        {k.delta && (
          <span className={`kpi2-delta ${k.delta.igual ? "igual" : k.delta.malo ? "malo" : "bueno"}`}>
            {k.delta.igual ? "＝" : k.delta.sube ? "▲" : "▼"} {k.delta.texto}
          </span>
        )}
        <span className="kpi2-ctx">{k.ctx}</span>
      </button>
      {k.serie && <Sparkline {...k.serie} color={k.estado === "alerta" ? "var(--critical)" : k.estado === "atencion" ? "var(--accent)" : "var(--sea)"} />}
      {(hayDetalle || k.metrica) && (
        <div className="kpi2-detalle">
          {hayDetalle && <div className="kpi2-detalle-t">{k.tituloDetalle ?? "Detalle"}</div>}
          {hayDetalle && (
            <ul>
              {k.detalle!.slice(0, 8).map((d) => (
                <li key={d.nombre}>
                  {d.id
                    ? <button className="link" onClick={() => irAlMapa(d.id!, k.metrica)}>{d.nombre}</button>
                    : <span>{d.nombre}</span>}
                  <b className="num">{d.valor}</b>
                </li>
              ))}
              {k.detalle!.length > 8 && <li className="muted">y {k.detalle!.length - 8} más</li>}
            </ul>
          )}
          {k.metrica && <button className="go" onClick={() => irAlMapa(null, k.metrica)}>Ver en el mapa →</button>}
        </div>
      )}
    </div>
  );
}

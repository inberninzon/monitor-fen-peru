import { useMemo, useState } from "react";
import type * as echarts from "echarts";
import { Chart, tokens, tooltipBase } from "./Chart";
import { Info } from "./Info";
import { Datos, fechaCorta, fmt, signo } from "../data";
import { colorIndice } from "../escalas";

const COMPONENTES: { k: "lluvia" | "intensidad" | "pronostico" | "avisos" | "calor"; n: string }[] = [
  { k: "lluvia", n: "Lluvia vs normal" }, { k: "intensidad", n: "Lluvia intensa" },
  { k: "pronostico", n: "Pronóstico 7 días" }, { k: "avisos", n: "Avisos SENAMHI" }, { k: "calor", n: "Calor" },
];

export function Ficha({ id, datos, cerrar }: { id: string; datos: Datos; cerrar: () => void }) {
  const [mini, setMini] = useState(false);
  const r = datos.regiones.regiones[id];
  const serie = datos.lluvia.departamentos[id].diario;
  const hoy = datos.regiones.hoy;
  const t = tokens();
  const avisos = datos.avisos.filter((a) => a.fin >= hoy && a.departamentos.includes(id));

  const lluviaOpt = useMemo<echarts.EChartsCoreOption>(() => ({
    grid: { left: 34, right: 10, top: 28, bottom: 24 },
    legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 8, textStyle: { color: t.text2, fontSize: 11 } },
    tooltip: { ...tooltipBase(t), trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(127,127,127,.08)" } },
      formatter: (ps: any[]) => {
        const f = serie[ps[0].dataIndex];
        return `<b>${fechaCorta(f.f)}</b>${f.f >= hoy ? " · pronóstico" : ""}<br/>Lluvia: <b>${fmt(f.ll, 1)} mm</b><br/>Normal: ${fmt(f.lln, 1)} mm`;
      } },
    xAxis: { type: "category", data: serie.map((d) => d.f), axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } },
      axisLabel: { color: t.muted, fontSize: 10, interval: 19, formatter: (v: string) => fechaCorta(v) } },
    yAxis: { type: "value", axisLabel: { color: t.muted, fontSize: 10 },
      splitLine: { lineStyle: { color: t.grid } } },
    series: [
      { name: "Observada", type: "bar", barCategoryGap: "20%", data: serie.map((d) => (d.f < hoy ? d.ll : null)),
        itemStyle: { color: t.sea, borderRadius: [3, 3, 0, 0] } },
      { name: "Pronóstico", type: "bar", barGap: "-100%", data: serie.map((d) => (d.f >= hoy ? d.ll : null)),
        itemStyle: { color: t.sea, opacity: 0.4, borderColor: t.sea, borderWidth: 1, borderType: "dashed", borderRadius: [3, 3, 0, 0] } },
      { name: "Normal", type: "line", data: serie.map((d) => d.lln), showSymbol: false, lineStyle: { color: t.text, width: 1.5, type: "dashed" },
        itemStyle: { color: t.text } },
    ],
  }), [serie, hoy, t.text, t.text2, t.muted, t.grid, t.axis, t.sea]);

  const tempOpt = useMemo<echarts.EChartsCoreOption>(() => ({
    grid: { left: 34, right: 10, top: 28, bottom: 24 },
    legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 8, textStyle: { color: t.text2, fontSize: 11 } },
    tooltip: { ...tooltipBase(t), trigger: "axis", valueFormatter: (v: number) => `${fmt(v, 1)} °C` },
    xAxis: { type: "category", data: serie.map((d) => d.f), axisTick: { show: false }, axisLine: { lineStyle: { color: t.axis } },
      axisLabel: { color: t.muted, fontSize: 10, interval: 19, formatter: (v: string) => fechaCorta(v) } },
    yAxis: { type: "value", scale: true, axisLabel: { color: t.muted, fontSize: 10, formatter: "{value}°" }, splitLine: { lineStyle: { color: t.grid } } },
    series: [
      { name: "Máxima diaria", type: "line", data: serie.map((d) => d.tx), showSymbol: false, lineStyle: { color: t.accent, width: 2 }, itemStyle: { color: t.accent } },
      { name: "Normal", type: "line", data: serie.map((d) => d.txn), showSymbol: false, lineStyle: { color: t.text, width: 1.5, type: "dashed" }, itemStyle: { color: t.text } },
    ],
  }), [serie, t.text, t.text2, t.muted, t.grid, t.axis, t.accent]);

  const pct = (o: number, n: number) => (n >= 5 ? `${fmt((100 * o) / n)}%` : "—");

  return (
    <aside className={`map-ui panel ficha ${mini ? "mini" : ""}`} aria-label={`Ficha de ${r.nombre}`}>
      <button className="handle" onClick={() => setMini(!mini)} aria-label={mini ? "Expandir ficha" : "Reducir ficha"} />
      <div className="ficha-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="muted" style={{ fontSize: 12 }}>{r.zona === "Lima" ? "Lima y Callao" : `Zona ${r.zona.toLowerCase()}`} · capital {r.capital}</div>
          <h2>{r.nombre}</h2>
        </div>
        <button className="icon-btn" onClick={cerrar} aria-label="Cerrar ficha">✕</button>
      </div>
      <div className="ficha-body">
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            <div className="big-index">
              <b className="num" style={{ color: colorIndice(r.indice) === "#fde9dc" ? "var(--text-primary)" : undefined }}>{r.indice}</b>
              <span className="secondary">/ 100 · {r.tipo}</span>
            </div>
            <span style={{ flex: 1 }} />
            <Info>
              El índice resume qué tan afectada está la región hoy frente a lo normal. Cada barra muestra el aporte de un componente (0 a 1);
              los pesos están en la ficha de fuentes. Puesto {datos.regiones.ranking.indexOf(id) + 1} de 25.
            </Info>
          </div>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            {COMPONENTES.map((c) => (
              <div className="comp" key={c.k}>
                <span className="secondary">{c.n}</span>
                <span className="bar-track"><span className="bar-fill" style={{ display: "block", width: `${r.componentes[c.k] * 100}%`, background: colorIndice(r.componentes[c.k] * 75) }} /></span>
                <span className="num" style={{ textAlign: "right", fontWeight: 600 }}>{fmt(r.componentes[c.k] * 100)}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="seccion-t">Lluvia (mm por día)</div>
          <div className="stat-grid">
            <div className="stat"><div className="l">Últimos 7 días</div><div className="v num">{fmt(r.lluvia.obs7)} mm</div><div className="l">{pct(r.lluvia.obs7, r.lluvia.norm7)} de lo normal</div></div>
            <div className="stat"><div className="l">Últimos 60 días</div><div className="v num">{fmt(r.lluvia.obs60)} mm</div><div className="l">{pct(r.lluvia.obs60, r.lluvia.norm60)} de lo normal</div></div>
            <div className="stat"><div className="l">Máx. en un día (3 días)</div><div className="v num">{fmt(r.lluvia.max24)} mm</div><div className="l">en el punto más lluvioso</div></div>
            <div className="stat"><div className="l">Próximos 7 días</div><div className="v num">{fmt(r.lluvia.fc7)} mm</div><div className="l">normal {fmt(r.lluvia.normfc7)} mm</div></div>
          </div>
          <Chart className="chart sm" option={lluviaOpt} label={`Lluvia diaria en ${r.nombre}, últimos 60 días y pronóstico`} />
        </section>

        <section>
          <div className="seccion-t">Temperatura máxima</div>
          <p className="secondary" style={{ margin: "0 0 4px", fontSize: 13 }}>
            Última semana: <strong>{signo(r.tmax_anom7)} °C</strong> frente a lo normal.
          </p>
          <Chart className="chart sm" option={tempOpt} label={`Temperatura máxima diaria en ${r.nombre}`} />
        </section>

        <section>
          <div className="seccion-t">Avisos SENAMHI</div>
          {avisos.length === 0 && <p className="muted" style={{ margin: 0 }}>Sin avisos activos para esta región.</p>}
          <ul className="avisos" style={{ maxHeight: "none" }}>
            {avisos.map((a) => (
              <li key={a.numero} className="aviso">
                <div className="aviso-top">
                  <span className={`nivel nivel-${a.nivel}`}>{a.nivel}</span>
                  <span className="aviso-t">{a.titulo}</span>
                </div>
                <small>del {fechaCorta(a.inicio)} al {fechaCorta(a.fin)} · <a href={a.url} target="_blank" rel="noreferrer">ver aviso</a></small>
              </li>
            ))}
          </ul>
        </section>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Promedio de {datos.lluvia.departamentos[id].puntos} puntos de la región. Lluvia y temperatura: Open-Meteo; normal 2006-2020: ERA5.
        </p>
      </div>
    </aside>
  );
}

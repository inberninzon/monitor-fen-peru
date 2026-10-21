import { useMemo, useRef } from "react";
import type * as echarts from "echarts";
import { Chart, tokens, tooltipBase } from "../components/Chart";
import { Info } from "../components/Info";
import { Datos, fechaCorta, fmt, horaAct, magnitud, signo } from "../data";
import { colorIndice, INDICE_RAMP } from "../escalas";
import type { Metrica } from "./Mapa";

type Props = { datos: Datos; irAlMapa: (region: string | null, m?: Metrica) => void };

const MES_CORTO = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function Hoy({ datos, irAlMapa }: Props) {
  const { regiones, avisos, mar, enfen, pbi } = datos;
  const t = tokens();
  const hoy = regiones.hoy;
  const ultima = mar.indices.ultimas[mar.indices.ultimas.length - 1];
  const regs = regiones.regiones;

  const avisosActivos = avisos.filter((a) => a.fin >= hoy);
  const rojos = avisosActivos.filter((a) => a.nivel === "ROJO");
  const depsRojo = new Set(rojos.flatMap((a) => a.departamentos));
  const exceso = Object.values(regs).filter((r) => r.lluvia.obs7 >= 10 && r.lluvia.obs7 > 2 * r.lluvia.norm7);
  const deficit = Object.values(regs).filter((r) => r.lluvia.norm60 >= 40 && r.lluvia.obs60 < 0.5 * r.lluvia.norm60);
  const pbiUlt = pbi.ultimo["PBI"];
  const top = regiones.ranking.slice(0, 8);
  const [recordEvento, recordValor] = Object.entries(mar.indices.picos)
    .filter(([k]) => !k.startsWith("2026"))
    .sort((a, b) => b[1] - a[1])[0];

  // ---------- Carrera: 2026 contra los Niños anteriores ----------
  const chartRef = useRef<echarts.ECharts | null>(null);
  const angosto = innerWidth < 600;
  const carrera = useMemo<echarts.EChartsCoreOption>(() => {
    const series = mar.indices.eventos.map((e) => {
      const actual = e.anio === 2026;
      return {
        name: e.etiqueta, type: "line", showSymbol: false, smooth: 0.2,
        data: e.puntos.map((p) => [p[0], p[1]]),
        lineStyle: { width: actual ? 3 : 1.5, color: actual ? t.accent : t.hist, opacity: actual ? 1 : 0.9 },
        itemStyle: { color: actual ? t.accent : t.hist },
        z: actual ? 10 : 2,
        emphasis: { focus: "series", lineStyle: { width: actual ? 3.5 : 2.5 } },
        // el evento actual se rotula al final; los históricos, en su pico, para que las etiquetas no se encimen
        endLabel: {
          show: actual, formatter: angosto ? `${signo(ultima.n12a)}°` : `{a|2026-27}  ${signo(ultima.n12a)} °C`,
          color: t.text, fontSize: 12, fontWeight: 700,
          rich: { a: { fontWeight: 700, color: t.accent, fontSize: 12 } },
        },
        markPoint: actual ? undefined : {
          symbol: "circle", symbolSize: 5, itemStyle: { color: t.hist },
          label: { show: true, position: "top", color: t.text2, fontSize: 11, formatter: e.etiqueta, distance: 4,
            backgroundColor: t.surface, padding: [1, 4], borderRadius: 4 },
          data: [{ type: "max", valueDim: "y" }],
        },
        markLine: actual ? {
          silent: true, symbol: "none", lineStyle: { color: t.axis, type: "dashed", width: 1 },
          label: { color: t.muted, fontSize: 11, formatter: "{b}" },
          data: [{ yAxis: 3, name: angosto ? "Extraord." : "Extraordinaria (≥ 3 °C)" }, { yAxis: 1.7, name: "Fuerte" }],
        } : undefined,
      };
    });
    return {
      animationDuration: 2600, animationEasing: "cubicOut",
      grid: { left: 36, right: angosto ? 62 : 112, top: 24, bottom: 34 },
      tooltip: {
        ...tooltipBase(t), trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: t.axis } },
        formatter: (ps: any[]) => {
          const d = ps[0].axisValue as number;
          const fecha = new Date(Date.UTC(2001, 0, 1) + d * 864e5);
          const enc = `<div style="color:${t.muted};margin-bottom:4px">${fecha.getUTCDate()} ${["ene","feb","mar","abr","may","jun","jul","ago","set","oct","nov","dic"][fecha.getUTCMonth()]} · ${d >= 365 ? "año siguiente" : "año de inicio"}</div>`;
          return enc + ps.filter((p) => p.value).map((p) =>
            `<div style="display:flex;gap:10px;justify-content:space-between"><span>${p.marker}${p.seriesName}</span><b>${signo(p.value[1])} °C</b></div>`).join("");
        },
      },
      xAxis: {
        type: "value", min: 0, max: 545, interval: 30.4,
        axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { color: t.muted, fontSize: 11, formatter: (v: number) => MES_CORTO[Math.round(v / 30.4) % 12] },
      },
      yAxis: {
        type: "value", name: "°C", nameTextStyle: { color: t.muted, fontSize: 11 },
        axisLabel: { color: t.muted, fontSize: 11 }, splitLine: { lineStyle: { color: t.grid } },
      },
      series,
    };
  }, [mar, t.accent, t.hist, t.text, t.text2, t.surface, t.muted, t.axis, t.grid, ultima.n12a, angosto]);

  // ---------- Gauge Niño 1+2 ----------
  const gauge = useMemo<echarts.EChartsCoreOption>(() => ({
    series: [{
      type: "gauge", min: -1, max: 6, startAngle: 200, endAngle: -20, radius: "88%", center: ["50%", "56%"],
      axisLine: { lineStyle: { width: 14, color: [
        [1.4 / 7, t.grid], [2 / 7, INDICE_RAMP[1]], [2.7 / 7, INDICE_RAMP[2]], [4 / 7, INDICE_RAMP[3]], [1, INDICE_RAMP[5]],
      ] } },
      pointer: { length: "58%", width: 5, itemStyle: { color: t.text } },
      anchor: { show: true, size: 12, itemStyle: { color: t.text } },
      axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { color: t.muted, fontSize: 10, distance: -34, formatter: (v: number) => ([0, 3, 6].includes(v) ? `${v}°` : "") },
      title: { show: true, offsetCenter: [0, "62%"], color: t.text2, fontSize: 12, fontWeight: 600 },
      detail: { offsetCenter: [0, "34%"], formatter: (v: number) => `${signo(v)} °C`, color: t.text, fontSize: 28, fontWeight: 800 },
      data: [{ value: ultima.n12a, name: `Magnitud ${magnitud(ultima.n12a).toLowerCase()}` }],
      animationDuration: 1800,
    }],
  }), [ultima.n12a, t.grid, t.text, t.text2, t.muted]);

  // ---------- Costa: hoy vs hace 30 días ----------
  const costa = useMemo<echarts.EChartsCoreOption>(() => {
    const cs = mar.costa;
    return {
      grid: { left: 92, right: 56, top: 26, bottom: 24 },
      legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: t.text2, fontSize: 12 },
        data: [{ name: "Hace 30 días", icon: "circle" }, { name: "Hoy", icon: "circle" }] },
      tooltip: { ...tooltipBase(t), trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(127,127,127,.08)" } },
        formatter: (ps: any[]) => {
          const c = cs[ps[0].dataIndex];
          return `<b>${c.nombre}</b><br/>Hoy: <b>${fmt(c.actual, 1)} °C</b><br/>Hace 30 días: ${fmt(c.hace30, 1)} °C<br/>Cambio: <b>${signo(c.actual - c.hace30)} °C</b>`;
        } },
      yAxis: { type: "category", inverse: true, data: cs.map((c) => c.nombre), axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: t.text2, fontSize: 12 } },
      xAxis: { type: "value", scale: true, axisLabel: { color: t.muted, fontSize: 11, formatter: "{value}°" },
        splitLine: { lineStyle: { color: t.grid } } },
      series: [
        { type: "custom", silent: true, renderItem: (_: any, api: any) => {
          const a = api.coord([api.value(0), api.value(2)]); const b = api.coord([api.value(1), api.value(2)]);
          return { type: "line", shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: t.axis, lineWidth: 2 } };
        }, data: cs.map((c, i) => [c.hace30, c.actual, i]), z: 1 },
        { name: "Hace 30 días", type: "scatter", symbolSize: 10, data: cs.map((c) => c.hace30), itemStyle: { color: t.hist } },
        { name: "Hoy", type: "scatter", symbolSize: 12, data: cs.map((c) => c.actual),
          itemStyle: { color: t.sea, borderColor: t.surface, borderWidth: 2 },
          label: { show: true, position: "right", color: t.text, fontSize: 11, fontWeight: 600,
            formatter: (p: any) => signo(cs[p.dataIndex].actual - cs[p.dataIndex].hace30) } },
      ],
    };
  }, [mar, t.text, t.text2, t.muted, t.grid, t.axis, t.hist, t.sea, t.surface]);

  // ---------- Pronóstico: lluvia esperada 7 días vs normal ----------
  const prono = useMemo<echarts.EChartsCoreOption>(() => {
    const ids = Object.keys(regs).sort((a, b) => regs[b].lluvia.fc7 - regs[a].lluvia.fc7).slice(0, 8);
    return {
      grid: { left: 96, right: 40, top: 26, bottom: 22 },
      legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 8, textStyle: { color: t.text2, fontSize: 12 } },
      tooltip: { ...tooltipBase(t), trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(127,127,127,.08)" } },
        valueFormatter: (v: number) => `${fmt(v)} mm` },
      yAxis: { type: "category", inverse: true, data: ids.map((d) => regs[d].nombre), axisTick: { show: false },
        axisLine: { show: false }, axisLabel: { color: t.text2, fontSize: 12 } },
      xAxis: { type: "value", axisLabel: { color: t.muted, fontSize: 11, formatter: "{value}" }, splitLine: { lineStyle: { color: t.grid } } },
      series: [
        { name: "Pronóstico 7 días", type: "bar", barWidth: 12, data: ids.map((d) => regs[d].lluvia.fc7),
          itemStyle: { color: t.sea, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: "right", color: t.text, fontSize: 11, formatter: (p: any) => `${fmt(p.value)}` } },
        { name: "Normal", type: "scatter", symbol: "rect", symbolSize: [3, 16], data: ids.map((d) => regs[d].lluvia.normfc7),
          itemStyle: { color: t.text } },
      ],
    };
  }, [regs, t.sea, t.text, t.text2, t.muted, t.grid]);

  // ---------- PBI ----------
  const pbiChart = useMemo<echarts.EChartsCoreOption>(() => {
    const s = pbi.series["PBI"].slice(-30);
    return {
      grid: { left: 34, right: 52, top: 14, bottom: 26 },
      tooltip: { ...tooltipBase(t), trigger: "axis", valueFormatter: (v: number) => `${signo(v)} %` },
      xAxis: { type: "category", data: s.map((x) => x[0]), axisLabel: { color: t.muted, fontSize: 10, interval: 5 },
        axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false } },
      yAxis: { type: "value", axisLabel: { color: t.muted, fontSize: 11, formatter: "{value}%" }, splitLine: { lineStyle: { color: t.grid } } },
      series: [{ name: "PBI", type: "line", data: s.map((x) => x[1]), showSymbol: false,
        lineStyle: { width: 2, color: t.sea }, areaStyle: { color: t.sea, opacity: 0.08 },
        endLabel: { show: true, color: t.text, fontWeight: 700, fontSize: 11, formatter: (p: any) => `${signo(p.value)}%` } }],
    };
  }, [pbi, t.sea, t.text, t.muted, t.axis, t.grid]);

  const repetir = () => {
    const c = chartRef.current;
    if (!c) return;
    c.clear();
    c.setOption(carrera, true);
  };

  return (
    <div className="scroll">
      <div className="hoy">
        {/* ENFEN */}
        <section className="card hero span-12" aria-labelledby="enfen-t">
          <div>
            <span className="estado-chip"><span className="pulso" aria-hidden />{enfen.estado}</span>
            <h2 id="enfen-t">{enfen.titular}</h2>
            <p className="resumen">{enfen.resumen}</p>
            <div className="card-foot">
              <a href={enfen.url} target="_blank" rel="noreferrer">Comunicado oficial ENFEN N° {enfen.numero}</a>
              <span>· {enfen.fecha}</span>
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <div className="card-head" style={{ marginBottom: 0 }}>
              <div>
                <h2>Mar frente al Perú (Niño 1+2)</h2>
                <p>Anomalía semanal al {fechaCorta(ultima.f)}</p>
              </div>
              <span className="spacer" />
              <Info>
                Diferencia entre la temperatura del mar en la región <strong>Niño 1+2</strong> (frente a Ecuador y el norte del Perú)
                y su promedio 1991-2020. El ENFEN clasifica El Niño costero como <strong>débil</strong> desde +0,4 °C,
                <strong> moderado</strong> desde +1, <strong>fuerte</strong> desde +1,7 y <strong>extraordinario</strong> desde +3 °C.
                <br /><br />Fuente: NOAA CPC, semanal (OISST v2.1).
              </Info>
            </div>
            <Chart className="chart sm" option={gauge} label={`Anomalía Niño 1+2: ${signo(ultima.n12a)} grados`} />
          </div>
        </section>

        {/* KPIs */}
        <section className="kpis span-12" aria-label="Indicadores del día">
          <button className="card kpi clickable" onClick={() => irAlMapa(null, "mar")} style={{ textAlign: "left", border: undefined }}>
            <div className="label">Calentamiento del mar</div>
            <div className="value num">{signo(ultima.n12a)}<small>°C</small></div>
            <div className="ctx">Máximo anterior: {recordEvento} llegó a {signo(recordValor)} °C</div>
            <span className="go">Ver el mar en el mapa →</span>
          </button>
          <button className="card kpi clickable" onClick={() => irAlMapa(null, "avisos")} style={{ textAlign: "left" }}>
            <div className="label">Avisos rojos de SENAMHI</div>
            <div className="value num">{rojos.length}</div>
            <div className="ctx">Alcanzan {depsRojo.size} regiones · {avisosActivos.length} avisos activos en total</div>
            <span className="go">Ver avisos en el mapa →</span>
          </button>
          <button className="card kpi clickable" onClick={() => irAlMapa(null, "lluvia7")} style={{ textAlign: "left" }}>
            <div className="label">Regiones con lluvia sobre lo normal</div>
            <div className="value num">{exceso.length}</div>
            <div className="ctx">Más del doble de lo normal en 7 días{exceso.length ? `: ${exceso.slice(0, 3).map((r) => r.nombre).join(", ")}` : ""}</div>
            <span className="go">Ver lluvia →</span>
          </button>
          <button className="card kpi clickable" onClick={() => irAlMapa(null, "lluvia60")} style={{ textAlign: "left" }}>
            <div className="label">Regiones en déficit de lluvia</div>
            <div className="value num">{deficit.length}</div>
            <div className="ctx">Menos de la mitad de lo normal en 60 días{deficit.length ? `: ${deficit.slice(0, 3).map((r) => r.nombre).join(", ")}` : ""}</div>
            <span className="go">Ver sequía →</span>
          </button>
          <div className="card kpi">
            <div className="label">PBI ({pbiUlt[0].replace(".", " ")})</div>
            <div className="value num">{signo(pbiUlt[1])}<small>%</small></div>
            <div className="ctx">Agro {signo(pbi.ultimo["Agropecuario"][1])}% · Pesca {signo(pbi.ultimo["Pesca"][1])}% (interanual)</div>
          </div>
        </section>

        {/* Carrera */}
        <section className="card span-8" aria-labelledby="carrera-t">
          <div className="card-head">
            <div>
              <h2 id="carrera-t">2026 frente a los Niños más fuertes</h2>
              <p>Anomalía de la temperatura del mar en Niño 1+2 (°C), de enero del año de inicio a junio del siguiente</p>
            </div>
            <span className="spacer" />
            <button className="btn" onClick={repetir} aria-label="Repetir animación">▶ Repetir</button>
            <Info>
              Cada línea es un evento El Niño, alineado por calendario: el eje empieza en enero del año en que se inició.
              La línea naranja es el evento actual; las grises, los anteriores. Pasa el cursor (o toca) para comparar semana a semana.
              <br /><br />Fuente: NOAA CPC, índice semanal Niño 1+2.
            </Info>
          </div>
          <Chart option={carrera} label="Comparación del calentamiento del mar 2026 con 1982-83, 1997-98, 2015-16, 2017 y 2023-24"
            onReady={(c) => { chartRef.current = c; }} />
        </section>

        {/* Ranking */}
        <section className="card span-4" aria-labelledby="rank-t">
          <div className="card-head">
            <div>
              <h2 id="rank-t">Regiones más afectadas hoy</h2>
              <p>Índice de afectación (0-100) · toca una región</p>
            </div>
            <span className="spacer" />
            <Info>
              Índice propio que combina, por región: lluvia de 7 días frente a lo normal o déficit de 60 días ({Math.round(regiones.pesos.lluvia * 100)}%),
              lluvia intensa en un día ({Math.round(regiones.pesos.intensidad * 100)}%), lluvia pronosticada a 7 días ({Math.round(regiones.pesos.pronostico * 100)}%),
              avisos SENAMHI ({Math.round(regiones.pesos.avisos * 100)}%) y calor sobre lo normal ({Math.round(regiones.pesos.calor * 100)}%).
              No es un indicador oficial; sirve para comparar regiones entre sí.
            </Info>
          </div>
          <ol className="rank">
            {top.map((id, i) => {
              const r = regs[id];
              return (
                <li key={id}>
                  <button onClick={() => irAlMapa(id, "indice")} aria-label={`${r.nombre}: índice ${r.indice}, ${r.tipo}. Ver en el mapa`}>
                    <span className="pos num">{i + 1}</span>
                    <span className="nom">{r.nombre}<small>{r.tipo}</small></span>
                    <span className="bar-track"><span className="bar-fill" style={{ display: "block", width: `${r.indice}%`, background: colorIndice(r.indice), animationDelay: `${i * 70}ms` }} /></span>
                    <span className="val num">{r.indice}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Avisos */}
        <section className="card span-6" aria-labelledby="avisos-t">
          <div className="card-head">
            <div>
              <h2 id="avisos-t">Avisos meteorológicos SENAMHI</h2>
              <p>Vigentes y próximos, ordenados por nivel</p>
            </div>
            <span className="spacer" />
            <Info>
              Avisos oficiales del SENAMHI. <strong>Rojo</strong>: peligro alto; <strong>naranja</strong>: peligroso; <strong>amarillo</strong>: atención.
              Las regiones se leen del texto del aviso (o de la zona que nombra). Toca una región para verla en el mapa.
            </Info>
          </div>
          <ul className="avisos">
            {avisosActivos.length === 0 && <li className="muted">No hay avisos activos.</li>}
            {avisosActivos.map((a) => (
              <li key={a.numero} className="aviso">
                <div className="aviso-top">
                  <span className={`nivel nivel-${a.nivel}`}>{a.nivel === "ROJO" ? "▲" : a.nivel === "NARANJA" ? "◆" : "●"} {a.nivel}</span>
                  <span className="aviso-t">{a.titulo}</span>
                </div>
                <small>N° {a.numero} · {a.estado === "vigente" ? "Vigente" : "Próximo"} · del {fechaCorta(a.inicio)} al {fechaCorta(a.fin)} · <a href={a.url} target="_blank" rel="noreferrer">ver aviso</a></small>
                {a.departamentos.length > 0 && (
                  <div className="deps">
                    {a.departamentos.map((d) => (
                      <button key={d} className="dep-chip" onClick={() => irAlMapa(d, "avisos")}>{regs[d]?.nombre ?? d}</button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Costa */}
        <section className="card span-6" aria-labelledby="costa-t">
          <div className="card-head">
            <div>
              <h2 id="costa-t">Temperatura del mar en la costa</h2>
              <p>De Tumbes a Tacna · hoy frente a hace 30 días (°C)</p>
            </div>
            <span className="spacer" />
            <Info>
              Temperatura del mar a 20-40 km de la costa en 12 puntos, promedio del día. El número indica cuánto subió o bajó en 30 días.
              Un mar más caliente frente al norte aumenta el potencial de lluvias intensas.
              <br /><br />Fuente: Open-Meteo Marine (modelo Météo-France).
            </Info>
          </div>
          <Chart option={costa} className="chart" label="Temperatura del mar en 12 puntos de la costa, hoy y hace 30 días" />
        </section>

        {/* Pronóstico */}
        <section className="card span-6" aria-labelledby="prono-t">
          <div className="card-head">
            <div>
              <h2 id="prono-t">Lo que viene: lluvia de los próximos 7 días</h2>
              <p>Regiones con más lluvia pronosticada (mm) y su normal para estas fechas</p>
            </div>
            <span className="spacer" />
            <Info>
              Barra: lluvia acumulada pronosticada para los próximos 7 días (promedio de los puntos de cada región).
              Marca negra: lo normal para esos días (2006-2020). Una barra que supera mucho la marca anticipa lluvias fuera de lo común.
              <br /><br />Fuente: Open-Meteo (pronóstico) y ERA5 (normal).
            </Info>
          </div>
          <Chart option={prono} label="Lluvia pronosticada a 7 días por región" />
        </section>

        {/* PBI */}
        <section className="card span-6" aria-labelledby="pbi-t">
          <div className="card-head">
            <div>
              <h2 id="pbi-t">Economía: PBI mensual</h2>
              <p>Variación % frente al mismo mes del año anterior</p>
            </div>
            <span className="spacer" />
            <Info>
              PBI y sectores más expuestos al FEN. La pesca y el agro suelen ser los primeros golpeados (cambio en la temperatura del mar y en las lluvias).
              El BCRP publica con unos dos meses de rezago.<br /><br />Fuente: BCRP (BCRPData).
            </Info>
          </div>
          <Chart option={pbiChart} className="chart sm" label="Variación del PBI mensual" />
          <div className="stat-grid" style={{ marginTop: 10, gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))" }}>
            {["Agropecuario", "Pesca", "Minería e hidrocarburos", "Manufactura"].map((s) => {
              const v = pbi.ultimo[s][1];
              return (
                <div className="stat" key={s}>
                  <div className="l">{s === "Minería e hidrocarburos" ? "Minería" : s}</div>
                  <div className="v num" style={{ color: v < 0 ? "var(--danger-text)" : "var(--success-text)" }}>{v < 0 ? "▼" : "▲"} {signo(v)}%</div>
                </div>
              );
            })}
          </div>
          <div className="card-foot">Dato a {pbiUlt[0].replace(".", " ")} · actualizado {horaAct(pbi.actualizado)}</div>
        </section>
      </div>
    </div>
  );
}

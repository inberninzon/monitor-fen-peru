import { useEffect, useMemo, useRef, useState } from "react";
import type * as echarts from "echarts";
import { Chart, tokens, tooltipBase } from "../components/Chart";
import { Info } from "../components/Info";
import { KpiCard } from "../components/KpiCard";
import { Datos, fechaCorta, fmt, horaAct, magnitud, signo } from "../data";
import { colorIndice, INDICE_RAMP } from "../escalas";
import { calcularKpis, depsRojoLluvia, ESTADO_NOMBRE, Grupo, GrupoId, UMBRAL, valorTexto } from "../kpis";
import { POBLACION, POBLACION_PERU } from "../poblacion";
import type { Metrica } from "./Mapa";

type Props = {
  datos: Datos; irAlMapa: (region: string | null, m?: Metrica) => void;
  grupo: GrupoId; setGrupo: (g: GrupoId) => void;
};
type ModoLluvia = "fc" | "7" | "60";
type Foco = { region: string } | { deps: string[] } | null;

const MES_CORTO = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const SECTORES = ["PBI", "Agropecuario", "Pesca", "Minería e hidrocarburos", "Manufactura"];

function useMedia(q: string) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [q]);
  return m;
}

function Icono({ id }: { id: GrupoId }) {
  const p = {
    mar: <path d="M2 15c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.3 5 0M2 20c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.3 5 0M12 3v8M9 8l3 3 3-3" />,
    lluvia: <path d="M7 15a5 5 0 1 1 1.6-9.7A6 6 0 0 1 20 9a4 4 0 0 1-1 7.9M8 19l-1 2M12 18l-1 3M16 19l-1 2" />,
    alertas: <path d="M12 3 2 20h20L12 3zM12 10v4M12 17v.5" />,
    personas: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.6 3.1-6 7-6s7 2.4 7 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2.4.7 4 2.9 4 6" />,
    economia: <path d="M3 20h18M5 16l4-5 4 3 6-8M15 6h4v4" />,
  }[id];
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{p}</svg>;
}

export function Hoy({ datos, irAlMapa, grupo, setGrupo }: Props) {
  const { regiones, avisos, mar, enfen, pbi } = datos;
  const t = tokens();
  const hoy = regiones.hoy;
  const ultima = mar.indices.ultimas[mar.indices.ultimas.length - 1];
  const regs = regiones.regiones;
  const grupos = useMemo(() => calcularKpis(datos), [datos]);
  const movil = useMedia("(max-width: 759px)");
  const angosto = innerWidth < 600;

  // ---------- Carrera: 2026 contra los Niños anteriores ----------
  const chartRef = useRef<echarts.ECharts | null>(null);
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
          emphasis: { scale: 1.6 },
          label: { show: true, position: "right", color: t.text, fontSize: 11, fontWeight: 600,
            formatter: (p: any) => signo(cs[p.dataIndex].actual - cs[p.dataIndex].hace30) } },
      ],
    };
  }, [mar, t.text, t.text2, t.muted, t.grid, t.axis, t.hist, t.sea, t.surface]);

  // ---------- Lluvia por región: pronóstico, última semana o últimos 60 días ----------
  const [modoLl, setModoLl] = useState<ModoLluvia>("fc");
  const idsLl = useRef<string[]>([]);
  const lluviaChart = useMemo<echarts.EChartsCoreOption>(() => {
    const par = (id: string): [number, number] => {
      const l = regs[id].lluvia;
      return modoLl === "fc" ? [l.fc7, l.normfc7] : modoLl === "7" ? [l.obs7, l.norm7] : [l.obs60, l.norm60];
    };
    const ids = modoLl === "60"
      ? Object.keys(regs).filter((d) => regs[d].lluvia.norm60 >= UMBRAL.deficit60min).sort((a, b) => par(a)[0] / par(a)[1] - par(b)[0] / par(b)[1]).slice(0, 8)
      : Object.keys(regs).sort((a, b) => par(b)[0] - par(a)[0]).slice(0, 8);
    idsLl.current = ids;
    const color = (id: string) => {
      const [o, n] = par(id);
      if (modoLl === "60") return o < UMBRAL.deficit60 * n ? t.critical : t.sea;
      return o >= UMBRAL.exceso7min && o > UMBRAL.exceso7 * n ? t.accent : t.sea;
    };
    const nombre = modoLl === "fc" ? "Pronóstico 7 días" : modoLl === "7" ? "Últimos 7 días" : "Últimos 60 días";
    return {
      grid: { left: 96, right: 44, top: 26, bottom: 22 },
      legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 8, textStyle: { color: t.text2, fontSize: 12 } },
      tooltip: { ...tooltipBase(t), trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(127,127,127,.08)" } },
        formatter: (ps: any[]) => {
          const id = ids[ps[0].dataIndex];
          const [o, n] = par(id);
          return `<b>${regs[id].nombre}</b><br/>${nombre}: <b>${fmt(o)} mm</b><br/>Normal: ${fmt(n)} mm<br/>` +
            `${n > 0 ? `<b>${fmt((100 * o) / n)} %</b> de lo normal` : ""}<div style="color:${t.muted};margin-top:4px">Clic: ver en el mapa</div>`;
        } },
      yAxis: { type: "category", inverse: true, data: ids.map((d) => regs[d].nombre), axisTick: { show: false },
        axisLine: { show: false }, axisLabel: { color: t.text2, fontSize: 12 } },
      xAxis: { type: "value", axisLabel: { color: t.muted, fontSize: 11, formatter: "{value}" }, splitLine: { lineStyle: { color: t.grid } } },
      series: [
        { name: nombre, type: "bar", barWidth: 12, cursor: "pointer",
          data: ids.map((d) => ({ value: par(d)[0], itemStyle: { color: color(d), borderRadius: [0, 4, 4, 0] } })),
          emphasis: { focus: "self" },
          label: { show: true, position: "right", color: t.text, fontSize: 11, formatter: (p: any) => `${fmt(p.value)}` } },
        { name: "Normal", type: "scatter", symbol: "rect", symbolSize: [3, 16], data: ids.map((d) => par(d)[1]),
          itemStyle: { color: t.text } },
      ],
    };
  }, [regs, modoLl, t.sea, t.accent, t.critical, t.text, t.text2, t.muted, t.grid]);
  const metricaLl: Metrica = modoLl === "fc" ? "prono" : modoLl === "7" ? "lluvia7" : "lluvia60";
  const metricaLlRef = useRef(metricaLl);
  metricaLlRef.current = metricaLl;

  // ---------- PBI y sectores ----------
  const pbiChart = useMemo<echarts.EChartsCoreOption>(() => {
    const colores: Record<string, string> = {
      PBI: t.text, Agropecuario: "#0ca30c", Pesca: t.sea, "Minería e hidrocarburos": t.hist, Manufactura: t.accent,
    };
    const base = pbi.series["PBI"].slice(-24);
    const nombres = SECTORES.filter((s) => pbi.series[s]?.length);
    return {
      grid: { left: 40, right: 56, top: 40, bottom: 26 },
      legend: { top: 0, left: 0, itemWidth: 14, itemHeight: 3, textStyle: { color: t.text2, fontSize: 12 },
        formatter: (n: string) => (n === "Minería e hidrocarburos" ? "Minería" : n),
        selected: { "Minería e hidrocarburos": false, Manufactura: false } },
      tooltip: { ...tooltipBase(t), trigger: "axis", valueFormatter: (v: number) => `${signo(v)} %` },
      xAxis: { type: "category", data: base.map((x) => x[0]), axisLabel: { color: t.muted, fontSize: 10, interval: 3 },
        axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false } },
      // la pesca puede saltar cientos de % al reabrirse una temporada: el eje se acota para que el resto se lea
      yAxis: { type: "value", min: (v: { min: number }) => Math.max(v.min, -60), max: (v: { max: number }) => Math.min(v.max, 60),
        axisLabel: { color: t.muted, fontSize: 11, formatter: "{value}%" }, splitLine: { lineStyle: { color: t.grid } } },
      labelLayout: { moveOverlap: "shiftY" },
      series: nombres.map((n) => {
        const m = new Map(pbi.series[n]);
        return {
          name: n, type: "line", data: base.map((x) => m.get(x[0]) ?? null), showSymbol: false, smooth: 0.15,
          lineStyle: { width: n === "PBI" ? 2.5 : 1.8, color: colores[n] }, itemStyle: { color: colores[n] },
          emphasis: { focus: "series" },
          areaStyle: n === "PBI" ? { color: colores[n], opacity: 0.05 } : undefined,
          endLabel: { show: true, color: colores[n], fontWeight: 700, fontSize: 11, formatter: (p: any) => `${signo(p.value)}%` },
        };
      }),
    };
  }, [pbi, t.text, t.text2, t.sea, t.accent, t.hist, t.muted, t.axis, t.grid]);

  const repetir = () => {
    const c = chartRef.current;
    if (!c) return;
    c.clear();
    c.setOption(carrera, true);
  };

  // ---------- Alertas: filtros y resaltado cruzado ranking <-> avisos ----------
  const [nivel, setNivel] = useState<"TODOS" | "ROJO" | "NARANJA" | "AMARILLO">("TODOS");
  const [cuando, setCuando] = useState<"todos" | "vigente" | "proximo">("todos");
  const [foco, setFoco] = useState<Foco>(null);
  const activos = avisos.filter((a) => a.fin >= hoy);
  const avisosVista = activos
    .filter((a) => nivel === "TODOS" || a.nivel === nivel)
    .filter((a) => cuando === "todos" || (cuando === "vigente" ? a.inicio <= hoy : a.inicio > hoy));
  const regionEnFoco = (id: string) => !!foco && ("region" in foco ? foco.region === id : foco.deps.includes(id));
  const avisoEnFoco = (deps: string[]) => !!foco && ("region" in foco ? deps.includes(foco.region) : false);

  // ---------- Personas: barra de población ----------
  const depsRojo = useMemo(() => new Set(depsRojoLluvia(datos)), [datos]);
  const extremo = new Set(grupos.find((g) => g.id === "lluvia")!.kpis.find((k) => k.id === "extremo")?.detalle?.map((d) => d.id!) ?? []);
  const catPob = (id: string) => (depsRojo.has(id) ? "c-rojo" : regs[id].indice >= UMBRAL.riesgoAlto ? "c-alto" : "c-extremo");
  const expuestas = Object.keys(regs)
    .filter((id) => depsRojo.has(id) || regs[id].indice >= UMBRAL.riesgoAlto || extremo.has(id))
    .sort((a, b) => (POBLACION[b] ?? 0) - (POBLACION[a] ?? 0));
  const maxPob = Math.max(1, ...expuestas.map((id) => POBLACION[id] ?? 0));
  const pobExpuesta = expuestas.reduce((s, id) => s + (POBLACION[id] ?? 0), 0);

  // ---------- Navegación entre grupos ----------
  const scrollRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const secciones = useRef<Partial<Record<GrupoId, HTMLElement | null>>>({});
  const navegando = useRef(false);
  const [dir, setDir] = useState<"izq" | "der">("der");
  const [destello, setDestello] = useState<GrupoId | null>(null);
  const indice = grupos.findIndex((g) => g.id === grupo);

  const ir = (g: GrupoId) => {
    const nuevo = grupos.findIndex((x) => x.id === g);
    setDir(nuevo >= indice ? "der" : "izq");
    setGrupo(g);
    if (movil) {
      // si el usuario bajó, se vuelve al inicio del grupo sin perder la barra de pestañas
      const sc = scrollRef.current, nav = navRef.current;
      if (sc && nav && sc.scrollTop > nav.offsetTop) sc.scrollTo({ top: nav.offsetTop });
    } else {
      navegando.current = true;
      secciones.current[g]?.scrollIntoView({ behavior: "smooth", block: "start" });
      setDestello(g);
      setTimeout(() => { navegando.current = false; }, 800);
      setTimeout(() => setDestello(null), 1400);
    }
  };

  // En pantallas grandes, el índice sigue al grupo que se está leyendo
  useEffect(() => {
    if (movil || !scrollRef.current) return;
    const io = new IntersectionObserver((es) => {
      if (navegando.current) return;
      const e = es.find((x) => x.isIntersecting);
      if (e) setGrupo((e.target as HTMLElement).dataset.grupo as GrupoId);
    }, { root: scrollRef.current, rootMargin: "-25% 0px -65% 0px" });
    Object.values(secciones.current).forEach((s) => s && io.observe(s));
    return () => io.disconnect();
  }, [movil, setGrupo]);

  // Al abrir con #hoy/<grupo>, se lleva la vista a ese grupo
  useEffect(() => {
    if (!movil && grupo !== "mar") secciones.current[grupo]?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La pestaña activa siempre queda a la vista en la barra deslizable
  useEffect(() => {
    const nav = navRef.current;
    const b = nav?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (nav && b && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: b.offsetLeft - (nav.clientWidth - b.clientWidth) / 2, behavior: "smooth" });
  }, [grupo]);

  // Deslizar el dedo a los lados cambia de grupo en el celular
  const toque = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    toque.current = (e.target as Element).closest(".no-swipe") ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t0 = toque.current;
    toque.current = null;
    if (!t0) return;
    const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
    const sig = grupos[indice + (dx < 0 ? 1 : -1)];
    if (sig) ir(sig.id);
  };

  // ---------- Contenido propio de cada grupo ----------
  const contenido = (g: GrupoId) => {
    switch (g) {
      case "mar": return (
        <div className="g-charts dos">
          <section className="card" aria-labelledby="carrera-t">
            <div className="card-head">
              <div>
                <h3 id="carrera-t">2026 frente a los Niños más fuertes</h3>
                <p>Anomalía en Niño 1+2 (°C), de enero del año de inicio a junio del siguiente</p>
              </div>
              <span className="spacer" />
              <button className="btn" onClick={repetir} aria-label="Repetir animación">▶ Repetir</button>
              <Info>
                Cada línea es un evento El Niño, alineado por calendario: el eje empieza en enero del año en que se inició.
                La línea naranja es el evento actual; las grises, los anteriores. Pasa el cursor (o toca) para comparar semana a semana.
                <br /><br />Fuente: NOAA CPC, índice semanal Niño 1+2.
              </Info>
            </div>
            <Chart option={carrera} diferido label="Comparación del calentamiento del mar 2026 con 1982-83, 1997-98, 2015-16, 2017 y 2023-24"
              onReady={(c) => { chartRef.current = c; }} />
          </section>
          <section className="card" aria-labelledby="costa-t">
            <div className="card-head">
              <div>
                <h3 id="costa-t">Mar en la costa</h3>
                <p>De Tumbes a Tacna · hoy vs. hace 30 días (°C)</p>
              </div>
              <span className="spacer" />
              <Info>
                Temperatura del mar a 20-40 km de la costa en 12 puntos, promedio del día. El número indica cuánto subió o bajó en 30 días.
                Un mar más caliente frente al norte aumenta el potencial de lluvias intensas.
                <br /><br />Fuente: Open-Meteo Marine (modelo Météo-France).
              </Info>
            </div>
            <Chart option={costa} diferido label="Temperatura del mar en 12 puntos de la costa, hoy y hace 30 días" />
          </section>
        </div>
      );
      case "lluvia": return (
        <section className="card" aria-labelledby="ll-t">
          <div className="card-head wrap">
            <div>
              <h3 id="ll-t">Lluvia por región</h3>
              <p>Las 8 regiones con más lluvia (mm) y su normal para esas fechas · clic en una barra para verla en el mapa</p>
            </div>
            <span className="spacer" />
            <div className="seg no-swipe" role="radiogroup" aria-label="Periodo">
              {([["fc", "Próximos 7 d"], ["7", "Últimos 7 d"], ["60", "Déficit 60 d"]] as [ModoLluvia, string][]).map(([m, n]) => (
                <button key={m} role="radio" aria-checked={modoLl === m} onClick={() => setModoLl(m)}>{n}</button>
              ))}
            </div>
            <Info>
              Barra: lluvia acumulada (promedio de los puntos de cada región). Marca negra: lo normal para esos días (2006-2020).
              En naranja, las barras que superan el doble de lo normal; en rojo, las regiones con menos de la mitad de lo normal en 60 días.
              <br /><br />Fuente: Open-Meteo (observado y pronóstico) y ERA5 (normal).
            </Info>
          </div>
          <Chart option={lluviaChart} diferido label="Lluvia por región frente a lo normal"
            onReady={(c) => c.on("click", (p: any) => { const id = idsLl.current[p.dataIndex]; if (id) irAlMapa(id, metricaLlRef.current); })} />
        </section>
      );
      case "alertas": return (
        <div className="g-charts iguales">
          <section className="card" aria-labelledby="rank-t">
            <div className="card-head">
              <div>
                <h3 id="rank-t">Regiones más afectadas hoy</h3>
                <p>Índice de afectación (0-100) · pasa el cursor para ver sus avisos</p>
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
              {regiones.ranking.slice(0, 10).map((id, i) => {
                const r = regs[id];
                return (
                  <li key={id} className={regionEnFoco(id) ? "foco" : ""}>
                    <button onClick={() => irAlMapa(id, "indice")} onMouseEnter={() => setFoco({ region: id })} onMouseLeave={() => setFoco(null)}
                      onFocus={() => setFoco({ region: id })} onBlur={() => setFoco(null)}
                      aria-label={`${r.nombre}: índice ${r.indice}, ${r.tipo}. Ver en el mapa`}>
                      <span className="pos num">{i + 1}</span>
                      <span className="nom">{r.nombre}<small>{r.tipo}{r.avisos.length ? ` · ${r.avisos.length} avisos` : ""}</small></span>
                      <span className="bar-track"><span className="bar-fill" style={{ display: "block", width: `${r.indice}%`, background: colorIndice(r.indice), animationDelay: `${i * 70}ms` }} /></span>
                      <span className="val num">{r.indice}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
          <section className="card" aria-labelledby="avisos-t">
            <div className="card-head">
              <div>
                <h3 id="avisos-t">Avisos SENAMHI</h3>
                <p>{avisosVista.length} de {activos.length} avisos activos</p>
              </div>
              <span className="spacer" />
              <Info>
                Avisos oficiales del SENAMHI. <strong>Rojo</strong>: peligro alto; <strong>naranja</strong>: peligroso; <strong>amarillo</strong>: atención.
                Filtra por nivel o por fecha; pasa el cursor sobre un aviso para ver sus regiones en el ranking. Toca una región para verla en el mapa.
              </Info>
            </div>
            <div className="filtros no-swipe">
              {(["TODOS", "ROJO", "NARANJA", "AMARILLO"] as const).map((n) => {
                const c = n === "TODOS" ? activos.length : activos.filter((a) => a.nivel === n).length;
                return (
                  <button key={n} className={`chip f-${n}`} aria-pressed={nivel === n} onClick={() => setNivel(n)} disabled={!c && n !== "TODOS"}>
                    {n !== "TODOS" && <span className="dot" />}{n === "TODOS" ? "Todos" : n[0] + n.slice(1).toLowerCase()} <span className="muted num">{c}</span>
                  </button>
                );
              })}
              <span className="sep" />
              {([["todos", "Cualquier fecha"], ["vigente", "Vigentes"], ["proximo", "Próximos"]] as const).map(([c, n]) => (
                <button key={c} className="chip" aria-pressed={cuando === c} onClick={() => setCuando(c)}>{n}</button>
              ))}
            </div>
            <ul className="avisos">
              {avisosVista.length === 0 && <li className="muted">No hay avisos con este filtro.</li>}
              {avisosVista.map((a) => (
                <li key={a.numero} className={`aviso${avisoEnFoco(a.departamentos) ? " foco" : ""}`}
                  onMouseEnter={() => setFoco({ deps: a.departamentos })} onMouseLeave={() => setFoco(null)}>
                  <div className="aviso-top">
                    <span className={`nivel nivel-${a.nivel}`}>{a.nivel === "ROJO" ? "▲" : a.nivel === "NARANJA" ? "◆" : "●"} {a.nivel}</span>
                    <span className="aviso-t">{a.titulo}</span>
                  </div>
                  <small>N° {a.numero} · {a.inicio <= hoy ? "Vigente" : "Próximo"} · del {fechaCorta(a.inicio)} al {fechaCorta(a.fin)} · <a href={a.url} target="_blank" rel="noreferrer">ver aviso</a></small>
                  <details>
                    <summary>Qué dice el aviso</summary>
                    <p>{a.descripcion}</p>
                  </details>
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
        </div>
      );
      case "personas": return (
        <section className="card" aria-labelledby="pob-t">
          <div className="card-head">
            <div>
              <h3 id="pob-t">¿Dónde vive la gente expuesta?</h3>
              <p>Regiones con aviso rojo por lluvias, riesgo alto o lluvia extrema prevista, ordenadas por población · toca una para verla en el mapa</p>
            </div>
            <span className="spacer" />
            <Info>
              Población estimada por el INEI para 2025, por departamento. La barra toma el color de la exposición más grave y las etiquetas
              muestran todas: aviso rojo por lluvias (vigente o próximo), riesgo alto en el índice de afectación (≥ {UMBRAL.riesgoAlto}) o lluvia extrema en el pronóstico.
              Mide a cuántas personas alcanza el evento, no cuántas están afectadas.
            </Info>
          </div>
          <ol className="pob-rank">
            {expuestas.map((id) => {
              const n = POBLACION[id] ?? 0;
              return (
                <li key={id}>
                  <button onClick={() => irAlMapa(id, "indice")} aria-label={`${regs[id].nombre}: ${fmt(n / 1e6, 2)} millones de habitantes. Ver en el mapa`}>
                    <span className="nom">{regs[id].nombre}</span>
                    <span className="bar-track"><span className={`bar-fill ${catPob(id)}`} style={{ display: "block", width: `${(100 * n) / maxPob}%` }} /></span>
                    <span className="val num">{fmt(n / 1e6, 2)} M</span>
                    <span className="tags">
                      {depsRojo.has(id) && <span className="tag c-rojo">aviso rojo</span>}
                      {regs[id].indice >= UMBRAL.riesgoAlto && <span className="tag c-alto">riesgo alto</span>}
                      {extremo.has(id) && <span className="tag c-extremo">lluvia extrema</span>}
                    </span>
                  </button>
                </li>
              );
            })}
            {expuestas.length === 0 && <li className="muted">Hoy ninguna región tiene aviso rojo por lluvias, riesgo alto ni lluvia extrema prevista.</li>}
          </ol>
          <p className="pob-pie muted">
            Fuera de estas {expuestas.length} regiones viven {fmt((POBLACION_PERU - pobExpuesta) / 1e6, 1)} M de personas
            ({fmt((100 * (POBLACION_PERU - pobExpuesta)) / POBLACION_PERU)} % del país).
          </p>
          <div className="pob-leyenda">
            <span><i className="c-rojo" />Aviso rojo por lluvias</span><span><i className="c-alto" />Riesgo alto</span>
            <span><i className="c-extremo" />Lluvia extrema prevista</span>
          </div>
        </section>
      );
      case "economia": return (
        <section className="card" aria-labelledby="pbi-t">
          <div className="card-head">
            <div>
              <h3 id="pbi-t">PBI y sectores expuestos</h3>
              <p>Variación % frente al mismo mes del año anterior · toca la leyenda para mostrar u ocultar sectores</p>
            </div>
            <span className="spacer" />
            <Info>
              PBI y sectores más expuestos al FEN. La pesca y el agro suelen ser los primeros golpeados (cambio en la temperatura del mar y en las lluvias);
              la manufactura cae con ellos por la harina de pescado. El BCRP publica con unos dos meses de rezago.<br /><br />Fuente: BCRP (BCRPData).
            </Info>
          </div>
          <Chart option={pbiChart} diferido label="Variación del PBI mensual y sus sectores" />
          <div className="card-foot">Dato a {pbi.ultimo["PBI"][0].replace(".", " ")} · actualizado {horaAct(pbi.actualizado)}</div>
        </section>
      );
    }
  };

  const seccion = (g: Grupo, clase = "") => (
    <section key={g.id} id={`g-${g.id}`} data-grupo={g.id} ref={(el) => { secciones.current[g.id] = el; }}
      className={`grupo est-${g.estado}${destello === g.id ? " destello" : ""} ${clase}`} aria-labelledby={`gt-${g.id}`}
      role={movil ? "tabpanel" : undefined}>
      <header className="grupo-head">
        <span className="grupo-icono"><Icono id={g.id} /></span>
        <div className="grupo-tit">
          <h2 id={`gt-${g.id}`}>{g.titulo} <span className="est-pill">{ESTADO_NOMBRE[g.estado]}</span></h2>
          <p>{g.resumen}</p>
        </div>
      </header>
      <div className={`kpi-grid n${g.kpis.length}`}>
        {g.kpis.map((k, i) => <KpiCard key={k.id} k={k} irAlMapa={irAlMapa} retraso={i * 60} />)}
      </div>
      {contenido(g.id)}
    </section>
  );

  return (
    <div className="scroll" ref={scrollRef}>
      <div className="hoy2">
        {/* ENFEN */}
        <section className="card hero2" aria-labelledby="enfen-t">
          <div className="hero2-txt">
            <span className="estado-chip"><span className="pulso" aria-hidden />{enfen.estado}</span>
            <h2 id="enfen-t">{enfen.titular}</h2>
            <details className="resumen-det" open={!movil}>
              <summary>Resumen del comunicado</summary>
              <p className="resumen">{enfen.resumen}</p>
            </details>
            <div className="card-foot">
              <a href={enfen.url} target="_blank" rel="noreferrer">Comunicado oficial ENFEN N° {enfen.numero}</a>
              <span>· {enfen.fecha}</span>
            </div>
          </div>
          <div className="hero2-gauge">
            <div className="card-head" style={{ marginBottom: 0 }}>
              <div>
                <h3>Mar frente al Perú (Niño 1+2)</h3>
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
            <Chart className="chart gauge" option={gauge} label={`Anomalía Niño 1+2: ${signo(ultima.n12a)} grados`} />
          </div>
        </section>

        <div className="hoy2-cuerpo">
          <nav ref={navRef} className="grupo-nav no-swipe" role="tablist" aria-label="Grupos de indicadores">
            <span className="grupo-nav-t">Indicadores</span>
            {grupos.map((g) => {
              const k = g.kpis[0];
              return (
                <button key={g.id} role="tab" aria-selected={grupo === g.id} aria-controls={`g-${g.id}`}
                  className={`gnav est-${g.estado}`} onClick={() => ir(g.id)}>
                  <span className="gnav-icono"><Icono id={g.id} /></span>
                  <span className="gnav-t">
                    <span className="t-largo">{g.titulo}</span><span className="t-corto">{g.corto}</span>
                    {k && <small className="num">{valorTexto(k, k.valor)} {k.unidad}</small>}
                  </span>
                  <i className="est-dot" title={ESTADO_NOMBRE[g.estado]} />
                </button>
              );
            })}
            <span className="grupo-nav-pie">Datos al {horaAct(regiones.actualizado)}</span>
          </nav>

          <div className="grupos" onTouchStart={movil ? onTouchStart : undefined} onTouchEnd={movil ? onTouchEnd : undefined}>
            {movil
              ? seccion(grupos[Math.max(0, indice)], `entra-${dir}`)
              : grupos.map((g) => seccion(g))}
            {movil && (
              <div className="pasos" aria-hidden>
                {grupos.map((g) => <i key={g.id} className={g.id === grupo ? "on" : ""} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

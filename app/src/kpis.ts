// Indicadores de la vista Hoy, agrupados por tema. Todo se calcula con los JSON del pipeline;
// los umbrales están aquí para que la vista y los textos de ayuda digan lo mismo.
import { Datos, fechaCorta, fmt, magnitud, signo } from "./data";
import { POBLACION, POBLACION_PERU } from "./poblacion";
import type { Metrica } from "./views/Mapa";

export const UMBRAL = {
  ninoCostero: 0.4,     // °C en Niño 1+2: condición El Niño costero (ENFEN)
  ninoGlobal: 0.5,      // °C en Niño 3.4: condición El Niño en el Pacífico central (NOAA)
  exceso7: 2,           // lluvia de 7 días mayor al doble de lo normal...
  exceso7min: 10,       // ...y al menos 10 mm
  extremoDia: 40,       // mm en un día del pronóstico
  deficit60: 0.5,       // menos de la mitad de lo normal en 60 días...
  deficit60min: 40,     // ...donde lo normal es al menos 40 mm
  calor: 2,             // °C de temperatura máxima sobre lo normal (promedio 7 días)
  riesgoAlto: 45,       // índice de afectación
};

export type Estado = "normal" | "atencion" | "alerta";
export type Detalle = { id?: string; nombre: string; valor: string };
export type Kpi = {
  id: string; label: string; valor: number; dec: number; conSigno?: boolean; unidad?: string;
  ctx: string; estado: Estado;
  delta?: { texto: string; sube: boolean; malo: boolean; igual?: boolean };
  serie?: { v: number[]; etq: string[]; unidad: string };
  detalle?: Detalle[]; tituloDetalle?: string;
  metrica?: Metrica;
};
export type GrupoId = "mar" | "lluvia" | "alertas" | "personas" | "economia";
export type Grupo = { id: GrupoId; titulo: string; corto: string; estado: Estado; resumen: string; kpis: Kpi[] };

export const ESTADO_NOMBRE: Record<Estado, string> = { normal: "Normal", atencion: "Atención", alerta: "Alerta" };

export const valorTexto = (k: Pick<Kpi, "dec" | "conSigno">, v: number) => (k.conSigno ? signo(v, k.dec) : fmt(v, k.dec));
const peor = (...es: Estado[]): Estado => (es.includes("alerta") ? "alerta" : es.includes("atencion") ? "atencion" : "normal");
const millones = (n: number) => n / 1e6;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
// Cambio frente al periodo anterior; `maloSiSube` dice en qué dirección empeora el indicador
const cambio = (dif: number, unidad: string, periodo: string, maloSiSube = true): Kpi["delta"] =>
  Math.abs(dif) < 0.05
    ? { texto: `sin cambio ${periodo}`, sube: false, malo: false, igual: true }
    : { texto: `${signo(dif)} ${unidad} ${periodo}`, sube: dif > 0, malo: dif > 0 === maloSiSube };

// Avisos rojos ligados a lluvia (mismo criterio que pipeline/indice.py): los de calor o viento no cuentan
// para medir cuánta gente está expuesta a lluvias e inundaciones.
const LLUVIA_AVISO = /precipitaci|lluvia|tormenta|huaico|desborde/i;
export function depsRojoLluvia(datos: Datos) {
  const hoy = datos.regiones.hoy;
  return [...new Set(datos.avisos.filter((a) => a.fin >= hoy && a.nivel === "ROJO" && LLUVIA_AVISO.test(a.titulo))
    .flatMap((a) => a.departamentos))].filter((d) => datos.regiones.regiones[d]);
}

export function calcularKpis(datos: Datos): Grupo[] {
  const { regiones, avisos, mar, pbi } = datos;
  const hoy = regiones.hoy;
  const regs = regiones.regiones;
  const ids = Object.keys(regs);
  const nom = (id: string) => regs[id]?.nombre ?? id;

  // ---------- Mar ----------
  const ult = mar.indices.ultimas;
  const u = ult[ult.length - 1];
  const prev = ult[ult.length - 2] ?? u;
  const ult12 = ult.slice(-12);
  let semanas = 0;
  for (let i = ult.length - 1; i >= 0 && ult[i].n12a >= UMBRAL.ninoCostero; i--) semanas++;
  const desde = semanas ? ult[ult.length - semanas].f : null;
  const [recordEvento, recordValor] = Object.entries(mar.indices.picos)
    .filter(([k]) => !k.startsWith("2026")).sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
  const costa = [...mar.costa].sort((a, b) => b.actual - a.actual);
  const calida = costa[0];
  const cambioCosta = mar.costa.reduce((s, c) => s + c.actual - c.hace30, 0) / Math.max(mar.costa.length, 1);
  const n12Estado: Estado = u.n12a >= 1.7 ? "alerta" : u.n12a >= UMBRAL.ninoCostero ? "atencion" : "normal";
  const n34Estado: Estado = u.n34a >= 1.5 ? "alerta" : u.n34a >= UMBRAL.ninoGlobal ? "atencion" : "normal";

  const grupoMar: Grupo = {
    id: "mar", titulo: "Mar y océano", corto: "Mar",
    estado: peor(n12Estado, n34Estado),
    resumen: `El Niño costero ${magnitud(u.n12a).toLowerCase()}: el mar frente al norte está ${signo(u.n12a)} °C sobre lo normal${semanas ? ` desde hace ${plural(semanas, "semana", "semanas")}` : ""}.`,
    kpis: [
      {
        id: "n12", label: "Calentamiento del mar (Niño 1+2)", valor: u.n12a, dec: 1, conSigno: true, unidad: "°C",
        ctx: `Magnitud ${magnitud(u.n12a).toLowerCase()} · récord previo: ${recordEvento}, ${signo(recordValor)} °C`,
        estado: n12Estado, metrica: "mar",
        delta: cambio(u.n12a - prev.n12a, "°C", "en la semana"),
        serie: { v: ult12.map((x) => x.n12a), etq: ult12.map((x) => fechaCorta(x.f)), unidad: "°C" },
      },
      {
        id: "semanas", label: "Semanas seguidas con El Niño costero", valor: semanas, dec: 0, unidad: semanas === 1 ? "semana" : "semanas",
        ctx: desde ? `Anomalía ≥ +${fmt(UMBRAL.ninoCostero, 1)} °C desde el ${fechaCorta(desde)}` : "Sin condición El Niño esta semana",
        estado: semanas >= 12 ? "alerta" : semanas > 0 ? "atencion" : "normal", metrica: "mar",
        serie: { v: ult12.map((x) => x.n12a), etq: ult12.map((x) => fechaCorta(x.f)), unidad: "°C" },
      },
      {
        id: "n34", label: "Pacífico central (Niño 3.4)", valor: u.n34a, dec: 1, conSigno: true, unidad: "°C",
        ctx: u.n34a >= UMBRAL.ninoGlobal ? "El Niño también en el Pacífico central: efecto global" : `Bajo el umbral global de +${fmt(UMBRAL.ninoGlobal, 1)} °C`,
        estado: n34Estado, metrica: "mar",
        delta: cambio(u.n34a - prev.n34a, "°C", "en la semana"),
        serie: { v: ult12.map((x) => x.n34a), etq: ult12.map((x) => fechaCorta(x.f)), unidad: "°C" },
      },
      ...(calida ? [{
        id: "costa", label: "Mar más cálido en la costa", valor: calida.actual, dec: 1, unidad: "°C",
        ctx: `${calida.nombre} · la costa subió ${signo(cambioCosta)} °C en 30 días (promedio)`,
        estado: (cambioCosta >= 1 ? "alerta" : cambioCosta >= 0.3 ? "atencion" : "normal") as Estado, metrica: "mar" as Metrica,
        serie: { v: calida.diario.slice(-30).map((d) => d[1]), etq: calida.diario.slice(-30).map((d) => fechaCorta(d[0])), unidad: "°C" },
        tituloDetalle: "Cambio en 30 días por punto",
        detalle: [...mar.costa].sort((a, b) => (b.actual - b.hace30) - (a.actual - a.hace30))
          .map((c) => ({ nombre: c.nombre, valor: `${fmt(c.actual, 1)} °C (${signo(c.actual - c.hace30)})` })),
      }] : []),
    ],
  };

  // ---------- Lluvia y calor ----------
  const ll = (id: string) => regs[id].lluvia;
  const exceso = ids.filter((id) => ll(id).obs7 >= UMBRAL.exceso7min && ll(id).obs7 > UMBRAL.exceso7 * ll(id).norm7)
    .sort((a, b) => ll(b).obs7 / Math.max(ll(b).norm7, 1) - ll(a).obs7 / Math.max(ll(a).norm7, 1));
  const extremo = ids.filter((id) => ll(id).fcmax >= UMBRAL.extremoDia || (ll(id).fc7 >= UMBRAL.exceso7min && ll(id).fc7 > UMBRAL.exceso7 * ll(id).normfc7))
    .sort((a, b) => ll(b).fcmax - ll(a).fcmax);
  const deficit = ids.filter((id) => ll(id).norm60 >= UMBRAL.deficit60min && ll(id).obs60 < UMBRAL.deficit60 * ll(id).norm60)
    .sort((a, b) => ll(a).obs60 / ll(a).norm60 - ll(b).obs60 / ll(b).norm60);
  const calor = ids.filter((id) => regs[id].tmax_anom7 >= UMBRAL.calor).sort((a, b) => regs[b].tmax_anom7 - regs[a].tmax_anom7);
  const porMax24 = [...ids].sort((a, b) => ll(b).max24 - ll(a).max24);
  const maxId = porMax24[0];
  const veces = (o: number, n: number) => (n > 0 ? `${fmt(o / n, 1)}× lo normal` : "sin lluvia normal");

  const grupoLluvia: Grupo = {
    id: "lluvia", titulo: "Lluvia y calor", corto: "Lluvia",
    estado: peor(exceso.length + extremo.length >= 3 ? "alerta" : exceso.length + extremo.length > 0 ? "atencion" : "normal",
      deficit.length >= 3 || calor.length >= 5 ? "atencion" : "normal"),
    resumen: extremo.length
      ? `Se espera lluvia fuera de lo común en ${plural(extremo.length, "región", "regiones")} los próximos 7 días, sobre todo ${extremo.slice(0, 2).map(nom).join(" y ")}.`
      : `${plural(exceso.length, "región", "regiones")} con lluvia muy sobre lo normal; el pronóstico no anticipa extremos.`,
    kpis: [
      {
        id: "extremo", label: "Lluvia extrema en el pronóstico", valor: extremo.length, dec: 0, unidad: extremo.length === 1 ? "región" : "regiones",
        ctx: `≥ ${UMBRAL.extremoDia} mm en un día o el doble de lo normal en 7 días`,
        estado: extremo.length >= 3 ? "alerta" : extremo.length ? "atencion" : "normal", metrica: "prono",
        tituloDetalle: "Máximo diario pronosticado",
        detalle: extremo.map((id) => ({ id, nombre: nom(id), valor: `${fmt(ll(id).fcmax)} mm/día · ${fmt(ll(id).fc7)} mm en 7 d` })),
      },
      {
        id: "exceso", label: "Lluvia sobre lo normal (7 días)", valor: exceso.length, dec: 0, unidad: exceso.length === 1 ? "región" : "regiones",
        ctx: "Más del doble de lo normal en la última semana",
        estado: exceso.length >= 3 ? "alerta" : exceso.length ? "atencion" : "normal", metrica: "lluvia7",
        tituloDetalle: "Lluvia de 7 días frente a lo normal",
        detalle: exceso.map((id) => ({ id, nombre: nom(id), valor: `${fmt(ll(id).obs7)} mm · ${veces(ll(id).obs7, ll(id).norm7)}` })),
      },
      ...(maxId ? [{
        id: "max24", label: "Lluvia más intensa en un día", valor: ll(maxId).max24, dec: 0, unidad: "mm",
        ctx: `${nom(maxId)} · máximo en un punto, últimos 3 días`,
        estado: (ll(maxId).max24 >= 60 ? "alerta" : ll(maxId).max24 >= 30 ? "atencion" : "normal") as Estado, metrica: "lluvia7" as Metrica,
        tituloDetalle: "Máximo en 24 h por región",
        detalle: porMax24.slice(0, 6).map((id) => ({ id, nombre: nom(id), valor: `${fmt(ll(id).max24)} mm` })),
      }] : []),
      {
        id: "deficit", label: "Déficit de lluvia (60 días)", valor: deficit.length, dec: 0, unidad: deficit.length === 1 ? "región" : "regiones",
        ctx: "Menos de la mitad de lo normal: riesgo de sequía en el sur",
        estado: deficit.length >= 3 ? "atencion" : "normal", metrica: "lluvia60",
        tituloDetalle: "Lluvia de 60 días frente a lo normal",
        detalle: deficit.map((id) => ({ id, nombre: nom(id), valor: `${fmt((100 * ll(id).obs60) / ll(id).norm60)} % de lo normal` })),
      },
      {
        id: "calor", label: "Calor sobre lo normal", valor: calor.length, dec: 0, unidad: calor.length === 1 ? "región" : "regiones",
        ctx: `Máximas ≥ +${UMBRAL.calor} °C sobre lo normal en la última semana`,
        estado: calor.length >= 8 ? "alerta" : calor.length ? "atencion" : "normal", metrica: "indice",
        tituloDetalle: "Temperatura máxima sobre lo normal",
        detalle: calor.map((id) => ({ id, nombre: nom(id), valor: `${signo(regs[id].tmax_anom7)} °C` })),
      },
    ],
  };

  // ---------- Alertas y riesgo ----------
  const activos = avisos.filter((a) => a.fin >= hoy);
  const rojos = activos.filter((a) => a.nivel === "ROJO");
  const vigentes = activos.filter((a) => a.inicio <= hoy);
  const proximos = activos.filter((a) => a.inicio > hoy);
  const depsRojo = [...new Set(rojos.flatMap((a) => a.departamentos))].filter((d) => regs[d]);
  const altos = regiones.ranking.filter((id) => regs[id].indice >= UMBRAL.riesgoAlto);
  const promedio = ids.reduce((s, id) => s + regs[id].indice, 0) / Math.max(ids.length, 1);
  const top = regiones.ranking[0];
  const rango = (a: { inicio: string; fin: string }) => (a.inicio === a.fin ? fechaCorta(a.inicio) : `${fechaCorta(a.inicio)} – ${fechaCorta(a.fin)}`);

  const grupoAlertas: Grupo = {
    id: "alertas", titulo: "Alertas y riesgo", corto: "Alertas",
    estado: rojos.length ? "alerta" : activos.length || altos.length ? "atencion" : "normal",
    resumen: rojos.length
      ? `${plural(rojos.length, "aviso rojo", "avisos rojos")} del SENAMHI alcanzan ${plural(depsRojo.length, "región", "regiones")}${top ? `; ${nom(top)} es la más afectada` : ""}.`
      : `${plural(activos.length, "aviso activo", "avisos activos")}, ninguno rojo.`,
    kpis: [
      {
        id: "rojos", label: "Avisos rojos SENAMHI", valor: rojos.length, dec: 0,
        ctx: `Alcanzan ${plural(depsRojo.length, "región", "regiones")} · ${activos.length} avisos activos en total`,
        estado: rojos.length ? "alerta" : "normal", metrica: "avisos",
        tituloDetalle: "Avisos rojos",
        detalle: rojos.map((a) => ({ nombre: `N° ${a.numero} · ${a.titulo}`, valor: rango(a) })),
      },
      {
        id: "vigentes", label: "Avisos vigentes hoy", valor: vigentes.length, dec: 0,
        ctx: proximos.length ? `${plural(proximos.length, "aviso más empieza", "avisos más empiezan")} en los próximos días` : "No hay avisos por empezar",
        estado: vigentes.some((a) => a.nivel === "ROJO") ? "alerta" : vigentes.length ? "atencion" : "normal", metrica: "avisos",
        delta: proximos.length ? { texto: `${proximos.length} próximos`, sube: true, malo: true } : undefined,
        tituloDetalle: "Próximos avisos",
        detalle: proximos.map((a) => ({ nombre: `${a.nivel} · ${a.titulo}`, valor: `desde ${fechaCorta(a.inicio)}` })),
      },
      {
        id: "altos", label: "Regiones en riesgo alto", valor: altos.length, dec: 0, unidad: altos.length === 1 ? "región" : "regiones",
        ctx: `Índice de afectación ≥ ${UMBRAL.riesgoAlto} de 100`,
        estado: altos.length >= 3 ? "alerta" : altos.length ? "atencion" : "normal", metrica: "indice",
        tituloDetalle: "Índice de afectación",
        detalle: altos.map((id) => ({ id, nombre: nom(id), valor: `${regs[id].indice} · ${regs[id].tipo}` })),
      },
      {
        id: "promedio", label: "Índice promedio del país", valor: promedio, dec: 0, unidad: "/ 100",
        ctx: top ? `La más alta: ${nom(top)} con ${regs[top].indice}` : "",
        estado: promedio >= 40 ? "alerta" : promedio >= 25 ? "atencion" : "normal", metrica: "indice",
        tituloDetalle: "Las 6 regiones más afectadas",
        detalle: regiones.ranking.slice(0, 6).map((id) => ({ id, nombre: nom(id), valor: String(regs[id].indice) })),
      },
    ],
  };

  // ---------- Personas ----------
  const pob = (lista: string[]) => lista.reduce((s, id) => s + (POBLACION[id] ?? 0), 0);
  const detallePob = (lista: string[]) => [...lista].sort((a, b) => (POBLACION[b] ?? 0) - (POBLACION[a] ?? 0))
    .map((id) => ({ id, nombre: nom(id), valor: `${fmt(millones(POBLACION[id] ?? 0), 2)} M` }));
  const pct = (n: number) => `${fmt((100 * n) / POBLACION_PERU)} % del país`;
  const rojoLluvia = depsRojoLluvia(datos);
  const pRojo = pob(rojoLluvia), pAlto = pob(altos), pExtremo = pob(extremo);

  const grupoPersonas: Grupo = {
    id: "personas", titulo: "Personas expuestas", corto: "Personas",
    estado: pRojo >= 1e6 ? "alerta" : pRojo > 0 || pAlto > 0 ? "atencion" : "normal",
    resumen: `${fmt(millones(pRojo), 1)} millones de personas viven en regiones con aviso rojo por lluvias (${pct(pRojo)}).`,
    kpis: [
      {
        id: "pob-rojo", label: "Bajo aviso rojo por lluvias", valor: millones(pRojo), dec: 1, unidad: "M hab.",
        ctx: pct(pRojo), estado: pRojo >= 1e6 ? "alerta" : pRojo > 0 ? "atencion" : "normal", metrica: "avisos",
        tituloDetalle: "Población por región", detalle: detallePob(rojoLluvia),
      },
      {
        id: "pob-alto", label: "En regiones de riesgo alto", valor: millones(pAlto), dec: 1, unidad: "M hab.",
        ctx: pct(pAlto), estado: pAlto >= 1e6 ? "alerta" : pAlto > 0 ? "atencion" : "normal", metrica: "indice",
        tituloDetalle: "Población por región", detalle: detallePob(altos),
      },
      {
        id: "pob-extremo", label: "Con lluvia extrema en el pronóstico", valor: millones(pExtremo), dec: 1, unidad: "M hab.",
        ctx: pct(pExtremo), estado: pExtremo >= 1e6 ? "alerta" : pExtremo > 0 ? "atencion" : "normal", metrica: "prono",
        tituloDetalle: "Población por región", detalle: detallePob(extremo),
      },
    ],
  };

  // ---------- Economía ----------
  const sector = (nombre: string, label: string, id: string): Kpi | null => {
    const s = pbi.series[nombre];
    const ultimo = pbi.ultimo[nombre];
    if (!s?.length || !ultimo) return null;
    const ant = s[s.length - 2]?.[1] ?? ultimo[1];
    const doce = s.slice(-12);
    return {
      id, label, valor: ultimo[1], dec: 1, conSigno: true, unidad: "%",
      ctx: `${ultimo[0].replace(".", " ")} · variación interanual`,
      estado: ultimo[1] <= -5 ? "alerta" : ultimo[1] < 0 ? "atencion" : "normal",
      delta: cambio(ultimo[1] - ant, "pts", "en el mes", false),
      serie: { v: doce.map((x) => x[1]), etq: doce.map((x) => x[0].replace(".", " ")), unidad: "%" },
    };
  };
  const inflacion = (nombre: string, label: string, id: string): Kpi | null => {
    const k = sector(nombre, label, id);
    if (!k) return null;
    // en precios, subir es lo malo; el BCRP apunta a 1-3 %
    return { ...k, ctx: `${pbi.ultimo[nombre][0].replace(".", " ")} · Lima, últimos 12 meses (meta BCRP: 1-3 %)`,
      estado: k.valor > 4 ? "alerta" : k.valor > 3 ? "atencion" : "normal",
      delta: cambio(k.valor - (pbi.series[nombre].at(-2)?.[1] ?? k.valor), "pts", "en el mes") };
  };
  const kpisEco = [
    sector("PBI", "PBI", "pbi"),
    sector("Agropecuario", "Agro", "agro"),
    sector("Pesca", "Pesca", "pesca"),
    sector("Manufactura", "Manufactura", "manufactura"),
    inflacion("Inflación alimentos", "Inflación de alimentos", "infl-alim") ?? inflacion("Inflación", "Inflación", "infl"),
  ].filter((k): k is Kpi => k !== null);
  const pesca = pbi.ultimo["Pesca"]?.[1];

  const grupoEconomia: Grupo = {
    id: "economia", titulo: "Economía", corto: "Economía",
    estado: peor(...kpisEco.map((k) => k.estado)),
    resumen: pesca != null
      ? `La pesca ${pesca < 0 ? "cae" : "crece"} ${signo(pesca)} % interanual; el agro, ${signo(pbi.ultimo["Agropecuario"]?.[1] ?? 0)} %. Son los primeros sectores que golpea el FEN.`
      : "PBI y sectores más expuestos al FEN.",
    kpis: kpisEco,
  };

  return [grupoMar, grupoLluvia, grupoAlertas, grupoPersonas, grupoEconomia];
}

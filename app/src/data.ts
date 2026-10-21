// Tipos y carga de los JSON que genera el pipeline (app/public/data)

export type DiaLluvia = { f: string; ll: number | null; tx: number | null; lln: number | null; txn: number | null; llmax: number };
export type Region = {
  nombre: string; capital: string; zona: string; lat: number; lon: number;
  indice: number; tipo: string;
  componentes: Record<"lluvia" | "intensidad" | "pronostico" | "avisos" | "calor", number>;
  lluvia: {
    obs7: number; norm7: number; obs30: number; norm30: number; pct30: number | null;
    obs60: number; norm60: number; pct60: number | null; max24: number; fc7: number; normfc7: number; fcmax: number;
  };
  tmax_anom7: number;
  avisos: number[];
};
export type Regiones = { actualizado: string; hoy: string; pesos: Record<string, number>; ranking: string[]; regiones: Record<string, Region> };
export type Aviso = {
  numero: number; estado: string; titulo: string; emision: string; inicio: string; fin: string; duracion: string;
  nivel: "ROJO" | "NARANJA" | "AMARILLO"; nivel_n: number; descripcion: string; departamentos: string[]; url: string;
};
export type Mar = {
  actualizado: string;
  indices: {
    ultimas: { f: string; n12: number; n12a: number; n3a: number; n34: number; n34a: number; n4a: number }[];
    eventos: { anio: number; etiqueta: string; puntos: [number, number, number][] }[];
    picos: Record<string, number>;
  };
  costa: { nombre: string; lat: number; lon: number; diario: [string, number][]; actual: number; hace30: number }[];
};
export type Enfen = { actualizado: string; numero: string; fecha: string; estado: string; titular: string; resumen: string; url: string };
export type Pbi = { actualizado: string; fuente: string; series: Record<string, [string, number][]>; ultimo: Record<string, [string, number]> };
export type Capa = { titulo: string; unidad: string; fuente: string; plantilla: string; zoom_max: number; fechas: string[]; leyenda: { color: string; valor: string }[] };
export type Lluvia = { actualizado: string; hoy: string; departamentos: Record<string, { nombre: string; capital: string; puntos: number; diario: DiaLluvia[] }> };
export type Estado = { corrida: string; fuentes: Record<string, { nombre: string; ok: boolean; ultimo_ok: string | null; error?: string }> };

export type Datos = {
  regiones: Regiones; avisos: Aviso[]; mar: Mar; enfen: Enfen; pbi: Pbi; lluvia: Lluvia;
  capas: Record<string, Capa>; estado: Estado | null; topo: any;
};

async function j<T>(nombre: string): Promise<T> {
  const r = await fetch(`./data/${nombre}`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`No se pudo cargar ${nombre}`);
  return r.json();
}

export async function cargarDatos(): Promise<Datos> {
  const [regiones, avisos, mar, enfen, pbi, lluvia, capas, topo, estado] = await Promise.all([
    j<Regiones>("regiones.json"), j<{ avisos: Aviso[] }>("avisos.json"), j<Mar>("mar.json"), j<Enfen>("enfen.json"),
    j<Pbi>("pbi.json"), j<Lluvia>("lluvia.json"), j<{ capas: Record<string, Capa> }>("capas.json"),
    j<any>("departamentos.topo.json"), j<Estado>("estado.json").catch(() => null),
  ]);
  return { regiones, avisos: avisos.avisos, mar, enfen, pbi, lluvia, capas: capas.capas, topo, estado };
}

// ---------- Formato ----------
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
export const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
};
export const horaAct = (iso: string) => {
  const d = new Date(iso);
  return `${fechaCorta(iso)}, ${d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" })}`;
};
export const fmt = (n: number | null | undefined, dec = 0) =>
  n == null ? "—" : n.toLocaleString("es-PE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const signo = (n: number, dec = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n), dec)}`;

// Magnitud ENFEN del Niño costero según la anomalía en Niño 1+2 (°C)
export function magnitud(a: number) {
  if (a >= 3) return "Extraordinaria";
  if (a >= 1.7) return "Fuerte";
  if (a >= 1) return "Moderada";
  if (a >= 0.4) return "Débil";
  return "Neutral";
}

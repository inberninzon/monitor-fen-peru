// Escalas de color del mapa y de las barras. Una sola tonalidad para magnitud,
// dos polos + gris para lluvia vs normal, y colores de estado solo para niveles de aviso.

export const INDICE_RAMP = ["#fde9dc", "#f9c4a5", "#f39a6e", "#eb6834", "#c4481a", "#8f300f"];
export const INDICE_STOPS = [0, 15, 30, 45, 60, 75];

// % de la normal: déficit (rojo) <-> exceso (azul), 100% = gris neutro
export const DIVERGENTE = ["#b8322f", "#e07a6d", "#f2b8ad", "#d9d8d2", "#9ec5f4", "#5598e7", "#1c5cab"];
export const DIVERGENTE_STOPS = [25, 50, 80, 100, 150, 250, 400];

export const LLUVIA_RAMP = ["#e3eefc", "#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#0d366b"];
export const LLUVIA_STOPS = [0, 5, 15, 30, 60, 100, 150];

export const NIVEL_COLOR: Record<number, string> = { 0: "transparent", 1: "#fab219", 2: "#ec835a", 3: "#d03b3b" };
export const NIVEL_NOMBRE: Record<number, string> = { 0: "Sin aviso", 1: "Amarillo", 2: "Naranja", 3: "Rojo" };

export function interpolar(stops: number[], colores: string[], v: number) {
  if (v <= stops[0]) return colores[0];
  for (let i = 1; i < stops.length; i++) if (v < stops[i]) return colores[i - 1];
  return colores[colores.length - 1];
}

export const colorIndice = (v: number) => interpolar(INDICE_STOPS, INDICE_RAMP, v);

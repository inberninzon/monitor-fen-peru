// Población estimada por departamento (INEI, estimaciones y proyecciones al 2025, redondeada a miles).
// Es un dato fijo: sirve para medir cuánta gente vive en las regiones bajo aviso o en riesgo.
export const POBLACION: Record<string, number> = {
  "01": 437_000, "02": 1_227_000, "03": 437_000, "04": 1_566_000, "05": 682_000,
  "06": 1_486_000, "07": 1_197_000, "08": 1_393_000, "09": 371_000, "10": 782_000,
  "11": 1_008_000, "12": 1_412_000, "13": 2_105_000, "14": 1_371_000, "15": 11_100_000,
  "16": 1_061_000, "17": 189_000, "18": 200_000, "19": 274_000, "20": 2_152_000,
  "21": 1_254_000, "22": 942_000, "23": 383_000, "24": 268_000, "25": 621_000,
};
export const POBLACION_PERU = Object.values(POBLACION).reduce((a, b) => a + b, 0);

# Monitor FEN Perú

Dashboard para seguir El Niño 2026-27 en el Perú: qué regiones están más afectadas y qué pasa día a día.

- **Hoy**: estado oficial del ENFEN, anomalía del mar en la región Niño 1+2, avisos SENAMHI, regiones más afectadas, comparación de 2026 con los Niños de 1982-83, 1997-98, 2015-16, 2017 y 2023-24, el mar en la costa, el pronóstico de lluvia y el PBI.
- **Mapa vivo**: regiones coloreadas por afectación, lluvia, sequía, pronóstico o avisos; mar y lluvia por satélite con animación de 30 días; al tocar el mar se ve su temperatura y al tocar una región, su ficha.

## Cómo correrlo

```bash
cd pipeline && python3 run_all.py      # descarga y procesa los datos (≈2 min; la primera vez ≈5 min)
cd app && npm install && npm run dev   # abre http://localhost:5173
```

## Estructura

| Carpeta | Qué hay |
|---|---|
| `pipeline/` | Un script por fuente (`mar`, `lluvia`, `avisos`, `enfen`, `bcrp`, `capas`) y `indice.py`, que calcula el índice de afectación. `run_all.py` los corre todos; si una fuente falla, conserva su último dato y la marca como atrasada. |
| `pipeline/cache/` | Normal climática ERA5 ya descargada (solo se piden los días nuevos). |
| `app/public/data/` | JSON que lee la página. |
| `app/src/` | Página en React + TypeScript, con MapLibre (mapa) y ECharts (gráficos). |
| `.github/workflows/actualizar.yml` | Corre el pipeline a las 6:00 y 18:00 (hora de Lima) y publica en GitHub Pages. |
| `docs/inventario-fuentes.md` | Fuentes probadas y su estado. |

## Fuentes
NOAA CPC (índices Niño), Open-Meteo (lluvia, temperatura, mar y pronóstico), ERA5 (normal 2006-2020), SENAMHI (avisos), ENFEN (comunicados), BCRP (PBI), NASA GIBS (mar y lluvia por satélite), pe-atlas/INEI (límites) y Esri (mapa base).

El **índice de afectación** es un cálculo propio y no un indicador oficial: sirve para comparar regiones entre sí. Sus componentes y pesos están en `pipeline/indice.py`.

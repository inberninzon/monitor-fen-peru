# Monitor FEN Perú

Dashboard para seguir El Niño 2026-27 en el Perú: qué regiones están más afectadas y qué pasa día a día.

- **Hoy**: estado oficial del ENFEN y los indicadores en cinco grupos — **Mar** (Niño 1+2 y su tendencia, semanas seguidas con El Niño, Niño 3.4, mar en la costa y la comparación de 2026 con los Niños de 1982-83, 1997-98, 2015-16, 2017 y 2023-24), **Lluvia y calor** (lluvia extrema pronosticada, exceso, máximo en 24 h, déficit y calor), **Alertas** (avisos SENAMHI y regiones más afectadas), **Personas** (población expuesta, con la estimación INEI 2025 de `app/src/poblacion.ts`) y **Economía** (PBI, sectores e inflación). Los umbrales están en `app/src/kpis.ts`. En pantallas grandes los grupos se recorren con un índice lateral; en el celular, con pestañas que se deslizan.
- **Mapa vivo**: regiones coloreadas por afectación, lluvia, sequía, pronóstico o avisos; mar y lluvia por satélite con animación de 30 días; al tocar el mar se ve su temperatura y al tocar una región, su ficha.
  Con el selector **Nivel** se pasa de las 25 regiones a las **196 provincias**, cada una con su lluvia, calor e índice (un punto en el centro de la provincia; dos en las más grandes). Los avisos SENAMHI se publican por departamento, así que cada provincia toma los del suyo. El nivel distrito se descartó: los modelos de lluvia miden en celdas de 9 a 28 km y no darían datos reales por distrito.

Sitio: https://inberninzon.github.io/monitor-fen-peru/

## Actualizar los datos
Doble clic en `actualizar.command` (o `./actualizar.command` en la terminal). El pipeline corre en la Mac porque desde los servidores de GitHub no se llega a SENAMHI ni al ENFEN.

### Cupo de Open-Meteo y la normal de las provincias
La API gratuita admite unas 10 000 llamadas al día (5 000 por hora), y un pedido de más de 14 días cuenta como varias. Por eso la normal climática (ERA5) de cada día del año se calcula **una sola vez por punto** y se guarda en `pipeline/cache/normal_diaria.json`. Cada corrida gasta como máximo 3 500 llamadas en eso (`FEN_TOPE_NORMAL`). Armar la normal de las 196 provincias cuesta unas 25 000 llamadas, así que se completa en unas 7 corridas. Mientras una provincia no tiene su normal, el mapa y su ficha muestran los datos de su departamento, con una nota. Después cada corrida usa ~1 300 llamadas.

## Cómo correrlo en local

```bash
cd pipeline && python3 run_all.py      # descarga y procesa los datos (≈2 min; la primera vez ≈5 min)
cd app && npm install && npm run dev   # abre http://localhost:5173
```

## Estructura

| Carpeta | Qué hay |
|---|---|
| `pipeline/` | Un script por fuente (`mar`, `lluvia`, `avisos`, `enfen`, `bcrp`, `capas`) y `indice.py`, que calcula el índice de afectación por región y por provincia. `run_all.py` los corre todos; si una fuente falla, conserva su último dato y la marca como atrasada. `departamentos.topo.json` es el contorno sobre el que se eligen los puntos de cada región. |
| `pipeline/cache/` | Normal climática ERA5: `normal_diaria.json` (ya calculada, por punto y día del año) y `era5_diario.json` (días ERA5 que todavía hacen falta para calcularla). |
| `app/public/data/` | JSON que lee la página. `peru.topo.json` (límites de regiones y provincias), `provincias.json` (índice por provincia) y `lluvia_prov.json` (serie diaria por provincia, se baja solo al abrir su ficha). |
| `app/src/` | Página en React + TypeScript, con MapLibre (mapa) y ECharts (gráficos). |
| `actualizar.command` | Corre el pipeline en la Mac y sube los datos a GitHub (doble clic). |
| `.github/workflows/publicar.yml` | Cada vez que llega algo a `main`, arma el sitio y lo publica en GitHub Pages. |
| `docs/inventario-fuentes.md` | Fuentes probadas y su estado. |

## Fuentes
NOAA CPC (índices Niño), Open-Meteo (lluvia, temperatura, mar y pronóstico), ERA5 (normal 2006-2020), SENAMHI (avisos), ENFEN (comunicados), BCRP (PBI), NASA GIBS (mar y lluvia por satélite), pe-atlas/INEI (límites) y Esri (mapa base).

El **índice de afectación** es un cálculo propio y no un indicador oficial: sirve para comparar regiones entre sí. Sus componentes y pesos están en `pipeline/indice.py`.

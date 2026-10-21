# Inventario de fuentes — Dashboard FEN Perú

Pruebas reales hechas el 21-oct-2026. Estado: ✅ responde con datos · ⚠️ responde, pero hay que extraer el dato del HTML/PDF · ❌ no respondió o está bloqueada.

| Tema | Fuente | Estado | Cómo se consume | Dato real obtenido |
|---|---|---|---|---|
| Mar – índices Niño | NOAA CPC `wksst9120.for` (texto semanal) | ✅ | Descarga directa, sin clave | Niño 1+2 al 14-oct-2026: 26,2 °C, **anomalía +5,2 °C**; Niño 3.4 +1,1 °C |
| Mar – TSM en un punto | Open-Meteo Marine (`sea_surface_temperature`, horario) | ✅ | JSON, sin clave, CORS | Serie horaria frente a Paita |
| Mar – capa del mapa | NASA GIBS WMTS `GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies` | ✅ | Tiles diarios, CORS | Capa de anomalía de TSM disponible |
| Mar – grilla diaria | NOAA PSL `sst.day.anom.2026.nc` (OISST) | ✅ | NetCDF (458 MB): leer por OPeNDAP solo el recorte de Perú | — |
| Mar – grilla diaria | ERDDAP CoastWatch (`ncdcOisst21NrtAgg`, `ncepNinoSSTwk`) | ❌ | Sin respuesta o error 400 en la prueba | Se usa PSL y CPC en su lugar |
| Mar – estado oficial | ENFEN (enfen.imarpe.gob.pe) | ⚠️ | Extraer enlaces y PDF de los comunicados | Comunicados 12 al 18-2026 enlazados |
| Lluvia – observada y pronóstico | Open-Meteo Forecast (`precipitation_sum`, 92 días atrás + 16 adelante) | ✅ | JSON, sin clave | Piura: 21,2 mm el 20-oct |
| Lluvia – capa del mapa | NASA GIBS `IMERG_Precipitation_Rate` | ✅ | Tiles, CORS | — |
| Avisos meteorológicos | SENAMHI `?p=aviso-meteorologico` | ⚠️ | Extraer los avisos vigentes (una página por aviso: `aviso-meteorologico-vigente&b=<n>`) | Avisos 29291–29296 vigentes |
| Sequía | SENAMHI boletín mensual SPI | ⚠️ | PDF mensual | — |
| Sequía – capa | Copernicus GDO (WMS: CDI, SPI, humedad del suelo) | Por probar | WMS | — |
| Ríos | ANA – SNIRH/Observatorio (`snirh.ana.gob.pe/onrh/`) | ⚠️ | Sitio responde; falta ubicar el servicio de datos | — |
| Emergencias | INDECI (gob.pe/indeci, reportes COEN) | ⚠️ | Reportes PDF/web | — |
| Datos abiertos del Estado | datosabiertos.gob.pe | ❌ | Bloqueado por el firewall (WAF) para pedidos automáticos | — |
| Ejecución presupuestal | MEF – Consulta Amigable | ⚠️ | Responde; hay que navegar sus formularios | — |
| Dengue | CDC-MINSA sala situacional | ⚠️ | La página carga su contenido aparte; falta ubicarlo | — |
| PBI | BCRP API (`/series/api/<código>/json/<inicio>/<fin>`) | ✅ | JSON, sin clave | PBI desestacionalizado ene–jul 2026 |
| Límites | `pe-atlas` (npm, TopoJSON INEI) | ✅ | Archivo estático | Departamentos con ubigeo |

## Conclusión
- **Ya hay una base diaria y confiable:** el mar (CPC, Open-Meteo, GIBS), la lluvia (Open-Meteo, GIBS) y el PBI (BCRP) funcionan sin clave. Con eso se arma el prototipo de **Hoy** y **Mapa vivo**.
- **Fuentes peruanas oficiales** (SENAMHI, ENFEN, INDECI, ANA, MEF): todas responden, pero hay que extraer el dato de páginas o PDF. Cada una lleva su script en el pipeline, con alerta si cambia el formato.
- **Descartadas por ahora:** ERDDAP CoastWatch (inestable) y datosabiertos.gob.pe (bloquea los pedidos automáticos).

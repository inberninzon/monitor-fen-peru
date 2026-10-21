import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map as MLMap, RasterTileSource } from "maplibre-gl";
import { feature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import { Datos, fechaCorta, fmt, signo } from "../data";
import {
  colorIndice, DIVERGENTE, DIVERGENTE_STOPS, INDICE_RAMP, INDICE_STOPS, interpolar,
  LLUVIA_RAMP, LLUVIA_STOPS, NIVEL_COLOR, NIVEL_NOMBRE,
} from "../escalas";
import { Ficha } from "../components/Ficha";

export type Metrica = "indice" | "lluvia7" | "lluvia60" | "prono" | "avisos" | "mar";

const METRICAS: { id: Metrica; nombre: string; desc: string }[] = [
  { id: "indice", nombre: "Afectación", desc: "Índice 0-100 que combina lluvia, déficit, pronóstico, avisos y calor. Más oscuro = más afectada." },
  { id: "lluvia7", nombre: "Lluvia 7 días", desc: "Lluvia de la última semana como % de lo normal. Azul = más de lo normal; rojo = menos." },
  { id: "lluvia60", nombre: "Sequía 60 días", desc: "Lluvia de los últimos 60 días como % de lo normal. Rojo indica déficit (riesgo de sequía)." },
  { id: "prono", nombre: "Pronóstico", desc: "Lluvia esperada en los próximos 7 días (mm)." },
  { id: "avisos", nombre: "Avisos", desc: "Nivel más alto de aviso SENAMHI vigente o próximo en cada región." },
  { id: "mar", nombre: "Solo mar", desc: "Quita el color de las regiones para ver el mar: anomalía de temperatura por satélite y temperatura en la costa." },
];

const PERU: [number, number, number, number] = [-84.5, -18.6, -68.5, 0.2];

function valorRegion(datos: Datos, id: string, m: Metrica): { valor: number | null; color: string; texto: string } {
  const r = datos.regiones.regiones[id];
  if (!r) return { valor: null, color: "transparent", texto: "—" };
  const hoy = datos.regiones.hoy;
  switch (m) {
    case "indice":
      return { valor: r.indice, color: colorIndice(r.indice), texto: `Índice ${r.indice}` };
    case "lluvia7": {
      if (r.lluvia.norm7 < 3 && r.lluvia.obs7 < 3) return { valor: null, color: "#d9d8d2", texto: "Época seca: casi sin lluvia normal ni observada" };
      const pct = (100 * (r.lluvia.obs7 + 1)) / (r.lluvia.norm7 + 1);
      return { valor: pct, color: interpolar(DIVERGENTE_STOPS, DIVERGENTE, pct), texto: `${fmt(pct)}% de lo normal (${fmt(r.lluvia.obs7)} mm)` };
    }
    case "lluvia60": {
      if (r.lluvia.norm60 < 15) return { valor: null, color: "#d9d8d2", texto: "Época seca: la normal es casi cero" };
      const pct = (100 * r.lluvia.obs60) / r.lluvia.norm60;
      return { valor: pct, color: interpolar(DIVERGENTE_STOPS, DIVERGENTE, pct), texto: `${fmt(pct)}% de lo normal (${fmt(r.lluvia.obs60)} de ${fmt(r.lluvia.norm60)} mm)` };
    }
    case "prono":
      return { valor: r.lluvia.fc7, color: interpolar(LLUVIA_STOPS, LLUVIA_RAMP, r.lluvia.fc7), texto: `${fmt(r.lluvia.fc7)} mm en 7 días (normal ${fmt(r.lluvia.normfc7)})` };
    case "avisos": {
      const nivel = Math.max(0, ...datos.avisos.filter((a) => a.fin >= hoy && a.departamentos.includes(id)).map((a) => a.nivel_n));
      return { valor: nivel, color: nivel ? NIVEL_COLOR[nivel] : "#d9d8d2", texto: `Aviso más alto: ${NIVEL_NOMBRE[nivel]}` };
    }
    default:
      return { valor: null, color: "transparent", texto: "" };
  }
}

function estiloBase(oscuro: boolean): maplibregl.StyleSpecification {
  const v = oscuro ? "Dark" : "Light";
  const esri = (capa: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${v}_Gray_${capa}/MapServer/tile/{z}/{y}/{x}`;
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      base: { type: "raster", tiles: [esri("Base")], tileSize: 256, maxzoom: 16,
        attribution: "Mapa base © Esri, HERE, Garmin, © OpenStreetMap" },
      etiquetas: { type: "raster", tiles: [esri("Reference")], tileSize: 256, maxzoom: 16 },
    },
    layers: [
      { id: "fondo", type: "background", paint: { "background-color": oscuro ? "#0b0f10" : "#eef0ee" } },
      { id: "base", type: "raster", source: "base" },
    ],
  };
}

type Props = {
  datos: Datos; oscuro: boolean; region: string | null; setRegion: (r: string | null) => void;
  metrica: Metrica; setMetrica: (m: Metrica) => void;
};

export function Mapa({ datos, oscuro, region, setRegion, metrica, setMetrica }: Props) {
  const contRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [listo, setListo] = useState(false);
  const [verMar, setVerMar] = useState(true);
  const [verSat, setVerSat] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const capaMar = datos.capas.mar;
  const capaSat = datos.capas.lluvia_sat;
  const fechasSat = useMemo(() => {
    const base = verSat ? capaSat.fechas : capaMar.fechas;
    return (verMar && verSat ? base.filter((f) => capaMar.fechas.includes(f)) : base).slice(-30);
  }, [verMar, verSat, capaMar, capaSat]);
  const [iFecha, setIFecha] = useState(fechasSat.length - 1);
  const [reproduciendo, setReproduciendo] = useState(false);
  const fecha = fechasSat[Math.min(iFecha, fechasSat.length - 1)];

  const geo = useMemo(() => feature(datos.topo, datos.topo.objects.departments) as unknown as FeatureCollection, [datos.topo]);

  const geoPintado = useMemo<FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: geo.features.map((f) => {
      const id = String(f.id);
      const v = valorRegion(datos, id, metrica);
      return { ...f, id: Number(id), properties: { ...f.properties, did: id, nombre: datos.regiones.regiones[id]?.nombre ?? id, color: v.color, texto: v.texto } };
    }),
  }), [geo, datos, metrica]);

  // ---------- Crear mapa ----------
  useEffect(() => {
    if (!contRef.current) return;
    const map = new maplibregl.Map({
      container: contRef.current, style: estiloBase(oscuro), bounds: PERU, fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, maxZoom: 9, minZoom: 3,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      const plantilla = (c: typeof capaMar, f: string) => c.plantilla.replace("{fecha}", f);
      map.addSource("mar", { type: "raster", tiles: [plantilla(capaMar, capaMar.fechas[capaMar.fechas.length - 1])], tileSize: 256, maxzoom: capaMar.zoom_max,
        attribution: "NASA GIBS / GHRSST MUR" });
      map.addLayer({ id: "mar", type: "raster", source: "mar", paint: { "raster-opacity": 0.75, "raster-fade-duration": 0 } });
      map.addSource("sat", { type: "raster", tiles: [plantilla(capaSat, capaSat.fechas[capaSat.fechas.length - 1])], tileSize: 256, maxzoom: capaSat.zoom_max,
        attribution: "NASA GIBS / GPM IMERG" });
      map.addLayer({ id: "sat", type: "raster", source: "sat", layout: { visibility: "none" }, paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 } });

      map.addSource("deps", { type: "geojson", data: geoPintado });
      map.addLayer({ id: "deps-fill", type: "fill", source: "deps", paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.92, 0.78],
      } });
      map.addLayer({ id: "deps-line", type: "line", source: "deps", paint: {
        "line-color": oscuro ? "#0b0f10" : "#ffffff", "line-width": 1,
      } });
      map.addLayer({ id: "deps-sel", type: "line", source: "deps", filter: ["==", ["get", "did"], ""], paint: {
        "line-color": oscuro ? "#ffffff" : "#0b0b0b", "line-width": 3,
      } });
      map.addLayer({ id: "etiquetas", type: "raster", source: "etiquetas", paint: { "raster-opacity": 0.9 } });

      // Puntos de la costa con la temperatura del mar de hoy
      map.addSource("costa", { type: "geojson", data: {
        type: "FeatureCollection",
        features: datos.mar.costa.map((c) => ({ type: "Feature", geometry: { type: "Point", coordinates: [c.lon, c.lat] },
          properties: { nombre: c.nombre, actual: c.actual, cambio: c.actual - c.hace30, txt: `${fmt(c.actual, 1)}°` } })),
      } });
      map.addLayer({ id: "costa", type: "circle", source: "costa", paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4, 8, 8],
        "circle-color": "#ffffff", "circle-stroke-color": "#1c5cab", "circle-stroke-width": 2,
      } });
      map.addLayer({ id: "costa-txt", type: "symbol", source: "costa", minzoom: 4.6, layout: {
        "text-field": ["get", "txt"], "text-size": 11, "text-offset": [-1.6, 0], "text-anchor": "right",
        "text-font": ["Noto Sans Bold"],
      }, paint: { "text-color": oscuro ? "#ffffff" : "#0b0b0b", "text-halo-color": oscuro ? "#0b0f10" : "#ffffff", "text-halo-width": 1.5 } });

      setListo(true);
    });

    // Hover
    let hoverId: number | string | undefined;
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "tip" });
    map.on("mousemove", "deps-fill", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      if (hoverId !== undefined) map.setFeatureState({ source: "deps", id: hoverId }, { hover: false });
      hoverId = f.id;
      map.setFeatureState({ source: "deps", id: hoverId! }, { hover: true });
      map.getCanvas().style.cursor = "pointer";
      if (matchMedia("(hover: hover)").matches) {
        tip.setLngLat(e.lngLat).setHTML(`<div class="popup-mar"><strong>${f.properties!.nombre}</strong><br/>${f.properties!.texto}</div>`).addTo(map);
      }
    });
    map.on("mouseleave", "deps-fill", () => {
      if (hoverId !== undefined) map.setFeatureState({ source: "deps", id: hoverId }, { hover: false });
      hoverId = undefined;
      map.getCanvas().style.cursor = "";
      tip.remove();
    });

    // Clic: región -> ficha; mar -> temperatura en ese punto
    map.on("click", async (e) => {
      const enCosta = map.queryRenderedFeatures(e.point, { layers: ["costa"] })[0];
      if (enCosta) {
        const p = enCosta.properties as any;
        new maplibregl.Popup({ offset: 10 }).setLngLat(e.lngLat).setHTML(
          `<div class="popup-mar"><div style="font-size:12px;color:#555">${p.nombre} · temperatura del mar hoy</div><b>${fmt(p.actual, 1)} °C</b><div style="font-size:12px">${signo(p.cambio)} °C en 30 días</div></div>`).addTo(map);
        return;
      }
      const dep = map.queryRenderedFeatures(e.point, { layers: ["deps-fill"] })[0];
      if (dep) { setRegion(String(dep.properties!.did)); return; }
      const pop = new maplibregl.Popup({ offset: 6 }).setLngLat(e.lngLat).setHTML('<div class="popup-mar">Consultando el mar…</div>').addTo(map);
      try {
        const { lat, lng } = e.lngLat;
        const r = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&hourly=sea_surface_temperature&past_days=7&forecast_days=1&timezone=America%2FLima`);
        const d = await r.json();
        const v: (number | null)[] = d?.hourly?.sea_surface_temperature ?? [];
        const validos = v.filter((x): x is number => x != null);
        if (!validos.length) { pop.setHTML('<div class="popup-mar">Aquí no hay dato de mar. Toca el océano o una región.</div>'); return; }
        const ahora = validos[validos.length - 1];
        const antes = validos[0];
        pop.setHTML(`<div class="popup-mar"><div style="font-size:12px;color:#555">Temperatura del mar aquí</div><b>${fmt(ahora, 1)} °C</b><div style="font-size:12px">${signo(ahora - antes)} °C en 7 días</div><div style="font-size:11px;color:#777;margin-top:4px">${lat.toFixed(2)}°, ${lng.toFixed(2)}° · Open-Meteo Marine</div></div>`);
      } catch {
        pop.setHTML('<div class="popup-mar">No se pudo consultar el mar ahora.</div>');
      }
    });

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Actualizar colores ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!listo || !map) return;
    (map.getSource("deps") as GeoJSONSource).setData(geoPintado);
    map.setPaintProperty("deps-fill", "fill-opacity", metrica === "mar"
      ? 0 : ["case", ["boolean", ["feature-state", "hover"], false], 0.92, 0.78]);
  }, [geoPintado, listo, metrica]);

  useEffect(() => {
    const map = mapRef.current;
    if (!listo || !map) return;
    map.setFilter("deps-sel", ["==", ["get", "did"], region ?? ""]);
    if (region) {
      const r = datos.regiones.regiones[region];
      const movil = innerWidth <= 760;
      // en el celular la ficha tapa la mitad inferior: se centra la región en la mitad visible
      map.easeTo({ center: [r.lon, r.lat], zoom: Math.max(map.getZoom(), 5.2), duration: 800,
        padding: movil ? { top: 40, bottom: Math.round(innerHeight * 0.55), left: 0, right: 0 } : { top: 0, bottom: 0, left: 300, right: 400 } });
    }
  }, [region, listo, datos]);

  useEffect(() => {
    const map = mapRef.current;
    if (!listo || !map) return;
    map.setLayoutProperty("mar", "visibility", verMar || metrica === "mar" ? "visible" : "none");
    map.setLayoutProperty("sat", "visibility", verSat ? "visible" : "none");
  }, [verMar, verSat, metrica, listo]);

  useEffect(() => { if (metrica === "mar") setVerMar(true); }, [metrica]);

  // ---------- Fecha de las capas satelitales ----------
  useEffect(() => { setIFecha(fechasSat.length - 1); }, [fechasSat.length]);
  useEffect(() => {
    const map = mapRef.current;
    if (!listo || !map || !fecha) return;
    const cambiar = (fuente: string, url: string) => {
      const src = map.getSource(fuente) as RasterTileSource | undefined;
      if (!src || src.tiles?.[0] === url) return;
      try { src.setTiles([url]); } catch { /* se cancela la carga anterior: no es un error */ }
    };
    if (capaMar.fechas.includes(fecha)) cambiar("mar", capaMar.plantilla.replace("{fecha}", fecha));
    if (verSat && capaSat.fechas.includes(fecha)) cambiar("sat", capaSat.plantilla.replace("{fecha}", fecha));
  }, [fecha, listo, verSat, capaMar, capaSat]);

  useEffect(() => {
    if (!reproduciendo) return;
    const t = setInterval(() => setIFecha((i) => (i + 1) % fechasSat.length), 900);
    return () => clearInterval(t);
  }, [reproduciendo, fechasSat.length]);

  const desc = METRICAS.find((m) => m.id === metrica)!;
  const satActiva = verMar || verSat || metrica === "mar";

  return (
    <div className="mapa-wrap">
      <div id="mapa" ref={contRef} aria-label="Mapa del Perú con capas de mar, lluvia, sequía y avisos" role="region" />

      <button className="btn mobile-capas-btn" onClick={() => setPanelAbierto(!panelAbierto)} aria-expanded={panelAbierto}>
        ☰ Capas: {desc.nombre}
      </button>

      <div className={`map-ui panel capas ${panelAbierto ? "" : "cerrado"}`}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h3>Colorear regiones por</h3>
          <span style={{ flex: 1 }} />
          {panelAbierto && <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setPanelAbierto(false)} aria-label="Cerrar capas">✕</button>}
        </div>
        <div className="chips" role="radiogroup" aria-label="Métrica de las regiones">
          {METRICAS.map((m) => (
            <button key={m.id} className="chip" role="radio" aria-pressed={metrica === m.id} aria-checked={metrica === m.id}
              onClick={() => { setMetrica(m.id); }}>{m.nombre}</button>
          ))}
        </div>
        <p className="capa-desc">{desc.desc}</p>
        <h3>Capas satelitales</h3>
        <div className="chips">
          <button className="chip" aria-pressed={verMar || metrica === "mar"} onClick={() => setVerMar(!verMar)} disabled={metrica === "mar"}>
            <span className="dot" style={{ background: "linear-gradient(90deg,#4b4be6,#fff,#c00)" }} />Mar: anomalía
          </button>
          <button className="chip" aria-pressed={verSat} onClick={() => setVerSat(!verSat)}>
            <span className="dot" style={{ background: "linear-gradient(90deg,#1eb200,#ffd200,#a0007a)" }} />Lluvia satélite
          </button>
        </div>
        <p className="capa-desc">
          Toca el <strong>mar</strong> para ver su temperatura en ese punto, o una <strong>región</strong> para abrir su ficha.
        </p>
      </div>

      <div className="map-ui leyendas" hidden={!!region && innerWidth <= 760}>
        {metrica !== "mar" && <LeyendaMetrica metrica={metrica} />}
        {(verMar || metrica === "mar") && <LeyendaSat titulo={`Mar: anomalía (°C) · ${fechaCorta(fecha ?? "")}`} leyenda={capaMar.leyenda} etiquetas={["≤ −3", "0", "≥ +3"]} />}
        {verSat && <LeyendaSat titulo={`Lluvia satélite (mm/h) · ${fechaCorta(fecha ?? "")}`} leyenda={capaSat.leyenda} etiquetas={["0,1", "≈ 5", "≥ 50"]} />}
      </div>

      {satActiva && fechasSat.length > 1 && !(region && innerWidth <= 760) && (
        <div className="map-ui panel tiempo" role="group" aria-label="Fecha de las capas satelitales">
          <button className="btn primary" onClick={() => setReproduciendo(!reproduciendo)} aria-label={reproduciendo ? "Pausar" : "Reproducir últimos 30 días"}>
            {reproduciendo ? "❚❚" : "▶"}
          </button>
          <input type="range" min={0} max={fechasSat.length - 1} value={Math.min(iFecha, fechasSat.length - 1)}
            onChange={(e) => { setReproduciendo(false); setIFecha(Number(e.target.value)); }} aria-label="Día" />
          <span className="fecha num">{fechaCorta(fecha ?? "")}</span>
        </div>
      )}

      {region && datos.regiones.regiones[region] && (
        <Ficha key={region} id={region} datos={datos} cerrar={() => setRegion(null)} />
      )}
    </div>
  );
}

function LeyendaMetrica({ metrica }: { metrica: Metrica }) {
  if (metrica === "avisos") {
    return (
      <div className="panel leyenda">
        <div className="titulo">Aviso SENAMHI más alto</div>
        <div className="cats">
          {[3, 2, 1, 0].map((n) => (
            <span key={n}><i style={{ background: n ? NIVEL_COLOR[n] : "#d9d8d2" }} />{NIVEL_NOMBRE[n]}</span>
          ))}
        </div>
      </div>
    );
  }
  const conf = {
    indice: { t: "Índice de afectación", c: INDICE_RAMP, l: [String(INDICE_STOPS[0]), "45", "75+"] },
    lluvia7: { t: "Lluvia 7 días, % de lo normal", c: DIVERGENTE, l: ["< 50%", "100%", "> 250%"] },
    lluvia60: { t: "Lluvia 60 días, % de lo normal", c: DIVERGENTE, l: ["< 50%", "100%", "> 250%"] },
    prono: { t: "Lluvia pronosticada, 7 días (mm)", c: LLUVIA_RAMP, l: ["0", "30", "150+"] },
  }[metrica as "indice" | "lluvia7" | "lluvia60" | "prono"];
  return (
    <div className="panel leyenda">
      <div className="titulo">{conf.t}</div>
      <div className="grad" style={{ background: `linear-gradient(90deg, ${conf.c.join(",")})` }} />
      <div className="grad-labels"><span>{conf.l[0]}</span><span>{conf.l[1]}</span><span>{conf.l[2]}</span></div>
    </div>
  );
}

function LeyendaSat({ titulo, leyenda, etiquetas }: { titulo: string; leyenda: { color: string }[]; etiquetas: string[] }) {
  return (
    <div className="panel leyenda">
      <div className="titulo">{titulo}</div>
      <div className="grad" style={{ background: `linear-gradient(90deg, ${leyenda.map((l) => l.color).join(",")})` }} />
      <div className="grad-labels"><span>{etiquetas[0]}</span><span>{etiquetas[1]}</span><span>{etiquetas[2]}</span></div>
    </div>
  );
}

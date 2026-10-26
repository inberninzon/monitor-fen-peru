import { useCallback, useEffect, useState } from "react";
import { cargarDatos, Datos, horaAct } from "./data";
import { Hoy } from "./views/Hoy";
import { Mapa, Metrica } from "./views/Mapa";
import type { GrupoId } from "./kpis";
import { Fuentes } from "./components/Fuentes";

type Vista = "hoy" | "mapa";
type Tema = "auto" | "light" | "dark";

const leerTema = (): Tema => {
  try { return (localStorage.getItem("fen-tema") as Tema) || "auto"; } catch { return "auto"; }
};

const GRUPOS: GrupoId[] = ["mar", "lluvia", "alertas", "personas", "economia"];

function leerHash(): { vista: Vista; region: string | null; metrica: Metrica | null; grupo: GrupoId } {
  const [v, r, m] = location.hash.replace("#", "").split("/");
  const grupo = v !== "mapa" && GRUPOS.includes(r as GrupoId) ? (r as GrupoId) : "mar";
  return { vista: v === "mapa" ? "mapa" : "hoy", region: v === "mapa" ? r || null : null, metrica: (m as Metrica) || null, grupo };
}

export function App() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inicial = leerHash();
  const [vista, setVista] = useState<Vista>(inicial.vista);
  const [region, setRegion] = useState<string | null>(inicial.region);
  const [metrica, setMetrica] = useState<Metrica>(inicial.metrica ?? "indice");
  const [grupo, setGrupo] = useState<GrupoId>(inicial.grupo);
  const [tema, setTema] = useState<Tema>(leerTema);
  const [fuentes, setFuentes] = useState(false);
  const [, setVersionTema] = useState(0);

  useEffect(() => { cargarDatos().then(setDatos).catch((e) => setError(String(e))); }, []);

  useEffect(() => {
    if (tema === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", tema);
    try { localStorage.setItem("fen-tema", tema); } catch { /* sin almacenamiento */ }
    setVersionTema((n) => n + 1);
  }, [tema]);

  // Los gráficos se rehacen si el sistema cambia de claro a oscuro
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const f = () => setVersionTema((n) => n + 1);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  useEffect(() => {
    const h = vista === "mapa" ? `#mapa/${region ?? ""}/${metrica}` : `#hoy/${grupo}`;
    if (location.hash !== h) history.replaceState(null, "", h);
  }, [vista, region, metrica, grupo]);

  const irAlMapa = useCallback((r: string | null, m?: Metrica) => {
    setRegion(r);
    if (m) setMetrica(m);
    setVista("mapa");
  }, []);

  const oscuro = tema === "dark" || (tema === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const claveTema = `${tema}-${oscuro}`;

  const tabs = (
    <>
      <button className="tab" role="tab" aria-selected={vista === "hoy"} onClick={() => setVista("hoy")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
        Hoy
      </button>
      <button className="tab" role="tab" aria-selected={vista === "mapa"} onClick={() => setVista("mapa")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>
        Mapa vivo
      </button>
    </>
  );

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
            <circle cx="16" cy="16" r="15" fill="var(--accent)" />
            <path d="M3 18c4.3-4 8.7 4 13 0s8.7 4 13 0" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M5 23c3.7-3 7.3 3 11 0s7.3 3 11 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".6" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <h1>Monitor FEN Perú</h1>
            <small>{datos ? `Actualizado ${horaAct(datos.regiones.actualizado)}` : "Cargando datos…"}</small>
          </div>
        </div>
        <nav className="tabs" role="tablist" aria-label="Vistas">{tabs}</nav>
        <button className="icon-btn" onClick={() => setFuentes(true)} aria-label="Fuentes y estado de los datos" title="Fuentes y estado de los datos">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>
        </button>
        <button className="icon-btn theme-btn" onClick={() => setTema(tema === "auto" ? (oscuro ? "light" : "dark") : tema === "dark" ? "light" : "dark")}
          aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} title={oscuro ? "Tema claro" : "Tema oscuro"}>
          {oscuro
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
        </button>
      </header>

      <main className="main">
        {error && <div className="loading">No se pudieron cargar los datos: {error}</div>}
        {!datos && !error && <div className="loading">Cargando datos del día…</div>}
        {datos && vista === "hoy" && <Hoy key={claveTema} datos={datos} irAlMapa={irAlMapa} grupo={grupo} setGrupo={setGrupo} />}
        {datos && vista === "mapa" && (
          <Mapa key={`m-${oscuro}`} datos={datos} oscuro={oscuro} region={region} setRegion={setRegion}
            metrica={metrica} setMetrica={setMetrica} />
        )}
      </main>

      <nav className="bottom-nav" role="tablist" aria-label="Vistas">{tabs}</nav>
      {fuentes && datos && <Fuentes datos={datos} cerrar={() => setFuentes(false)} />}
    </div>
  );
}

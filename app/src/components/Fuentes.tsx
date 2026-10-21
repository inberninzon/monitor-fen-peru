import { useEffect } from "react";
import { Datos, horaAct } from "../data";

const DETALLE: Record<string, { que: string; url: string }> = {
  mar: { que: "Índices Niño 1+2 y 3.4 (semanal) y temperatura del mar en 12 puntos de la costa", url: "https://www.cpc.ncep.noaa.gov/data/indices/" },
  lluvia: { que: "Lluvia y temperatura máxima diaria en 49 puntos (capital + interior de cada región), 60 días atrás y 7 adelante; normal 2006-2020 de ERA5", url: "https://open-meteo.com/" },
  avisos: { que: "Avisos meteorológicos vigentes y emitidos, con su nivel y las regiones que mencionan", url: "https://www.senamhi.gob.pe/?p=aviso-meteorologico" },
  enfen: { que: "Último comunicado oficial: estado de alerta y pronóstico", url: "https://enfen.imarpe.gob.pe/comunicados/" },
  pbi: { que: "PBI y sectores, variación % interanual", url: "https://estadisticas.bcrp.gob.pe/estadisticas/series/" },
  capas: { que: "Mapas satelitales diarios: anomalía de temperatura del mar (MUR) y lluvia (IMERG)", url: "https://gibs.earthdata.nasa.gov/" },
  indice: { que: "Índice de afectación 0-100 calculado a partir de las fuentes anteriores", url: "#" },
};

export function Fuentes({ datos, cerrar }: { datos: Datos; cerrar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [cerrar]);
  const fuentes = datos.estado?.fuentes ?? {};
  return (
    <div className="modal-bg" onClick={cerrar}>
      <div className="modal panel" role="dialog" aria-modal="true" aria-labelledby="fuentes-t" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <div>
            <h2 id="fuentes-t" style={{ fontSize: 18 }}>Fuentes y estado de los datos</h2>
            <p>{datos.estado ? `Última corrida del pipeline: ${horaAct(datos.estado.corrida)}` : "Sin registro de corrida"}</p>
          </div>
          <span className="spacer" />
          <button className="icon-btn" onClick={cerrar} aria-label="Cerrar">✕</button>
        </div>
        <table>
          <thead><tr><th>Fuente</th><th>Qué aporta</th><th>Estado</th></tr></thead>
          <tbody>
            {Object.entries(DETALLE).map(([k, d]) => {
              const f = fuentes[k];
              return (
                <tr key={k}>
                  <td><a href={d.url} target="_blank" rel="noreferrer">{f?.nombre ?? k}</a></td>
                  <td className="secondary">{d.que}</td>
                  <td>
                    {f ? (f.ok ? <span className="ok">✓ Al día</span> : <span className="ko">⚠ Atrasado</span>) : <span className="muted">—</span>}
                    {f?.ultimo_ok && <div className="muted" style={{ fontSize: 12 }}>{horaAct(f.ultimo_ok)}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
          Si una fuente falla, el monitor conserva su último dato válido y lo marca como atrasado.
          El índice de afectación es un cálculo propio, no un indicador oficial: sirve para comparar regiones entre sí.
        </p>
      </div>
    </div>
  );
}

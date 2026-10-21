"""Capas satelitales NASA GIBS para el mapa: fechas disponibles (últimos 45 días) y leyenda de colores."""
import re
from datetime import date, timedelta

from comun import ahora_lima, escribir, get

CAPS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml"
CAPAS = {
    "mar": {"id": "GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies", "titulo": "Anomalía de temperatura del mar",
            "unidad": "°C", "fuente": "NASA GIBS · GHRSST MUR (JPL)"},
    "lluvia_sat": {"id": "IMERG_Precipitation_Rate", "titulo": "Lluvia por satélite (tasa diaria)",
                   "unidad": "mm/h", "fuente": "NASA GIBS · GPM IMERG"},
}


def _fechas(bloque, desde: date):
    fechas = set()
    for ini, fin in re.findall(r"<Value>(\d{4}-\d{2}-\d{2})/(\d{4}-\d{2}-\d{2})/P1D</Value>", bloque):
        f, f_fin = max(date.fromisoformat(ini), desde), date.fromisoformat(fin)
        while f <= f_fin:
            fechas.add(f.isoformat())
            f += timedelta(days=1)
    return sorted(fechas)


def _leyenda(url, max_paradas=11):
    xml = get(url, timeout=90).text
    entradas = re.findall(r'<ColorMapEntry rgb="(\d+),(\d+),(\d+)" transparent="false"[^>]*value="([^"]+)"', xml)
    if not entradas:
        return []
    paso = max(1, len(entradas) // (max_paradas - 1))
    elegidas = entradas[::paso]
    if elegidas[-1] != entradas[-1]:
        elegidas.append(entradas[-1])
    return [{"color": f"rgb({r},{g},{b})", "valor": v} for r, g, b, v in elegidas]


def construir():
    xml = get(CAPS, timeout=120).text
    desde = ahora_lima().date() - timedelta(days=45)
    salida = {}
    for clave, meta in CAPAS.items():
        i = xml.find(f"<ows:Identifier>{meta['id']}</ows:Identifier>")
        bloque = xml[xml.rfind("<Layer>", 0, i):xml.find("</Layer>", i)]
        matriz = re.search(r"<TileMatrixSet>([^<]+)</TileMatrixSet>", bloque).group(1)
        mapa_color = re.search(r"(https://gibs\.earthdata\.nasa\.gov/colormaps/v1\.3/[^']+\.xml)", bloque).group(1)
        salida[clave] = {
            **meta,
            "plantilla": f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{meta['id']}/default/{{fecha}}/{matriz}/{{z}}/{{y}}/{{x}}.png",
            "zoom_max": int(matriz.rsplit("Level", 1)[1]),
            "fechas": _fechas(bloque, desde),
            "leyenda": _leyenda(mapa_color),
        }
    escribir("capas.json", {"actualizado": ahora_lima().isoformat(timespec="minutes"), "capas": salida})
    return salida


if __name__ == "__main__":
    for k, v in construir().items():
        print(k, v["fechas"][-3:], len(v["fechas"]), v["leyenda"][:2], v["leyenda"][-1])

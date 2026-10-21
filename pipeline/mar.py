"""Mar: índices Niño semanales (NOAA CPC) y temperatura frente a la costa peruana (Open-Meteo Marine)."""
import re
from datetime import date, datetime

from comun import ahora_lima, escribir, get

CPC = "https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for"

# Puntos mar adentro, de norte a sur
COSTA = [
    ("Zorritos", -3.70, -81.00), ("Máncora", -4.10, -81.30), ("Paita", -5.10, -81.40),
    ("Pimentel", -6.85, -80.10), ("Salaverry", -8.30, -79.20), ("Chimbote", -9.10, -78.80),
    ("Huacho", -11.15, -77.80), ("Callao", -12.05, -77.35), ("Pisco", -13.75, -76.45),
    ("Marcona", -15.40, -75.40), ("Ilo", -17.75, -71.50), ("Tacna (costa)", -18.15, -70.65),
]

# Años de inicio de los eventos que se comparan (la serie va de enero de ese año a junio del siguiente)
EVENTOS = {1982: "1982-83", 1997: "1997-98", 2015: "2015-16", 2016: "2017 (costero)", 2023: "2023-24", 2026: "2026-27"}


def indices():
    texto = get(CPC, timeout=90).text
    filas = []
    # Ancho fijo: cuando la anomalía es negativa el signo queda pegado a la temperatura ("20.6-0.1")
    par = r"\s+(-?\d+\.\d)\s*(-?\d+\.\d)"
    for m in re.finditer(rf"^\s*(\d{{2}}[A-Z]{{3}}\d{{4}}){par * 4}\s*$", texto, re.M):
        f = datetime.strptime(m.group(1), "%d%b%Y").date()
        v = [float(x) for x in m.groups()[1:]]
        filas.append({"f": f.isoformat(), "n12": v[0], "n12a": v[1], "n3a": v[3],
                      "n34": v[4], "n34a": v[5], "n4a": v[7]})
    eventos = []
    for anio, etiqueta in EVENTOS.items():
        ini, fin = date(anio, 1, 1), date(anio + 1, 6, 30)
        puntos = [[(date.fromisoformat(r["f"]) - ini).days, r["n12a"], r["n34a"]]
                  for r in filas if ini <= date.fromisoformat(r["f"]) <= fin]
        eventos.append({"anio": anio, "etiqueta": etiqueta, "puntos": puntos})
    return {"ultimas": filas[-60:], "eventos": eventos,
            "picos": {e["etiqueta"]: max((p[1] for p in e["puntos"]), default=None) for e in eventos}}


def costa():
    d = get(
        "https://marine-api.open-meteo.com/v1/marine",
        params={"latitude": ",".join(str(c[1]) for c in COSTA), "longitude": ",".join(str(c[2]) for c in COSTA),
                "hourly": "sea_surface_temperature", "past_days": 30, "forecast_days": 1, "timezone": "America/Lima"},
        as_json=True, timeout=90,
    )
    d = d if isinstance(d, list) else [d]
    salida = []
    for (nombre, lat, lon), serie in zip(COSTA, d):
        por_dia = {}
        for t, v in zip(serie["hourly"]["time"], serie["hourly"]["sea_surface_temperature"]):
            if v is not None:
                por_dia.setdefault(t[:10], []).append(v)
        diario = [[f, round(sum(v) / len(v), 2)] for f, v in sorted(por_dia.items())]
        salida.append({"nombre": nombre, "lat": lat, "lon": lon, "diario": diario,
                       "actual": diario[-1][1] if diario else None,
                       "hace30": diario[0][1] if diario else None})
    return salida


def construir():
    datos = {"actualizado": ahora_lima().isoformat(timespec="minutes"), "indices": indices(), "costa": costa()}
    escribir("mar.json", datos)
    return datos


if __name__ == "__main__":
    d = construir()
    print(d["indices"]["ultimas"][-1], d["indices"]["picos"])
    print([(c["nombre"], c["actual"], c["hace30"]) for c in d["costa"]])

"""Lluvia y temperatura por departamento: observado (60 días), pronóstico (7 días) y normal climática.

- Observado y pronóstico: Open-Meteo (modelos globales, sin clave).
- Normal: reanálisis ERA5 vía Open-Meteo Archive, años 2006-2020. Solo se descarga la ventana de
  fechas que se usa (60 días atrás a 7 adelante, más 15 días de margen para suavizar) y se guarda en
  caché, así cada corrida diaria solo pide los días nuevos.
  (Se probó NASA POWER/MERRA-2, pero subestima mucho la lluvia en los Andes.)
"""
import json
from datetime import date, timedelta

from comun import CACHE, DEPARTAMENTOS, ahora_lima, escribir, get
from geo import puntos_muestreo

DIAS_PASADOS = 60
DIAS_PRONOSTICO = 7
ANIOS_NORMAL = range(2006, 2021)
SUAVIZADO = 15  # días a cada lado para la media móvil de la normal


def _bisiesto_seguro(anio, f: date) -> date:
    return date(anio, f.month, 28 if (f.month, f.day) == (2, 29) else f.day)


def normales(puntos, hoy: date):
    """Devuelve {"lat,lon": {"MM-DD": (lluvia_normal, tmax_normal)}} para la ventana actual."""
    ruta = CACHE / "era5_diario.json"
    cache = json.loads(ruta.read_text()) if ruta.exists() else {}  # {"lat,lon": {"YYYY-MM-DD": [ll, tx]}}
    lista = sorted({p for pts in puntos.values() for p in pts})
    ini = hoy - timedelta(days=DIAS_PASADOS + SUAVIZADO)
    fin = hoy + timedelta(days=DIAS_PRONOSTICO + SUAVIZADO)

    for anio in ANIOS_NORMAL:
        # ventana del mismo tramo del calendario en ese año (puede cruzar de año)
        a_ini = _bisiesto_seguro(anio - (hoy.year - ini.year), ini)
        a_fin = _bisiesto_seguro(anio + (fin.year - hoy.year), fin)
        faltan = [p for p in lista if f"{p[0]},{p[1]}" not in cache
                  or a_ini.isoformat() not in cache[f"{p[0]},{p[1]}"]
                  or a_fin.isoformat() not in cache[f"{p[0]},{p[1]}"]]
        for i in range(0, len(faltan), 50):
            lote = faltan[i:i + 50]
            d = get("https://archive-api.open-meteo.com/v1/archive", params={
                "latitude": ",".join(str(p[0]) for p in lote), "longitude": ",".join(str(p[1]) for p in lote),
                "start_date": a_ini.isoformat(), "end_date": a_fin.isoformat(),
                "daily": "precipitation_sum,temperature_2m_max", "timezone": "America/Lima",
            }, as_json=True, timeout=180)
            d = d if isinstance(d, list) else [d]
            for p, serie in zip(lote, d):
                c = cache.setdefault(f"{p[0]},{p[1]}", {})
                dd = serie["daily"]
                for f, ll, tx in zip(dd["time"], dd["precipitation_sum"], dd["temperature_2m_max"]):
                    c[f] = [ll, tx]
        ruta.parent.mkdir(exist_ok=True)
        ruta.write_text(json.dumps(cache, separators=(",", ":")))

    salida = {}
    for p in lista:
        c = cache[f"{p[0]},{p[1]}"]
        por_dia = {}
        f = ini + timedelta(days=SUAVIZADO)
        while f <= fin - timedelta(days=SUAVIZADO):
            lls, txs = [], []
            for anio in ANIOS_NORMAL:
                centro = _bisiesto_seguro(anio + (f.year - hoy.year), f)
                for k in range(-SUAVIZADO, SUAVIZADO + 1):
                    v = c.get((centro + timedelta(days=k)).isoformat())
                    if v and v[0] is not None:
                        lls.append(v[0])
                    if v and v[1] is not None:
                        txs.append(v[1])
            por_dia[f.isoformat()[5:]] = (sum(lls) / len(lls) if lls else None, sum(txs) / len(txs) if txs else None)
            f += timedelta(days=1)
        salida[f"{p[0]},{p[1]}"] = por_dia
    return salida


def observado(puntos):
    lista = [(did, lat, lon) for did, pts in puntos.items() for lat, lon in pts]
    resultado = []
    for i in range(0, len(lista), 50):
        lote = lista[i:i + 50]
        d = get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": ",".join(str(x[1]) for x in lote),
                "longitude": ",".join(str(x[2]) for x in lote),
                "daily": "precipitation_sum,temperature_2m_max",
                "past_days": DIAS_PASADOS, "forecast_days": DIAS_PRONOSTICO + 1,
                "timezone": "America/Lima",
            },
            as_json=True, timeout=120,
        )
        d = d if isinstance(d, list) else [d]
        for (did, lat, lon), serie in zip(lote, d):
            resultado.append((did, lat, lon, serie["daily"]))
    return resultado


def _promedio(valores):
    v = [x for x in valores if x is not None]
    return sum(v) / len(v) if v else None


def construir():
    puntos = puntos_muestreo(max_extra=1)
    hoy = ahora_lima().date()
    norm = normales(puntos, hoy)
    series = observado(puntos)

    por_depto = {}
    for did, lat, lon, diario in series:
        fechas = [date.fromisoformat(f) for f in diario["time"]]
        n = norm[f"{lat},{lon}"]
        filas = []
        for f, ll, tx in zip(fechas, diario["precipitation_sum"], diario["temperature_2m_max"]):
            lln, txn = n.get(f.isoformat()[5:], (None, None))
            filas.append({"f": f.isoformat(), "ll": ll, "tx": tx, "lln": lln, "txn": txn})
        por_depto.setdefault(did, []).append(filas)

    salida = {}
    for did, puntos_series in por_depto.items():
        nombre, capital, *_ = DEPARTAMENTOS[did]
        fechas = [r["f"] for r in puntos_series[0]]
        diario = []
        for i, f in enumerate(fechas):
            fila = {"f": f}
            for k in ("ll", "tx", "lln", "txn"):
                fila[k] = _promedio([s[i][k] for s in puntos_series])
            # máxima lluvia puntual del día entre los puntos del departamento
            fila["llmax"] = max((s[i]["ll"] or 0) for s in puntos_series)
            diario.append(fila)
        for fila in diario:
            for k in ("ll", "tx", "lln", "txn", "llmax"):
                if fila[k] is not None:
                    fila[k] = round(fila[k], 1)
        salida[did] = {"nombre": nombre, "capital": capital, "puntos": len(puntos_series), "diario": diario}

    escribir("lluvia.json", {"actualizado": ahora_lima().isoformat(timespec="minutes"), "hoy": hoy.isoformat(),
                             "departamentos": salida})
    return salida


if __name__ == "__main__":
    s = construir()
    print(len(s), "departamentos;", s["20"]["diario"][-10:-6])

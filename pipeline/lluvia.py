"""Lluvia y temperatura por departamento y por provincia: observado (60 días), pronóstico (7 días) y normal climática.

- Observado y pronóstico: Open-Meteo (modelos globales, sin clave).
- Normal: reanálisis ERA5 vía Open-Meteo Archive, años 2006-2020, media móvil de ±15 días.
  La normal de cada día del calendario se calcula una sola vez por punto y queda guardada en
  `cache/normal_diaria.json`; los días diarios de ERA5 (`cache/era5_diario.json`) solo se guardan
  mientras falte calcular alguna normal. Así, cada corrida pide muy poco a la API.
  La API gratuita admite unas 10 000 llamadas al día (5 000 por hora) y un pedido de más de 14 días
  cuenta como varias llamadas: por eso cada corrida tiene un tope (`TOPE_NORMAL`). Lo que no alcance
  se termina en las corridas siguientes; mientras tanto ese punto usa la normal del punto más cercano
  que ya la tenga ("normal provisoria").
  (Se probó NASA POWER/MERRA-2, pero subestima mucho la lluvia en los Andes.)
"""
import json
import math
import os
from datetime import date, timedelta

from comun import CACHE, DEPARTAMENTOS, SALIDA, ahora_lima, escribir, get, nombre_provincia
from geo import puntos_muestreo, puntos_provincia

DIAS_PASADOS = 60
DIAS_PRONOSTICO = 7
ANIOS_NORMAL = range(2006, 2021)
SUAVIZADO = 15  # días a cada lado para la media móvil de la normal
ADELANTO = 14  # al pedir ERA5 se piden 14 días más, para no volver a pedir mañana
TOPE_NORMAL = int(os.environ.get("FEN_TOPE_NORMAL", 3500))  # llamadas (ponderadas) por corrida para la normal
_llamadas = {"normal": 0.0, "observado": 0.0, "pendiente": 0.0}


def _bisiesto_seguro(anio, f: date) -> date:
    return date(anio, f.month, 28 if (f.month, f.day) == (2, 29) else f.day)


def _peso(dias: int) -> float:
    """Llamadas que cuenta Open-Meteo por cada punto de un pedido (2 variables)."""
    return max(1.0, dias / 14)


def _clave(p):
    return f"{p[0]},{p[1]}"


def _analogos(f: date, hoy: date):
    """Para la fecha f, las 31 fechas de cada año de la normal que entran en su media móvil."""
    for anio in ANIOS_NORMAL:
        centro = _bisiesto_seguro(anio + (f.year - hoy.year), f)
        yield [centro + timedelta(days=k) for k in range(-SUAVIZADO, SUAVIZADO + 1)]


def normales(lista, hoy: date):
    """Devuelve ({"lat,lon": {"MM-DD": (lluvia_normal, tmax_normal)}}, puntos_provisorios).

    `lista` va en orden de prioridad: si el tope no alcanza, los últimos esperan a la próxima corrida.
    """
    r_crudo, r_normal = CACHE / "era5_diario.json", CACHE / "normal_diaria.json"
    crudo = json.loads(r_crudo.read_text()) if r_crudo.exists() else {}  # {"lat,lon": {"YYYY-MM-DD": [ll, tx]}}
    normal = json.loads(r_normal.read_text()) if r_normal.exists() else {}  # {"lat,lon": {"MM-DD": [ll, tx]}}
    ventana = [hoy + timedelta(days=k) for k in range(-DIAS_PASADOS, DIAS_PRONOSTICO + 1)]

    def faltan(p):
        return [f for f in ventana if f.isoformat()[5:] not in normal.get(_clave(p), {})]

    def calcular(p):
        """Calcula las normales que ya se pueden calcular con los días ERA5 guardados."""
        c, n = crudo.get(_clave(p), {}), normal.setdefault(_clave(p), {})
        for f in faltan(p):
            dias = [d.isoformat() for grupo in _analogos(f, hoy) for d in grupo]
            if not all(d in c for d in dias):
                continue
            lls = [c[d][0] for d in dias if c[d][0] is not None]
            txs = [c[d][1] for d in dias if c[d][1] is not None]
            n[f.isoformat()[5:]] = [round(sum(lls) / len(lls), 2) if lls else None,
                                    round(sum(txs) / len(txs), 2) if txs else None]

    # 1) Lo que ya se puede calcular sin pedir nada
    for p in lista:
        calcular(p)

    # 2) Pedidos a ERA5: por punto y año, el tramo de días que falta (+ ADELANTO); se agrupan los puntos con el mismo tramo
    pedidos = {}  # (inicio, fin) -> [puntos]
    for p in lista:
        f_faltan = faltan(p)
        if not f_faltan:
            continue
        c = crudo.get(_clave(p), {})
        for anio_i, _ in enumerate(ANIOS_NORMAL):
            necesarios = sorted({d for f in f_faltan for d in list(_analogos(f, hoy))[anio_i] if d.isoformat() not in c})
            if necesarios:
                tramo = (necesarios[0], necesarios[-1] + timedelta(days=ADELANTO))
                pedidos.setdefault(tramo, []).append(p)
    orden = {_clave(p): i for i, p in enumerate(lista)}
    cola = [(tramo, pts[i:i + 50]) for tramo, pts in pedidos.items() for i in range(0, len(pts), 50)]
    cola.sort(key=lambda t: min(orden[_clave(p)] for p in t[1]))
    _llamadas["pendiente"] = sum(len(l) * _peso((f - i).days + 1) for (i, f), l in cola)
    for (ini, fin), lote in cola:
        costo = len(lote) * _peso((fin - ini).days + 1)
        if _llamadas["normal"] + costo > TOPE_NORMAL:
            continue
        try:
            d = get("https://archive-api.open-meteo.com/v1/archive", params={
                "latitude": ",".join(str(p[0]) for p in lote), "longitude": ",".join(str(p[1]) for p in lote),
                "start_date": ini.isoformat(), "end_date": fin.isoformat(),
                "daily": "precipitation_sum,temperature_2m_max", "timezone": "America/Lima",
            }, as_json=True, timeout=180)
        except RuntimeError as e:  # cupo agotado o API caída: se sigue con lo que hay
            print("  ERA5: se corta por hoy:", str(e)[:160])
            break
        _llamadas["normal"] += costo
        d = d if isinstance(d, list) else [d]
        for p, serie in zip(lote, d):
            c = crudo.setdefault(_clave(p), {})
            dd = serie["daily"]
            for f, ll, tx in zip(dd["time"], dd["precipitation_sum"], dd["temperature_2m_max"]):
                c[f] = [ll, tx]

    for p in lista:
        calcular(p)

    # 3) Se borran los días ERA5 que ya no hacen falta (solo de los puntos con la ventana completa)
    limite = hoy - timedelta(days=SUAVIZADO + 5)
    for p in lista:
        if faltan(p) or _clave(p) not in crudo:
            continue
        c = crudo[_clave(p)]
        for d in list(c):
            f = date.fromisoformat(d)
            analogo = min((_bisiesto_seguro(hoy.year + k, f) for k in (-1, 0, 1)), key=lambda x: abs((x - hoy).days))
            if analogo < limite:
                del c[d]
    r_crudo.parent.mkdir(exist_ok=True)
    r_crudo.write_text(json.dumps(crudo, separators=(",", ":")))
    r_normal.write_text(json.dumps(normal, separators=(",", ":"), sort_keys=True))

    # 4) Salida: cada punto con su normal; si le falta algún día, la del punto más cercano que la tenga
    salida, provisorios = {}, set()
    for p in lista:
        propia = normal.get(_clave(p), {})
        por_dia = {}
        for f in ventana:
            md = f.isoformat()[5:]
            if md in propia:
                por_dia[md] = tuple(propia[md])
                continue
            provisorios.add(_clave(p))
            otros = [q for q in lista if md in normal.get(_clave(q), {})]
            if otros:
                q = min(otros, key=lambda q: math.dist(p, q))
                por_dia[md] = tuple(normal[_clave(q)][md])
            else:
                por_dia[md] = (None, None)
        salida[_clave(p)] = por_dia
    return salida, provisorios


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
        _llamadas["observado"] += len(lote) * _peso(DIAS_PASADOS + DIAS_PRONOSTICO + 1)
        d = d if isinstance(d, list) else [d]
        for (did, lat, lon), serie in zip(lote, d):
            resultado.append((did, lat, lon, serie["daily"]))
    return resultado


def _promedio(valores):
    v = [x for x in valores if x is not None]
    return sum(v) / len(v) if v else None


def _agrupar(series, norm):
    """Promedia los puntos de cada zona (departamento o provincia) día por día."""
    por_zona = {}
    for zid, lat, lon, diario in series:
        n = norm[_clave((lat, lon))]
        filas = []
        for f, ll, tx in zip(diario["time"], diario["precipitation_sum"], diario["temperature_2m_max"]):
            lln, txn = n.get(f[5:], (None, None))
            filas.append({"f": f, "ll": ll, "tx": tx, "lln": lln, "txn": txn})
        por_zona.setdefault(zid, []).append(filas)

    salida = {}
    for zid, puntos_series in por_zona.items():
        fechas = [r["f"] for r in puntos_series[0]]
        diario = []
        for i, f in enumerate(fechas):
            fila = {"f": f}
            for k in ("ll", "tx", "lln", "txn"):
                fila[k] = _promedio([s[i][k] for s in puntos_series])
            # máxima lluvia puntual del día entre los puntos de la zona
            fila["llmax"] = max((s[i]["ll"] or 0) for s in puntos_series)
            for k in ("ll", "tx", "lln", "txn", "llmax"):
                if fila[k] is not None:
                    fila[k] = round(fila[k], 1)
            diario.append(fila)
        salida[zid] = {"puntos": len(puntos_series), "diario": diario}
    return salida


def construir():
    deps = puntos_muestreo(max_extra=1)
    provs = puntos_provincia()
    hoy = ahora_lima().date()
    # prioridad para la normal: departamentos y luego provincias, primero las del norte (donde golpea el Niño costero)
    orden_prov = sorted(provs, key=lambda pid: (DEPARTAMENTOS[pid[:2]][4] != "Norte", pid))
    lista = list(dict.fromkeys([p for pts in deps.values() for p in pts] + [p for pid in orden_prov for p in provs[pid]]))
    norm, provisorios = normales(lista, hoy)
    series = observado({**deps, **provs})  # los ids de provincia (4 dígitos) no chocan con los de departamento

    agrupado = _agrupar(series, norm)
    salida = {}
    for did in deps:
        nombre, capital, *_ = DEPARTAMENTOS[did]
        salida[did] = {"nombre": nombre, "capital": capital, **agrupado[did]}

    topo = json.loads((SALIDA / "peru.topo.json").read_text(encoding="utf-8"))
    nombres = {g["id"]: nombre_provincia(g["properties"]["name"]) for g in topo["objects"]["provinces"]["geometries"]}
    provincias = {}
    for pid, pts in provs.items():
        provincias[pid] = {"nombre": nombres[pid], "dep": pid[:2], "lat": pts[0][0], "lon": pts[0][1],
                           "normal": "provisoria" if any(_clave(p) in provisorios for p in pts) else "propia",
                           **agrupado[pid]}

    act = ahora_lima().isoformat(timespec="minutes")
    escribir("lluvia.json", {"actualizado": act, "hoy": hoy.isoformat(), "departamentos": salida})
    escribir("lluvia_prov.json", {"actualizado": act, "hoy": hoy.isoformat(), "provincias": provincias})
    prov_listas = sum(v["normal"] == "propia" for v in provincias.values())
    print(f"  llamadas Open-Meteo: normal {_llamadas['normal']:.0f} de {_llamadas['pendiente']:.0f} pendientes, observado {_llamadas['observado']:.0f}; "
          f"provincias con normal propia: {prov_listas}/{len(provincias)}")
    return salida, provincias


if __name__ == "__main__":
    s, p = construir()
    print(len(s), "departamentos,", len(p), "provincias;", s["20"]["diario"][-10:-8])

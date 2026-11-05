"""Lee el TopoJSON del Perú (pe-atlas, INEI: departamentos y provincias) y elige puntos de muestreo dentro de cada uno."""
import json
import math

from pathlib import Path

from comun import DEPARTAMENTOS, SALIDA


TOPO = SALIDA / "peru.topo.json"  # el que dibuja el mapa: departamentos y provincias
# Los puntos de departamento se eligen sobre el contorno de siempre, para no perder la normal ERA5 ya guardada
TOPO_DEPS = Path(__file__).resolve().parent / "departamentos.topo.json"


def _decodificar(topo, objeto="departments"):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcos = []
    for arco in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arco:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcos.append(pts)

    def anillo(indices):
        pts = []
        for i in indices:
            a = arcos[i] if i >= 0 else arcos[~i][::-1]
            pts.extend(a if not pts else a[1:])
        return pts

    salida = {}
    for g in topo["objects"][objeto]["geometries"]:
        polis = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        salida[g["id"]] = [[anillo(r) for r in p] for p in polis]
    return salida


def _dentro(lon, lat, poligonos):
    for anillos in poligonos:
        adentro = False
        for k, anillo in enumerate(anillos):
            c = False
            for i in range(len(anillo)):
                x1, y1 = anillo[i - 1]
                x2, y2 = anillo[i]
                if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                    c = not c
            if k == 0:
                adentro = c
            elif c:
                adentro = False
        if adentro:
            return True
    return False


def _topo(ruta=TOPO):
    return json.loads(ruta.read_text(encoding="utf-8"))


def _candidatos(polis, paso):
    todos = [p for anillos in polis for p in anillos[0]]
    xs, ys = [p[0] for p in todos], [p[1] for p in todos]
    candidatos = []
    y = min(ys) + paso / 2
    while y < max(ys):
        x = min(xs) + paso / 2
        while x < max(xs):
            if _dentro(x, y, polis):
                candidatos.append((round(y, 3), round(x, 3)))
            x += paso
        y += paso
    return candidatos


def puntos_provincia(paso=0.1, grande=150):
    """Un punto central por provincia (el de la grilla más cerca del centro de la provincia) y, si es
    grande (más de `grande` celdas de 0,1°, unos 18 000 km²), otro en la parte más alejada."""
    geoms = _decodificar(_topo(), "provinces")
    puntos = {}
    for pid, polis in geoms.items():
        cand, p = [], paso
        while not cand and p > 0.005:  # provincias chicas (Callao): se afina la grilla
            cand = _candidatos(polis, p)
            p /= 2
        if not cand:  # último recurso: el promedio del contorno
            todos = [q for anillos in polis for q in anillos[0]]
            cand = [(round(sum(q[1] for q in todos) / len(todos), 3), round(sum(q[0] for q in todos) / len(todos), 3))]
        cy, cx = sum(c[0] for c in cand) / len(cand), sum(c[1] for c in cand) / len(cand)
        centro = min(cand, key=lambda c: math.dist(c, (cy, cx)))
        elegidos = [centro]
        if len(cand) > grande:
            lejos = max(cand, key=lambda c: math.dist(c, centro))
            medio = min(cand, key=lambda c: math.dist(c, ((centro[0] + lejos[0]) / 2, (centro[1] + lejos[1]) / 2)))
            if math.dist(medio, centro) >= 0.5:
                elegidos.append(medio)
        puntos[pid] = elegidos
    return puntos


def puntos_muestreo(max_extra=3, paso=0.2):
    """Capital + hasta `max_extra` puntos repartidos (los más alejados entre sí) dentro de cada departamento."""
    geoms = _decodificar(_topo(TOPO_DEPS))
    puntos = {}
    for did, polis in geoms.items():
        _, _, clat, clon, _ = DEPARTAMENTOS[did]
        candidatos = _candidatos(polis, paso)
        elegidos = [(clat, clon)]
        while candidatos and len(elegidos) < 1 + max_extra:
            mejor = max(candidatos, key=lambda c: min(math.dist(c, e) for e in elegidos))
            if min(math.dist(mejor, e) for e in elegidos) < 0.35:
                break
            elegidos.append(mejor)
            candidatos.remove(mejor)
        puntos[did] = elegidos
    return puntos


if __name__ == "__main__":
    pts = puntos_muestreo(max_extra=1)
    print(sum(len(v) for v in pts.values()), "puntos de departamento")
    prov = puntos_provincia()
    print(sum(len(v) for v in prov.values()), "puntos de provincia en", len(prov), "provincias")

"""Lee el TopoJSON de departamentos (pe-atlas, INEI) y elige puntos de muestreo dentro de cada uno."""
import json
import math

from comun import DEPARTAMENTOS, SALIDA


def _decodificar(topo):
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
    for g in topo["objects"]["departments"]["geometries"]:
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


def puntos_muestreo(max_extra=3, paso=0.2):
    """Capital + hasta `max_extra` puntos repartidos (los más alejados entre sí) dentro de cada departamento."""
    topo = json.loads((SALIDA / "departamentos.topo.json").read_text(encoding="utf-8"))
    geoms = _decodificar(topo)
    puntos = {}
    for did, polis in geoms.items():
        _, _, clat, clon, _ = DEPARTAMENTOS[did]
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
    pts = puntos_muestreo()
    print(sum(len(v) for v in pts.values()), "puntos")
    for k, v in pts.items():
        print(k, DEPARTAMENTOS[k][0], v)

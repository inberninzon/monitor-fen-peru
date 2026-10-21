"""Índice de afectación por departamento (0-100) y sus componentes.

Combina lo que ya está pasando (lluvia vs normal, intensidad, déficit, calor) con lo que viene
(pronóstico a 7 días y avisos SENAMHI vigentes). Cada componente va de 0 a 1 y se guarda para
que el dashboard pueda explicar de dónde sale el número.
"""
import math
import re
from datetime import date

from comun import DEPARTAMENTOS, ahora_lima, escribir, leer

PESOS = {"lluvia": 0.30, "intensidad": 0.20, "pronostico": 0.20, "avisos": 0.20, "calor": 0.10}
LLUVIA_AVISO = re.compile(r"precipitaci|lluvia|tormenta|huaico|desborde", re.I)


def _clamp(x):
    return max(0.0, min(1.0, x))


def _suma(filas, clave):
    return sum(f[clave] or 0 for f in filas)


def construir():
    lluvia = leer("lluvia.json")
    avisos = leer("avisos.json", {"avisos": []})["avisos"]
    hoy = date.fromisoformat(lluvia["hoy"])

    regiones = {}
    for did, dep in lluvia["departamentos"].items():
        diario = dep["diario"]
        pasado = [f for f in diario if date.fromisoformat(f["f"]) < hoy]
        futuro = [f for f in diario if date.fromisoformat(f["f"]) >= hoy][:7]
        u7, u30, u60, u3 = pasado[-7:], pasado[-30:], pasado[-60:], pasado[-3:]

        obs7, norm7 = _suma(u7, "ll"), _suma(u7, "lln")
        obs30, norm30 = _suma(u30, "ll"), _suma(u30, "lln")
        obs60, norm60 = _suma(u60, "ll"), _suma(u60, "lln")
        fc7, normfc7 = _suma(futuro, "ll"), _suma(futuro, "lln")
        max24 = max((f["llmax"] or 0) for f in u3) if u3 else 0
        fcmax = max((f["llmax"] or 0) for f in futuro) if futuro else 0
        tx_anom = sum((f["tx"] or 0) - (f["txn"] or 0) for f in u7) / max(len(u7), 1)

        exceso = _clamp(math.log2((obs7 + 5) / (norm7 + 5)) / 3)
        deficit = _clamp((1 - obs60 / norm60) / 0.7) if norm60 >= 40 else 0.0
        comp = {
            "lluvia": max(exceso, deficit),
            "intensidad": _clamp((max24 - 20) / 60),
            "pronostico": 0.5 * _clamp(math.log2((fc7 + 5) / (normfc7 + 5)) / 3) + 0.5 * _clamp((fcmax - 20) / 60),
            "avisos": 0.0,
            "calor": _clamp((tx_anom - 1) / 4),
        }
        mis_avisos = [a for a in avisos if did in a["departamentos"] and a["fin"] >= hoy.isoformat()]
        if mis_avisos:
            # los avisos ligados a lluvia pesan completo; viento, calor, nevada o heladas, la mitad
            comp["avisos"] = max(a["nivel_n"] / 3 * (1.0 if LLUVIA_AVISO.search(a["titulo"]) else 0.5)
                                 for a in mis_avisos)

        indice = round(100 * sum(PESOS[k] * v for k, v in comp.items()))
        if deficit > exceso and deficit > 0.2:
            tipo = "Déficit de lluvia"
        elif comp["lluvia"] > 0.2 or comp["intensidad"] > 0.2 or comp["pronostico"] > 0.3:
            tipo = "Exceso de lluvia"
        elif comp["calor"] > 0.3:
            tipo = "Calor"
        elif comp["avisos"] > 0:
            tipo = "Bajo aviso"
        else:
            tipo = "Sin señal fuerte"

        nombre, capital, lat, lon, zona = DEPARTAMENTOS[did]
        regiones[did] = {
            "nombre": nombre, "capital": capital, "zona": zona, "lat": lat, "lon": lon,
            "indice": indice, "tipo": tipo, "componentes": {k: round(v, 2) for k, v in comp.items()},
            "lluvia": {
                "obs7": round(obs7, 1), "norm7": round(norm7, 1),
                "obs30": round(obs30, 1), "norm30": round(norm30, 1),
                "pct30": round(100 * obs30 / norm30) if norm30 >= 5 else None,
                "obs60": round(obs60, 1), "norm60": round(norm60, 1),
                "pct60": round(100 * obs60 / norm60) if norm60 >= 5 else None,
                "max24": round(max24, 1), "fc7": round(fc7, 1), "normfc7": round(normfc7, 1), "fcmax": round(fcmax, 1),
            },
            "tmax_anom7": round(tx_anom, 1),
            "avisos": [a["numero"] for a in mis_avisos],
        }

    ranking = sorted(regiones, key=lambda d: -regiones[d]["indice"])
    escribir("regiones.json", {"actualizado": ahora_lima().isoformat(timespec="minutes"), "hoy": hoy.isoformat(),
                               "pesos": PESOS, "ranking": ranking, "regiones": regiones})
    return regiones, ranking


if __name__ == "__main__":
    reg, rk = construir()
    for d in rk:
        r = reg[d]
        print(f'{r["nombre"]:15} {r["indice"]:3} {r["tipo"]:18} {r["componentes"]} pct30={r["lluvia"]["pct30"]}')

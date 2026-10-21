"""PBI mensual y sectores más expuestos al FEN (BCRP, variación % interanual)."""
from comun import ahora_lima, escribir, get

API = "https://estadisticas.bcrp.gob.pe/estadisticas/series/api/{}/json/{}/{}"
SERIES = {
    "PN01728AM": "PBI",
    "PN01713AM": "Agropecuario",
    "PN01716AM": "Pesca",
    "PN01717AM": "Minería e hidrocarburos",
    "PN01720AM": "Manufactura",
}


def construir():
    hoy = ahora_lima().date()
    codigos = sorted(SERIES)  # el BCRP devuelve las series ordenadas por código
    d = get(API.format("-".join(codigos), f"{hoy.year - 3}-1", f"{hoy.year}-12"), as_json=True)
    nombres = [SERIES[c] for c in codigos]
    series = {n: [] for n in nombres}
    for periodo in d["periods"]:
        for n, v in zip(nombres, periodo["values"]):
            try:
                series[n].append([periodo["name"], round(float(v), 2)])
            except ValueError:
                pass  # "n.d." en meses sin dato
    datos = {"actualizado": ahora_lima().isoformat(timespec="minutes"),
             "fuente": "BCRP – BCRPData", "series": series,
             "ultimo": {n: s[-1] if s else None for n, s in series.items()}}
    escribir("pbi.json", datos)
    return datos


if __name__ == "__main__":
    print(construir()["ultimo"])

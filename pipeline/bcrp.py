"""PBI mensual, sectores más expuestos al FEN e inflación de Lima (BCRP, variación % interanual)."""
from comun import ahora_lima, escribir, get

API = "https://estadisticas.bcrp.gob.pe/estadisticas/series/api/{}/json/{}/{}"
SERIES = {
    "PN01728AM": "PBI",
    "PN01713AM": "Agropecuario",
    "PN01716AM": "Pesca",
    "PN01717AM": "Minería e hidrocarburos",
    "PN01720AM": "Manufactura",
}
# Inflación de Lima Metropolitana (var. % 12 meses). Se piden aparte, una por una: si el BCRP
# cambia o retira un código, solo se pierde esa serie y no el PBI.
INFLACION = {
    "PN01273PM": "Inflación",
    "PN09822PM": "Inflación alimentos",
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
    for codigo, nombre in INFLACION.items():
        try:
            d = get(API.format(codigo, f"{hoy.year - 3}-1", f"{hoy.year}-12"), as_json=True, intentos=2)
            series[nombre] = [[p["name"], round(float(p["values"][0]), 2)]
                              for p in d["periods"] if p["values"][0] not in ("n.d.", "")]
        except Exception as e:  # noqa: BLE001 - la inflación es opcional
            print(f"  BCRP {codigo} ({nombre}) sin dato: {e}")
    datos = {"actualizado": ahora_lima().isoformat(timespec="minutes"),
             "fuente": "BCRP – BCRPData", "series": series,
             "ultimo": {n: s[-1] if s else None for n, s in series.items()}}
    escribir("pbi.json", datos)
    return datos


if __name__ == "__main__":
    print(construir()["ultimo"])

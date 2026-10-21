"""Corre todo el pipeline. Si una fuente falla, se conserva su último JSON y se marca como atrasada en estado.json."""
import traceback

import avisos
import bcrp
import capas
import enfen
import indice
import lluvia
import mar
from comun import ahora_lima, escribir, leer

PASOS = [
    ("mar", "Mar (NOAA CPC + Open-Meteo Marine)", mar.construir),
    ("lluvia", "Lluvia y temperatura (Open-Meteo + ERA5)", lluvia.construir),
    ("avisos", "Avisos SENAMHI", avisos.construir),
    ("enfen", "Comunicado ENFEN", enfen.construir),
    ("pbi", "PBI (BCRP)", bcrp.construir),
    ("capas", "Capas satelitales (NASA GIBS)", capas.construir),
    ("indice", "Índice de afectación", indice.construir),
]


def main():
    estado = leer("estado.json", {"fuentes": {}}) or {"fuentes": {}}
    for clave, nombre, fn in PASOS:
        previo = estado["fuentes"].get(clave, {})
        try:
            fn()
            estado["fuentes"][clave] = {"nombre": nombre, "ok": True, "ultimo_ok": ahora_lima().isoformat(timespec="minutes")}
            print(f"OK   {nombre}")
        except Exception as e:  # noqa: BLE001 - una fuente caída no debe tumbar las demás
            estado["fuentes"][clave] = {"nombre": nombre, "ok": False, "ultimo_ok": previo.get("ultimo_ok"),
                                        "error": str(e)[:300]}
            print(f"FALLA {nombre}: {e}")
            traceback.print_exc()
    estado["corrida"] = ahora_lima().isoformat(timespec="minutes")
    escribir("estado.json", estado)


if __name__ == "__main__":
    main()

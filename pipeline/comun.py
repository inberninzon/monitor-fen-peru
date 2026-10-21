"""Utilidades compartidas del pipeline: rutas, descargas con reintentos y escritura de JSON."""
import json
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "app" / "public" / "data"
CACHE = Path(__file__).resolve().parent / "cache"
LIMA = timezone(timedelta(hours=-5))
UA = {"User-Agent": "FEN-Peru-Dashboard/0.1 (monitoreo El Nino; uso interno)"}


def ahora_lima() -> datetime:
    return datetime.now(LIMA)


def get(url, *, params=None, intentos=4, timeout=60, as_json=False):
    ultimo = None
    for i in range(intentos):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=timeout)
            if r.status_code == 429:  # límite por minuto (Open-Meteo): se espera a que se libere
                time.sleep(65)
                continue
            r.raise_for_status()
            return r.json() if as_json else r
        except Exception as e:  # noqa: BLE001 - se reintenta cualquier fallo de red
            ultimo = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"Fallo al descargar {url}: {ultimo}")


def escribir(nombre: str, datos) -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    (SALIDA / nombre).write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def leer(nombre: str, defecto=None):
    p = SALIDA / nombre
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else defecto


# Departamentos: id ubigeo -> (nombre, capital, lat, lon, zona)
DEPARTAMENTOS = {
    "01": ("Amazonas", "Chachapoyas", -6.23, -77.87, "Norte"),
    "02": ("Áncash", "Huaraz", -9.53, -77.53, "Norte"),
    "03": ("Apurímac", "Abancay", -13.64, -72.88, "Sur"),
    "04": ("Arequipa", "Arequipa", -16.40, -71.54, "Sur"),
    "05": ("Ayacucho", "Ayacucho", -13.16, -74.22, "Centro"),
    "06": ("Cajamarca", "Cajamarca", -7.16, -78.51, "Norte"),
    "07": ("Callao", "Callao", -12.06, -77.13, "Lima"),
    "08": ("Cusco", "Cusco", -13.53, -71.97, "Sur"),
    "09": ("Huancavelica", "Huancavelica", -12.79, -74.97, "Centro"),
    "10": ("Huánuco", "Huánuco", -9.93, -76.24, "Centro"),
    "11": ("Ica", "Ica", -14.07, -75.73, "Centro"),
    "12": ("Junín", "Huancayo", -12.07, -75.21, "Centro"),
    "13": ("La Libertad", "Trujillo", -8.11, -79.03, "Norte"),
    "14": ("Lambayeque", "Chiclayo", -6.77, -79.84, "Norte"),
    "15": ("Lima", "Lima", -12.05, -77.04, "Lima"),
    "16": ("Loreto", "Iquitos", -3.75, -73.25, "Oriente"),
    "17": ("Madre de Dios", "Puerto Maldonado", -12.59, -69.19, "Oriente"),
    "18": ("Moquegua", "Moquegua", -17.19, -70.94, "Sur"),
    "19": ("Pasco", "Cerro de Pasco", -10.68, -76.26, "Centro"),
    "20": ("Piura", "Piura", -5.19, -80.63, "Norte"),
    "21": ("Puno", "Puno", -15.84, -70.02, "Sur"),
    "22": ("San Martín", "Moyobamba", -6.03, -76.97, "Oriente"),
    "23": ("Tacna", "Tacna", -18.01, -70.25, "Sur"),
    "24": ("Tumbes", "Tumbes", -3.57, -80.45, "Norte"),
    "25": ("Ucayali", "Pucallpa", -8.38, -74.55, "Oriente"),
}

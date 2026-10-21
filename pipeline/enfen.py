"""Último comunicado oficial del ENFEN: número, fecha, estado de alerta, titular y resumen (leído del PDF)."""
import re

import fitz  # PyMuPDF

from comun import CACHE, ahora_lima, escribir, get, leer

LISTADO = "https://enfen.imarpe.gob.pe/comunicados/"


def construir():
    html = get(LISTADO, timeout=90).text
    enlaces = re.findall(r'href="(https://enfen\.imarpe\.gob\.pe/download/comunicado-oficial-enfen-n-(\d+)-(\d{4})/[^"]*)"', html)
    if not enlaces:
        raise RuntimeError("No se encontraron comunicados en el listado del ENFEN")
    url, num, anio = max(enlaces, key=lambda e: (int(e[2]), int(e[1])))
    url = url.replace("&amp;", "&")
    pdf = get(url, timeout=120).content
    (CACHE / "enfen_ultimo.pdf").write_bytes(pdf)
    texto = "\n".join(p.get_text() for p in fitz.open(stream=pdf, filetype="pdf"))
    plano = re.sub(r"\s+", " ", texto)

    fecha = re.search(r"N°\s*\d+\s*-\s*\d{4}\s+(\d{1,2}\s+\w+\s+\d{4})", plano)
    estado = re.search(r"(Alerta|Vigilancia|No activo)[^.]{0,40}?(El Niño|La Niña)\s+Coster[oa]", plano)
    titular = re.search(r"Coster[oa]\s*\d?\s+([A-ZÁÉÍÓÚÑ0-9 ,]{20,})\s+[A-Z][a-z]", plano)
    resumen = re.search(r"(La Temperatura Superficial del Mar.*?)\s*(?:Figura 1\.|$)", plano)

    previo = leer("enfen.json", {}) or {}
    datos = {
        "actualizado": ahora_lima().isoformat(timespec="minutes"),
        "numero": f"{int(num)}-{anio}",
        "fecha": fecha.group(1) if fecha else previo.get("fecha"),
        "estado": re.sub(r"\s+", " ", estado.group(0)) if estado else previo.get("estado", "Sin dato"),
        "titular": re.sub(r"\bniñ([oa])\b", r"Niñ\1", titular.group(1).strip().capitalize()) if titular else previo.get("titular"),
        # se quitan las referencias a figuras y los números de nota al pie pegados a las palabras
        "resumen": re.sub(r"([a-záéíóú])\d\b", r"\1",
                          re.sub(r"\s*\((?:Figura|Fig\.)[^)]*\)", "", resumen.group(1))).strip()[:900]
        if resumen else previo.get("resumen"),
        "url": url.split("?")[0],
    }
    escribir("enfen.json", datos)
    return datos


if __name__ == "__main__":
    print(construir())

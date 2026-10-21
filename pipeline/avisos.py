"""Avisos meteorológicos SENAMHI vigentes y emitidos, con los departamentos que mencionan."""
import html as html_mod
import re
import unicodedata

from comun import DEPARTAMENTOS, ahora_lima, escribir, get

BASE = "https://www.senamhi.gob.pe/"
NIVELES = {"AMARILLO": 1, "NARANJA": 2, "ROJO": 3}

# Si el aviso no nombra departamentos, se deducen de la zona que menciona el título
ZONAS = {
    "costa norte": ["24", "20", "14", "13"],
    "costa centro": ["02", "15", "07", "11"],
    "costa sur": ["04", "18", "23"],
    "sierra norte": ["06", "01", "13", "20", "14", "02"],
    "sierra centro": ["02", "10", "19", "12", "15", "09"],
    "sierra sur": ["05", "03", "08", "21", "04", "18", "23"],
    "selva norte": ["16", "01", "22"],
    "selva centro": ["10", "19", "12", "25"],
    "selva sur": ["08", "17", "21"],
}


def _norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s)


def _texto(html):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S)
    return re.sub(r"\s+", " ", html_mod.unescape(re.sub(r"<[^>]+>", " ", t)))


def _departamentos(titulo, descripcion):
    texto = _norm(descripcion)
    ids = [did for did, (nombre, *_) in DEPARTAMENTOS.items() if re.search(rf"\b{_norm(nombre)}\b", texto)]
    if ids:
        return sorted(set(ids))
    t = _norm(titulo + " " + descripcion[:400])
    encontrados = set()
    for zona, deps in ZONAS.items():
        region, parte = zona.split()
        if re.search(rf"{region}\b[^.]{{0,40}}\b{parte}", t):
            encontrados.update(deps)
    for region in ("costa", "sierra", "selva"):
        if re.search(rf"\b{region}\b", t) and not any(z.startswith(region) and z in t for z in ZONAS):
            if re.search(rf"\b{region}\b del pais|\ben la {region}\b(?! (norte|centro|sur))", t):
                for zona, deps in ZONAS.items():
                    if zona.startswith(region):
                        encontrados.update(deps)
    return sorted(encontrados)


def construir():
    html = get(BASE + "?p=aviso-meteorologico", timeout=90).text
    filas = re.findall(
        r'<tr>\s*<td\s+class="(vigente|emitido)"><a href="\./(\?p=aviso-meteorologico-vigente[^"]+)">([^<]+)</td>\s*'
        r'<td[^>]*><a[^>]*>(\d+)[^<]*</td>\s*<td[^>]*>([\d-]+)</td>\s*<td[^>]*>([\d-]+)</td>\s*'
        r'<td[^>]*>([\d-]+)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*><span[^>]*>(\w+)</span>',
        html,
    )
    avisos = []
    for estado, enlace, titulo, numero, emision, inicio, fin, duracion, nivel in filas:
        url = BASE + html_mod.unescape(enlace)
        try:
            detalle = _texto(get(url, timeout=60).text)
            m = re.search(rf"Aviso N°\s*{numero}.*?(El SENAMHI informa.*?)(?:Aviso N°|Ver mapa|Descargar|$)", detalle)
            descripcion = m.group(1)[:700] if m else ""
        except RuntimeError:
            descripcion = ""
        avisos.append({
            "numero": int(numero), "estado": estado, "titulo": titulo.strip().capitalize(),
            "emision": emision, "inicio": inicio, "fin": fin, "duracion": duracion.strip(),
            "nivel": nivel.upper(), "nivel_n": NIVELES.get(nivel.upper(), 0),
            "descripcion": descripcion.strip(), "departamentos": _departamentos(titulo, descripcion), "url": url,
        })
    avisos.sort(key=lambda a: (-a["nivel_n"], -a["numero"]))
    escribir("avisos.json", {"actualizado": ahora_lima().isoformat(timespec="minutes"), "avisos": avisos})
    return avisos


if __name__ == "__main__":
    for a in construir():
        print(a["numero"], a["estado"], a["nivel"], a["titulo"], a["inicio"], a["fin"], a["departamentos"])

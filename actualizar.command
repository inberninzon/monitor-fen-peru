#!/bin/zsh
# Actualiza los datos del Monitor FEN y los sube a GitHub (el sitio se republica solo).
# Doble clic en Finder o: ./actualizar.command
cd "$(dirname "$0")" || exit 1

echo "→ Bajando cambios del repo…"
git pull -q --rebase origin main || { echo "No se pudo actualizar desde GitHub"; exit 1; }

echo "→ Corriendo el pipeline de datos…"
(cd pipeline && python3 run_all.py) | grep -E "^(OK|FALLA)"

git add app/public/data pipeline/cache
if git diff --cached --quiet; then
  echo "Sin cambios en los datos."
else
  git commit -q -m "Datos FEN $(date '+%Y-%m-%d %H:%M')"
  git push -q origin main && echo "✓ Datos subidos. El sitio se actualiza en 1-2 minutos: https://inberninzon.github.io/monitor-fen-peru/"
fi

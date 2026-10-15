"""Genera el logo provisional: una bola pixelada con la paleta de la web
(azul KOI arriba, blanco abajo, franja marina y botón dorado).

Escribe public/logo.svg y app/icon.svg (el favicon). Uso: python3 scripts/gen-logo.py
"""

ART = [
    "....00000000....",
    "..001111111100..",
    ".01122111111110.",
    ".01221111111110.",
    "0112111111111110",
    "0111111111111110",
    "0111110000111110",
    "0000000330000000",
    "0000000330000000",
    "0444440000444440",
    "0444444444444440",
    "0444444444444550",
    ".04444444444450.",
    ".04444444444550.",
    "..005544445500..",
    "....00000000....",
]
PALETTE = {
    "0": "#081429",  # marino noche (contorno)
    "1": "#4b9bec",  # azul KOI
    "2": "#8cc2f7",  # brillo
    "3": "#f8d860",  # dorado
    "4": "#f2f7ff",  # blanco hielo
    "5": "#c9dcf2",  # sombra
}

N = len(ART)
rects = "".join(
    f'<rect x="{x}" y="{y}" width="1" height="1" fill="{PALETTE[ch]}"/>'
    for y, row in enumerate(ART)
    for x, ch in enumerate(row)
    if ch in PALETTE
)
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" shape-rendering="crispEdges">{rects}</svg>'
for path in ("public/logo.svg", "app/icon.svg"):
    open(path, "w").write(svg)

"""Genera el logo pixelado: una carpa koi vista desde arriba, blanca con manchas
azul KOI y una mancha dorada en la cabeza (como las koi tancho, aquí por la copa).

Escribe public/logo.svg y app/icon.svg (el favicon). Uso: python3 scripts/gen-logo.py
"""

N = 24  # se pinta a 24 px (o 48) para que cada píxel caiga entero
OUT = "#081429"
WHITE = "#f2f7ff"
SHADE = "#c9dcf2"
KOI = "#4b9bec"
KOI_DARK = "#2b66a8"
GOLD = "#f8d860"

grid = [[None] * N for _ in range(N)]


def put(x, y, c):
    x, y = x + 2, y + 2  # centrado en la rejilla, con margen para el contorno
    if 0 <= x < N and 0 <= y < N:
        grid[y][x] = c


# Cuerpo: (centro, medio ancho interior) por fila; el centro se desplaza para que nade en curva
BODY = {0: (10, 1), 1: (10, 2), 2: (10, 3), 3: (10, 3), 4: (10, 4), 5: (10, 4), 6: (10, 4), 7: (10, 4),
        8: (10, 3), 9: (10, 3), 10: (11, 3), 11: (11, 2), 12: (11, 2), 13: (12, 1), 14: (12, 1)}
for y, (c, h) in BODY.items():
    for x in range(c - h, c + h):
        put(x, y, WHITE)
    if y > 3:
        put(c + h - 1, y, SHADE)  # volumen en el costado derecho

# Cola larga en abanico, siguiendo la curva
for (x, y, c) in [(11, 15, KOI), (12, 15, KOI_DARK), (10, 16, KOI), (11, 16, KOI), (12, 16, KOI_DARK), (13, 16, KOI_DARK),
                  (9, 17, KOI), (10, 17, KOI), (13, 17, KOI_DARK), (14, 17, KOI_DARK),
                  (9, 18, KOI), (14, 18, KOI_DARK), (15, 18, KOI_DARK), (15, 19, KOI_DARK), (8, 19, KOI)]:
    put(x, y, c)

# Aletas pectorales echadas hacia atrás y pélvicas
for (x, y, c) in [(5, 6, KOI), (5, 7, KOI), (4, 7, KOI), (4, 8, KOI), (3, 9, KOI_DARK), (4, 9, KOI),
                  (14, 6, KOI), (14, 7, KOI), (15, 7, KOI), (15, 8, KOI), (16, 9, KOI_DARK), (15, 9, KOI),
                  (5, 8, KOI), (6, 8, KOI), (13, 8, KOI), (14, 8, KOI), (5, 9, KOI), (14, 9, KOI),
                  (8, 12, KOI), (13, 12, KOI_DARK)]:
    put(x, y, c)

# Manchas azules del lomo y mancha dorada en la cabeza (koi tancho; aquí, la copa)
for (x, y, c) in [(7, 5, KOI), (8, 5, KOI), (7, 6, KOI), (8, 6, KOI), (9, 6, KOI), (8, 7, KOI),
                  (11, 9, KOI), (12, 9, KOI), (11, 10, KOI), (12, 10, KOI),
                  (11, 12, KOI), (12, 13, KOI),
                  (9, 1, GOLD), (10, 1, GOLD), (9, 2, GOLD), (10, 2, GOLD)]:
    put(x, y, c)

# Ojos
put(8, 3, OUT)
put(11, 3, OUT)

# Contorno de 1 píxel
filled = [(x, y) for y in range(N) for x in range(N) if grid[y][x]]
for (x, y) in filled:
    for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        if 0 <= x + dx < N and 0 <= y + dy < N and grid[y + dy][x + dx] is None:
            grid[y + dy][x + dx] = OUT

rects = "".join(
    f'<rect x="{x}" y="{y}" width="1" height="1" fill="{grid[y][x]}"/>' for y in range(N) for x in range(N) if grid[y][x]
)
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" shape-rendering="crispEdges">{rects}</svg>'
for path in ("public/logo.svg", "app/icon.svg"):
    open(path, "w").write(svg)

if __name__ == "__main__":
    sym = {None: ".", OUT: "#", WHITE: "W", SHADE: "s", KOI: "B", KOI_DARK: "D", GOLD: "G"}
    for y in range(N):
        print("".join(sym[grid[y][x]] for x in range(N)))

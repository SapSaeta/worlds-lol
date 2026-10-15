"""Convierte el logo original (design/logo-original.png, pixel art a 1254 px hecho
con ChatGPT) en una rejilla limpia de 40x40 con la paleta de la web.

El original no tiene los píxeles perfectamente alineados, así que se muestrea el
centro de cada celda, se ajusta cada color a la paleta y en el pie de la copa se
quitan los píxeles que rompen la simetría. Escribe public/logo.svg, app/icon.svg (favicon) y
app/apple-icon.png (icono de iOS sobre fondo marino).

Uso: python3 scripts/logo-from-png.py
"""
import collections

from PIL import Image

SRC = "design/logo-original.png"
STEP_X, OFF_X = 26.14, 0.0  # tamaño y desfase de la celda en el original
STEP_Y, OFF_Y = 25.58, 23.5
SIZE = 40

PALETTE = {
    "#": (8, 20, 41),  # marino noche, contorno
    "D": (43, 102, 168),  # azul profundo
    "B": (75, 155, 236),  # azul KOI
    "L": (140, 194, 247),  # azul claro
    "W": (242, 247, 255),  # blanco hielo
    "G": (248, 200, 56),  # dorado
    "Y": (248, 232, 128),  # dorado claro
}
BASE_FROM = 29  # desde esta fila (el pie de la copa) se fuerza la simetría


def sample():
    im = Image.open(SRC).convert("RGBA")
    px = im.load()
    w = im.width
    cols, rows = int((w - OFF_X) // STEP_X) + 2, int((w - OFF_Y) // STEP_Y) + 2
    grid = []
    for j in range(-1, rows - 1):
        row = []
        for i in range(-1, cols - 1):
            x0, y0 = OFF_X + i * STEP_X, OFF_Y + j * STEP_Y
            votes = collections.Counter()
            for yy in range(int(y0 + STEP_Y * 0.3), int(y0 + STEP_Y * 0.7)):
                for xx in range(int(x0 + STEP_X * 0.3), int(x0 + STEP_X * 0.7)):
                    if 0 <= xx < w and 0 <= yy < w:
                        r, g, b, a = px[xx, yy]
                        if a < 128:
                            votes["."] += 1
                        else:
                            votes[min(PALETTE, key=lambda k: sum((v - c) ** 2 for v, c in zip((r, g, b), PALETTE[k])))] += 1
            row.append(votes.most_common(1)[0][0] if votes else ".")
        grid.append(row)
    return grid


grid = sample()
cells = [(x, y) for y, row in enumerate(grid) for x, v in enumerate(row) if v != "."]
x0, x1 = min(x for x, _ in cells), max(x for x, _ in cells)
y0, y1 = min(y for _, y in cells), max(y for _, y in cells)
dx = (SIZE - (x1 - x0 + 1)) // 2 - x0
dy = (SIZE - (y1 - y0 + 1)) // 2 - y0

final = [["."] * SIZE for _ in range(SIZE)]
for (x, y) in cells:
    final[y + dy][x + dx] = grid[y][x]
for y in range(BASE_FROM, SIZE):
    for x in range(SIZE):
        if final[y][x] != "." and final[y][SIZE - 1 - x] == ".":
            final[y][x] = "."

runs = collections.defaultdict(list)
art = Image.new("RGBA", (SIZE, SIZE))
for y in range(SIZE):
    x = 0
    while x < SIZE:
        v = final[y][x]
        s = x
        while x < SIZE and final[y][x] == v:
            x += 1
        if v != ".":
            runs[v].append(f"M{s} {y}h{x - s}v1h-{x - s}z")
            for k in range(s, x):
                art.putpixel((k, y), PALETTE[v] + (255,))

paths = "".join(f'<path fill="#{"%02x%02x%02x" % PALETTE[v]}" d="{"".join(d)}"/>' for v, d in runs.items())
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" shape-rendering="crispEdges">{paths}</svg>'
for path in ("public/logo.svg", "app/icon.svg"):
    open(path, "w").write(svg)

apple = Image.new("RGBA", (180, 180), PALETTE["#"] + (255,))
apple.alpha_composite(art.resize((160, 160), Image.NEAREST), (10, 10))
apple.convert("RGB").save("app/apple-icon.png")
print(f"{x1 - x0 + 1}x{y1 - y0 + 1} px de dibujo en {SIZE}x{SIZE}, {len(svg) // 1024} KB")

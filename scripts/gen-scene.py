"""Genera public/scene.svg: cielo con nubes pixeladas, mar y hierba al estilo GBA.

Uso: python3 scripts/gen-scene.py
"""
import random

random.seed(26)
W, H = 480, 270  # 16:9, cada unidad es un "pixel" de la escena
out = []
r = lambda x, y, w, h, c: out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>')

SKY = "#8cc8f4"
r(0, 0, W, H, SKY)

# Franjas de transición del cielo hacia el horizonte, con tramado
HORIZON = 182
bands = [(HORIZON - 26, "#98cdf5"), (HORIZON - 18, "#aad4f5"), (HORIZON - 11, "#bbdaf1"), (HORIZON - 5, "#c5e3f9"), (HORIZON - 2, "#cfe7f8")]
for i, (y, c) in enumerate(bands):
    r(0, y, W, HORIZON - y, c)
    # tramado en damero en la fila superior de cada franja
    prev = SKY if i == 0 else bands[i - 1][1]
    for x in range(0, W, 2):
        r(x + (y % 2), y - 1, 1, 1, c)

# Nubes: grupos de "bolas" pixeladas con sombra lila
def cloud(cx, cy, size):
    puffs = [(cx, cy, size)]
    for _ in range(random.randint(3, 6)):
        puffs.append((cx + random.randint(-size * 2, size * 2), cy + random.randint(-size // 2, size // 3), random.randint(size // 2, size)))
    for (x, y, s) in puffs:  # sombra
        for dy in range(-s, s + 1):
            half = int((s * s - dy * dy) ** 0.5 * 1.6)
            if dy > s // 3:
                r(x - half, y + dy, half * 2, 1, "#aad3f1")
    for (x, y, s) in puffs:  # cuerpo
        for dy in range(-s, s // 2):
            half = int((s * s - dy * dy) ** 0.5 * 1.6)
            r(x - half, y + dy, half * 2, 1, "#e6e4f7")
    for (x, y, s) in puffs:  # brillo
        r(x - s // 2, y - s + 1, s, 1, "#f4f2fc")

for (cx, cy, s) in [(70, 118, 9), (30, 104, 4), (205, 130, 10), (275, 112, 11), (350, 132, 8), (420, 122, 10), (465, 142, 5), (150, 150, 5), (330, 150, 4), (110, 142, 4)]:
    cloud(cx, cy, s)

# Espuma del horizonte y mar
r(0, HORIZON, W, 2, "#e8f4fa")
r(0, HORIZON + 1, W, 1, "#f6f9f8")
r(0, HORIZON + 2, W, 2, "#c1dfed")
r(0, HORIZON + 4, W, 3, "#92b5ec")
r(0, HORIZON + 7, W, 2, "#8eabed")
SEA_Y = HORIZON + 9
GRASS_Y = 202
r(0, SEA_Y, W, GRASS_Y - SEA_Y, "#7291eb")
for _ in range(60):  # reflejos
    x, y = random.randint(0, W), random.randint(SEA_Y, GRASS_Y - 3)
    r(x, y, random.randint(3, 12), 1, "#8eabed")

# Hierba: borde dentado claro y cuerpo verde apagado
r(0, GRASS_Y, W, H - GRASS_Y, "#88ab77")
x = 0
while x < W:
    w = random.choice([1, 1, 2, 2, 3])
    top = GRASS_Y - random.choice([0, 1, 1, 2, 3, 4])
    r(x, top, w, GRASS_Y + 12 - top, "#bbe37b")
    r(x, top, w, 1, "#5a6857")
    x += w
for _ in range(220):  # matas y tramado en la franja clara
    x, y = random.randint(0, W), random.randint(GRASS_Y + 1, GRASS_Y + 11)
    r(x, y, 1, 1, random.choice(["#b7df89", "#bde387", "#a9d06f"]))
r(0, GRASS_Y + 12, W, 1, "#8db47a")
for x in range(0, W, 2):
    r(x, GRASS_Y + 12 + (x // 2) % 2, 1, 1, "#bbe596")
for _ in range(160):
    x, y = random.randint(0, W), random.randint(GRASS_Y + 15, H)
    r(x, y, random.randint(1, 3), 1, random.choice(["#89ac75", "#88ab79", "#8db47a"]))

svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
    f'shape-rendering="crispEdges" preserveAspectRatio="xMidYMax slice">' + "".join(out) + "</svg>"
)
open("public/scene.svg", "w").write(svg)
print(len(svg) // 1024, "KB")

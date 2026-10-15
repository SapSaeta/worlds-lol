"""Genera public/scene.svg: noche de final en el estanque, con la paleta de KOI.

Cielo azul marino que se aclara hasta el azul KOI en el horizonte, estrellas,
un estadio con focos, el lago reflejando las luces y carpas koi blancas y azules
nadando entre nenúfares. Todo en una rejilla de 480x270 "píxeles".

Uso: python3 scripts/gen-scene.py
"""
import random

random.seed(26)
W, H = 480, 270

# Paleta: azul KOI (#4b9bec, el del escudo oficial) y marinos de la misma familia
NAVY_0 = "#081429"
NAVY_1 = "#0b1b36"
NAVY_2 = "#102847"
NAVY_3 = "#16365e"
BLUE_1 = "#1f4c80"
BLUE_2 = "#2b66a8"
KOI = "#4b9bec"
KOI_LIGHT = "#8cc2f7"
ICE = "#d9ebff"
WHITE = "#f2f7ff"
GOLD = "#f8d860"
GOLD_DARK = "#d9a441"

px = [[NAVY_0] * W for _ in range(H)]


def rect(x, y, w, h, c):
    for yy in range(max(0, y), min(H, y + h)):
        row = px[yy]
        for xx in range(max(0, x), min(W, x + w)):
            row[xx] = c


def dot(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        px[y][x] = c


# ---------- Cielo: franjas con tramado en damero ----------
HORIZON = 178
bands = [(0, NAVY_0), (34, NAVY_1), (70, NAVY_2), (100, NAVY_3), (126, BLUE_1), (146, BLUE_2), (161, "#3a80cc"), (170, KOI), (175, KOI_LIGHT)]
for i, (y, c) in enumerate(bands):
    end = bands[i + 1][0] if i + 1 < len(bands) else HORIZON
    rect(0, y, W, end - y, c)
    if i:
        for x in range(0, W, 2):  # damero de transición
            dot(x + (y % 2), y - 1, c)
            dot(x + ((y + 1) % 2), y - 3, c) if x % 4 == 0 else None

# Estrellas, más densas arriba
for _ in range(170):
    x, y = random.randint(0, W - 1), int(random.random() ** 1.6 * 130)
    dot(x, y, random.choice([ICE, ICE, KOI_LIGHT, WHITE]))
for _ in range(14):  # estrellas grandes en cruz
    x, y = random.randint(4, W - 5), random.randint(4, 95)
    for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
        dot(x + dx, y + dy, WHITE if (dx, dy) == (0, 0) else KOI_LIGHT)

# Luna pixelada con cráteres
MX, MY, MR = 392, 46, 13
for y in range(-MR, MR + 1):
    for x in range(-MR, MR + 1):
        d = x * x + y * y
        if d <= MR * MR:
            dot(MX + x, MY + y, ICE if d > (MR - 2) ** 2 or x + y > 6 else WHITE)
for cx, cy, cr in [(-4, -3, 3), (5, 4, 2), (-2, 7, 1), (6, -5, 1)]:
    for y in range(-cr, cr + 1):
        for x in range(-cr, cr + 1):
            if x * x + y * y <= cr * cr:
                dot(MX + cx + x, MY + cy + y, KOI_LIGHT)

# ---------- Focos del estadio (haces translúcidos, se pintan aparte) ----------
beams = []
ARENA_X, ARENA_W = 240, 120
for bx, tx in [(200, 120), (222, 190), (258, 292), (280, 372)]:
    beams.append((bx, HORIZON - 26, tx, -10))

# ---------- Ciudad lejana y estadio en el horizonte ----------
x = 0
while x < W:
    w = random.randint(6, 16)
    h = random.randint(4, 15)
    if abs(x + w / 2 - ARENA_X) > ARENA_W / 2 + 6:
        rect(x, HORIZON - h, w, h, NAVY_2)
        for wy in range(HORIZON - h + 2, HORIZON - 1, 3):
            for wx in range(x + 1, x + w - 1, 3):
                if random.random() < 0.28:
                    dot(wx, wy, random.choice([GOLD, KOI_LIGHT, KOI]))
    x += w + random.randint(0, 3)

# Estadio: cúpula achatada con fila de luces y anillo azul KOI
for y in range(0, 26):
    half = int((ARENA_W / 2) * (1 - (1 - y / 26) ** 2.2) ** 0.5) if y < 26 else ARENA_W // 2
    rect(ARENA_X - half, HORIZON - 26 + y, half * 2, 1, NAVY_1)
rect(ARENA_X - ARENA_W // 2 + 4, HORIZON - 9, ARENA_W - 8, 2, KOI)
for wx in range(ARENA_X - ARENA_W // 2 + 8, ARENA_X + ARENA_W // 2 - 8, 4):
    dot(wx, HORIZON - 14, GOLD)
    dot(wx + 2, HORIZON - 5, KOI_LIGHT)
rect(ARENA_X - 6, HORIZON - 30, 12, 4, NAVY_1)  # remate
rect(ARENA_X - 1, HORIZON - 34, 2, 4, KOI)

# ---------- Lago ----------
LAKE_Y = HORIZON
rect(0, LAKE_Y, W, 2, KOI_LIGHT)
rect(0, LAKE_Y + 2, W, 2, KOI)
rect(0, LAKE_Y + 4, W, 4, BLUE_2)
rect(0, LAKE_Y + 8, W, 8, BLUE_1)
rect(0, LAKE_Y + 16, W, 14, NAVY_3)
rect(0, LAKE_Y + 30, W, H - LAKE_Y - 30, NAVY_2)
for i, (y, c) in enumerate([(LAKE_Y + 4, BLUE_2), (LAKE_Y + 8, BLUE_1), (LAKE_Y + 16, NAVY_3), (LAKE_Y + 30, NAVY_2)]):
    for x in range(0, W, 2):
        dot(x + (y % 2), y, px[y - 1][x])

# Reflejo del estadio y de los focos en el agua
for wx in range(ARENA_X - ARENA_W // 2 + 8, ARENA_X + ARENA_W // 2 - 8, 4):
    for k, y in enumerate(range(LAKE_Y + 5, LAKE_Y + 30, 3)):
        if random.random() < 0.8 - k * 0.08:
            rect(wx - 1, y, random.randint(2, 4), 1, GOLD if k < 2 else KOI_LIGHT)
for _ in range(110):  # destellos
    x, y = random.randint(0, W), random.randint(LAKE_Y + 4, H - 2)
    rect(x, y, random.randint(2, 9), 1, random.choice([KOI, BLUE_2, KOI_LIGHT]) if y < LAKE_Y + 40 else random.choice([NAVY_3, BLUE_1]))

# ---------- Nenúfares ----------
LILY = "#1f6a6f"
LILY_LIGHT = "#2f8a87"


def lily(cx, cy, r):
    for y in range(-r, r + 1):
        for x in range(-int(r * 1.6), int(r * 1.6) + 1):
            notch = x > r * 0.4 and abs(y) <= x * 0.3
            if (x / 1.6) ** 2 + y * y <= r * r and not notch:
                dot(cx + x, cy + y, LILY_LIGHT if y < -r // 3 else LILY)
    for x in range(-int(r * 1.6), int(r * 1.6) + 1):
        dot(cx + x, cy + r + 1, NAVY_1)


for (cx, cy, r) in [(30, 238, 5), (140, 226, 3), (236, 262, 4), (318, 232, 4), (406, 252, 6), (460, 214, 3), (14, 212, 3)]:
    lily(cx, cy, r)
# Flor de loto en un par de nenúfares
for (cx, cy) in [(404, 249), (28, 235)]:
    for dx, dy, c in [(0, -2, WHITE), (-1, -1, ICE), (1, -1, ICE), (0, -1, WHITE), (-2, 0, KOI_LIGHT), (2, 0, KOI_LIGHT), (0, 0, GOLD)]:
        dot(cx + dx, cy + dy, c)

# ---------- Carpas koi ----------
KOI_ART = [
    "..........KKKK",
    ".........KBBBBK",
    "..KK....KKWWWWKKKKK",
    ".KBBK..KWWWBBBWWWWWKK",
    "KBBBBKKWWWBBBBBWWWBBWK",
    ".KBBBBWWWWWBBBWWWBBBWEK",
    "KBBBBKKWWWWWWWWWWWWWWWWK",
    ".KBBK..KWWWBBWWWWWWWWWK",
    "..KK....KKWWWWWWWWKKKK",
    ".........KBBK...KBBK",
    "..........KK.....KK",
]
KOI_ART = [row.ljust(26, ".") for row in KOI_ART]


def koi(x0, y0, body, spot, left=False):
    colors = {"K": NAVY_1, "W": body, "B": spot, "E": NAVY_0}
    for y, row in enumerate(KOI_ART):
        for x, ch in enumerate(row[::-1] if left else row):
            if ch in colors:
                dot(x0 + x, y0 + y, colors[ch])
    # estela
    wx = x0 + (len(KOI_ART[0]) + 1 if left else -3)
    for k in range(3):
        dot(wx + (k * 2 if left else -k * 2), y0 + 5 + (k % 2), KOI if k == 0 else BLUE_1)


for (x, y, body, spot, left) in [
    (52, 212, WHITE, KOI, False),
    (168, 240, WHITE, KOI, True),
    (282, 214, GOLD, "#e8743b", False),
    (346, 250, WHITE, KOI, True),
    (430, 228, WHITE, BLUE_2, False),
    (100, 248, WHITE, BLUE_2, True),
]:
    koi(x, y, body, spot, left)

# Ondas en el agua
for (cx, cy, r) in [(204, 234, 6), (380, 222, 5), (26, 256, 5), (300, 258, 4)]:
    for x in range(-r, r + 1):
        if abs(x) > r // 3:
            dot(cx + x, cy + (0 if abs(x) > r * 2 // 3 else -1), KOI)

# ---------- Salida: un <path> por color con tramos horizontales ----------
runs = {}
for y in range(H):
    row = px[y]
    x = 0
    while x < W:
        c = row[x]
        s = x
        while x < W and row[x] == c:
            x += 1
        if c != NAVY_0:
            runs.setdefault(c, []).append(f"M{s} {y}h{x - s}v1h-{x - s}z")

beam_svg = "".join(
    f'<polygon points="{bx - 3},{by} {bx + 3},{by} {tx + 22},{ty} {tx - 22},{ty}" fill="{KOI_LIGHT}" fill-opacity="0.10"/>'
    for (bx, by, tx, ty) in beams
)
paths = "".join(f'<path fill="{c}" d="{"".join(d)}"/>' for c, d in runs.items())
svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
    f'shape-rendering="crispEdges" preserveAspectRatio="xMidYMax slice">'
    f'<rect width="{W}" height="{H}" fill="{NAVY_0}"/>{paths}{beam_svg}</svg>'
)
open("public/scene.svg", "w").write(svg)
print(len(svg) // 1024, "KB")

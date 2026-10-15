"""Genera los fondos pixelados del juego en public/game/:

- rift.svg: la Grieta del Invocador girada, con la base azul abajo y la roja
  arriba, las tres calles, el río, la jungla, el foso del dragón y el del Barón.
- arena-*.svg: fondos de combate (jungla, foso de los monstruos y base enemiga).

Uso: python3 scripts/gen-rift.py
"""
import math
import os
import random

OUT = "public/game"


class Canvas:
    def __init__(self, w, h, bg):
        self.w, self.h, self.bg = w, h, bg
        self.px = [[bg] * w for _ in range(h)]

    def dot(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def rect(self, x, y, w, h, c):
        for yy in range(max(0, y), min(self.h, y + h)):
            for xx in range(max(0, x), min(self.w, x + w)):
                self.px[yy][xx] = c

    def disc(self, cx, cy, r, c, ry=None):
        ry = ry or r
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                    self.dot(x, y, c)

    def get(self, x, y):
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else None

    def svg(self, path, extra=""):
        runs = {}
        for y in range(self.h):
            row = self.px[y]
            x = 0
            while x < self.w:
                c = row[x]
                s = x
                while x < self.w and row[x] == c:
                    x += 1
                if c != self.bg:
                    runs.setdefault(c, []).append(f"M{s} {y}h{x - s}v1h-{x - s}z")
        paths = "".join(f'<path fill="{c}" d="{"".join(d)}"/>' for c, d in runs.items())
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" '
            f'shape-rendering="crispEdges" preserveAspectRatio="xMidYMid slice">'
            f'<rect width="{self.w}" height="{self.h}" fill="{self.bg}"/>{paths}{extra}</svg>'
        )
        os.makedirs(OUT, exist_ok=True)
        open(os.path.join(OUT, path), "w").write(svg)
        print(path, len(svg) // 1024, "KB")


GRASS = "#3f6e37"
GRASS_D = "#355f2f"
GRASS_L = "#4b7f41"
TREE = "#1f3d25"
TREE_M = "#2a5030"
TREE_L = "#3a6a3c"
DIRT = "#b39a68"
DIRT_D = "#9a8256"
DIRT_L = "#c8b27e"
WATER = "#3a78b0"
WATER_L = "#6aa6d6"
WATER_D = "#2c5f90"
SAND = "#c9b77a"
STONE = "#8f98a3"
STONE_D = "#6b737d"
STONE_L = "#b8c0c8"
BLUE = "#3a7bd5"
BLUE_L = "#8cc2f7"
RED = "#d04040"
RED_L = "#f29a8a"
PURPLE = "#6a3a98"
PURPLE_L = "#9a6ac8"
GOLD = "#f8d860"


def grass(c, rnd, base=GRASS, dark=GRASS_D, light=GRASS_L):
    for y in range(c.h):
        for x in range(c.w):
            r = rnd.random()
            c.px[y][x] = dark if r < 0.12 else light if r < 0.18 else base


def tree(c, x, y, rnd):
    r = rnd.choice([3, 3, 4])
    c.disc(x, y + 1, r + 0.5, TREE)
    c.disc(x, y, r, TREE_M)
    c.disc(x - 1, y - 1, max(1, r - 2), TREE_L)


# ---------- Mapa de la Grieta ----------

def rift():
    rnd = random.Random(7)
    W, H = 160, 90
    c = Canvas(W, H, GRASS)
    grass(c, rnd)

    def lane(points, width):
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            steps = max(abs(x1 - x0), abs(y1 - y0)) * 2
            for i in range(steps + 1):
                t = i / steps
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                c.disc(x, y, width / 2 + 0.6, DIRT_D)
            for i in range(steps + 1):
                t = i / steps
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                c.disc(x, y, width / 2, DIRT)

    # Calles: centro recto, superior por la izquierda e inferior por la derecha
    lane([(80, 84), (80, 6)], 9)
    lane([(80, 84), (12, 82), (8, 8), (80, 6)], 7)
    lane([(80, 84), (148, 82), (152, 8), (80, 6)], 7)
    for _ in range(140):  # piedrecitas en la tierra
        x, y = rnd.randrange(W), rnd.randrange(H)
        if c.get(x, y) == DIRT:
            c.dot(x, y, DIRT_L if rnd.random() < 0.6 else DIRT_D)

    # Río ondulado que cruza de lado a lado
    for x in range(W):
        mid = 45 + math.sin(x / 9) * 2.2
        for y in range(int(mid - 6), int(mid + 7)):
            d = abs(y - mid)
            c.dot(x, y, SAND if d > 4.8 else WATER_D if d > 4 else WATER)
    for _ in range(70):
        x = rnd.randrange(W)
        y = int(45 + math.sin(x / 9) * 2.2 + rnd.randint(-3, 3))
        if c.get(x, y) == WATER:
            c.rect(x, y, rnd.choice([2, 3]), 1, WATER_L)

    # Fosos: Barón a la izquierda del río, dragón a la derecha
    for cx, col, col_l in [(40, PURPLE, PURPLE_L), (120, WATER_D, WATER_L)]:
        c.disc(cx, 45, 8, STONE_D, 6)
        c.disc(cx, 45, 7, col, 5)
        c.disc(cx - 1, 44, 3, col_l, 2)

    # Jungla: árboles en los huecos, sin tapar calles ni río
    spots = []
    for _ in range(900):
        x, y = rnd.randrange(3, W - 3), rnd.randrange(3, H - 3)
        if all(c.get(x + dx, y + dy) in (GRASS, GRASS_D, GRASS_L) for dx in (-4, 0, 4) for dy in (-4, 0, 4)):
            if all(abs(x - sx) + abs(y - sy) > 7 for sx, sy in spots):
                spots.append((x, y))
    for x, y in sorted(spots, key=lambda p: p[1]):
        tree(c, x, y, rnd)

    # Torretas en las calles
    def turret(x, y, col):
        c.rect(x - 1, y - 3, 3, 5, STONE_D)
        c.rect(x - 1, y - 3, 2, 4, STONE)
        c.dot(x, y - 4, col)
        c.dot(x - 1, y - 4, col)

    for y in (72, 60):
        turret(80, y, BLUE)
    for y in (18, 30):
        turret(80, y, RED)
    for x, y in [(12, 66), (30, 82), (148, 66), (130, 82)]:
        turret(x, y, BLUE)
    for x, y in [(8, 24), (30, 6), (152, 24), (130, 6)]:
        turret(x, y, RED)

    # Bases con su nexo
    for cy, col, col_l in [(H + 2, BLUE, BLUE_L), (-3, RED, RED_L)]:
        c.disc(80, cy, 16, STONE_D, 11)
        c.disc(80, cy, 14, STONE, 9)
        c.disc(80, cy, 6, col, 5)
        c.disc(79, cy - 1, 2, col_l, 2)
    c.svg("rift.svg")


# ---------- Fondos de combate ----------

def arena(name, ground, ground_d, ground_l, far, far_l, water=None, sky=None, seed=3):
    rnd = random.Random(seed)
    W, H = 160, 90
    c = Canvas(W, H, ground)
    grass(c, rnd, ground, ground_d, ground_l)
    # Franja del fondo: árboles o muros
    top = 30
    c.rect(0, 0, W, top, far)
    if sky:
        c.rect(0, 0, W, 12, sky)
    for x in range(-2, W + 4, 6):
        h = top + rnd.randint(-3, 3)
        c.disc(x, h - 2, 5, far_l if rnd.random() < 0.5 else far)
    for x in range(0, W, 9):
        c.disc(x + rnd.randint(-2, 2), top - 10 + rnd.randint(-3, 3), 4, far_l)
    if water:
        # Agua del foso detrás del campo
        for x in range(W):
            mid = top + 6 + math.sin(x / 7) * 1.2
            for y in range(int(mid - 3), int(mid + 4)):
                c.dot(x, y, water[0] if abs(y - mid) < 2.5 else water[1])
        for _ in range(30):
            x = rnd.randrange(W)
            c.rect(x, top + 5 + rnd.randint(-1, 1), 2, 1, water[2])
    # Hierba cerca: matojos
    for _ in range(26):
        x, y = rnd.randrange(W), rnd.randrange(top + 12, H)
        for dx, dy in [(0, 0), (1, -1), (2, 0), (-1, -1)]:
            c.dot(x + dx, y + dy, ground_l)
    c.svg(f"arena-{name}.svg")


if __name__ == "__main__":
    rift()
    arena("jungla", "#5e9446", "#53873e", "#6ea552", TREE, TREE_M, seed=3)
    arena("foso", "#56806a", "#4a735e", "#669479", "#2a3f4a", "#36525e", water=(WATER, WATER_D, WATER_L), seed=5)
    arena("nexo", "#7a7f8a", "#6b707a", "#8a909a", "#4a2a3a", "#6a3a4a", sky="#2a1626", seed=9)

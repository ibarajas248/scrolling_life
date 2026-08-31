from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path("pages/mundo-gif/assets")
SCALE = 3

PALETTE = {
    "ink": "#201028",
    "deep": "#54245f",
    "pink": "#ff4fba",
    "hot": "#ff1f8f",
    "soft": "#ffd8f0",
    "cyan": "#46f7ff",
    "blue": "#4867ff",
    "lime": "#baff45",
    "yellow": "#ffe766",
    "orange": "#ff9d2f",
    "cream": "#fff7d8",
    "white": "#ffffff",
}


def px(draw, x, y, color, w=1, h=1):
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color)


def rect(draw, xy, fill, outline=None, width=1):
    draw.rectangle(xy, fill=fill, outline=outline, width=width)


def save_gif(name, frames, duration=150):
    scaled = [
        frame.resize((frame.width * SCALE, frame.height * SCALE), Image.Resampling.NEAREST)
        for frame in frames
    ]
    path = OUT / name
    scaled[0].save(
        path,
        save_all=True,
        append_images=scaled[1:],
        duration=duration,
        loop=0,
        disposal=2,
        optimize=True,
    )


def frame(w=48, h=48, bg=None):
    return Image.new("RGBA", (w, h), bg or (0, 0, 0, 0))


def heart():
    frames = []
    for i, size in enumerate([0, 1, 0, -1]):
        im = frame()
        d = ImageDraw.Draw(im)
        c = PALETTE["hot"] if i % 2 else PALETTE["pink"]
        blocks = [
            (13, 12, 8, 8), (27, 12, 8, 8), (9, 18, 30, 11),
            (13, 29, 22, 6), (18, 35, 12, 5), (22, 40, 4, 3),
        ]
        for x, y, w, h in blocks:
            rect(d, [x - size, y - size, x + w + size, y + h + size], c, PALETTE["ink"])
        px(d, 18, 17, PALETTE["soft"], 4, 3)
        frames.append(im)
    return frames


def star():
    frames = []
    shifts = [0, 1, 0, -1, 0]
    for i, s in enumerate(shifts):
        im = frame()
        d = ImageDraw.Draw(im)
        c = PALETTE["yellow"] if i % 2 else PALETTE["lime"]
        rect(d, [21, 5 + s, 27, 18 + s], c, PALETTE["ink"])
        rect(d, [16, 19 + s, 32, 25 + s], c, PALETTE["ink"])
        rect(d, [6, 21 + s, 42, 27 + s], c, PALETTE["ink"])
        rect(d, [18, 28 + s, 30, 34 + s], c, PALETTE["ink"])
        rect(d, [14, 35 + s, 34, 41 + s], c, PALETTE["ink"])
        px(d, 24, 9 + s, PALETTE["white"], 3, 3)
        frames.append(im)
    return frames


def computer():
    frames = []
    for i in range(5):
        im = frame(64, 54)
        d = ImageDraw.Draw(im)
        rect(d, [5, 5, 58, 37], PALETTE["cream"], PALETTE["ink"], 2)
        rect(d, [11, 11, 52, 30], PALETTE["deep"], PALETTE["ink"])
        y = 15 + (i % 3)
        rect(d, [16, y, 47, y + 3], PALETTE["cyan"])
        rect(d, [16, y + 8, 37, y + 10], PALETTE["lime"])
        rect(d, [25, 38, 39, 44], PALETTE["cream"], PALETTE["ink"])
        rect(d, [17, 45, 47, 49], PALETTE["pink"], PALETTE["ink"])
        px(d, 50, 33, PALETTE["hot"], 4, 3)
        frames.append(im)
    return frames


def floppy():
    frames = []
    for i in range(4):
        im = frame()
        d = ImageDraw.Draw(im)
        rect(d, [9, 6 + i % 2, 39, 41 + i % 2], PALETTE["blue"], PALETTE["ink"], 2)
        rect(d, [15, 10 + i % 2, 32, 21 + i % 2], PALETTE["cream"], PALETTE["ink"])
        rect(d, [18, 29 + i % 2, 35, 37 + i % 2], PALETTE["soft"], PALETTE["ink"])
        rect(d, [34, 10 + i % 2, 38, 22 + i % 2], PALETTE["ink"])
        frames.append(im)
    return frames


def cursor():
    frames = []
    for i, shift in enumerate([0, 2, 4, 2]):
        im = frame()
        d = ImageDraw.Draw(im)
        pts = [(12 + shift, 7), (12 + shift, 38), (20 + shift, 30), (26 + shift, 43), (31 + shift, 41), (25 + shift, 28), (36 + shift, 28)]
        d.polygon(pts, fill=PALETTE["white"], outline=PALETTE["ink"])
        rect(d, [32, 10, 39, 17], PALETTE["lime"] if i % 2 else PALETTE["pink"], PALETTE["ink"])
        frames.append(im)
    return frames


def planet():
    frames = []
    for i in range(6):
        im = frame(56, 48)
        d = ImageDraw.Draw(im)
        d.ellipse([15, 10, 40, 35], fill=PALETTE["pink"], outline=PALETTE["ink"], width=2)
        offset = (i % 3) - 1
        d.arc([4 + offset, 15, 52 + offset, 32], 8, 172, fill=PALETTE["cyan"], width=3)
        d.arc([4 - offset, 14, 52 - offset, 33], 188, 352, fill=PALETTE["yellow"], width=3)
        px(d, 24, 16, PALETTE["soft"], 4, 4)
        frames.append(im)
    return frames


def flame():
    frames = []
    for i in range(5):
        im = frame()
        d = ImageDraw.Draw(im)
        top = 7 + (i % 2)
        d.polygon([(24, top), (35, 24), (31, 40), (17, 40), (12, 25)], fill=PALETTE["hot"], outline=PALETTE["ink"])
        d.polygon([(24, 15), (30, 27), (27, 38), (19, 38), (17, 27)], fill=PALETTE["orange"])
        d.polygon([(24, 23), (27, 32), (24, 38), (21, 32)], fill=PALETTE["yellow"])
        frames.append(im)
    return frames


def portal():
    frames = []
    colors = [PALETTE["cyan"], PALETTE["lime"], PALETTE["yellow"], PALETTE["pink"]]
    for i in range(6):
        im = frame(58, 58)
        d = ImageDraw.Draw(im)
        for ring in range(4):
            inset = 5 + ring * 5
            color = colors[(i + ring) % len(colors)]
            d.rectangle([inset, inset, 57 - inset, 57 - inset], outline=color, width=3)
        rect(d, [24, 24, 33, 33], PALETTE["ink"])
        frames.append(im)
    return frames


def book():
    frames = []
    for i in range(4):
        im = frame(54, 48)
        d = ImageDraw.Draw(im)
        rect(d, [7, 8, 26, 39], PALETTE["soft"], PALETTE["ink"], 2)
        rect(d, [27, 8, 47, 39], PALETTE["cream"], PALETTE["ink"], 2)
        rect(d, [25, 9, 29, 40], PALETTE["pink"], PALETTE["ink"])
        for y in [15, 21, 27, 33]:
            rect(d, [12, y + i % 2, 22, y + i % 2 + 1], PALETTE["deep"])
            rect(d, [33, y, 43, y + 1], PALETTE["deep"])
        frames.append(im)
    return frames


def cassette():
    frames = []
    for i in range(4):
        im = frame(64, 42)
        d = ImageDraw.Draw(im)
        rect(d, [5, 7, 58, 34], PALETTE["cream"], PALETTE["ink"], 2)
        rect(d, [12, 12, 51, 21], PALETTE["pink"], PALETTE["ink"])
        d.ellipse([14, 23, 25, 34], fill=PALETTE["cyan"], outline=PALETTE["ink"])
        d.ellipse([39, 23, 50, 34], fill=PALETTE["lime"], outline=PALETTE["ink"])
        d.line([19, 28, 45, 28 + (i % 2)], fill=PALETTE["ink"], width=2)
        frames.append(im)
    return frames


def envelope():
    frames = []
    for i in range(5):
        im = frame(56, 42)
        d = ImageDraw.Draw(im)
        y = 7 + (i % 2)
        rect(d, [6, y, 49, y + 28], PALETTE["cream"], PALETTE["ink"], 2)
        d.line([7, y + 1, 27, y + 18, 49, y + 1], fill=PALETTE["pink"], width=2)
        d.line([7, y + 28, 23, y + 14, 49, y + 28], fill=PALETTE["pink"], width=2)
        rect(d, [42, y - 5, 53, y + 6], PALETTE["lime"] if i % 2 else PALETTE["cyan"], PALETTE["ink"])
        frames.append(im)
    return frames


def gem():
    frames = []
    for i in range(4):
        im = frame()
        d = ImageDraw.Draw(im)
        d.polygon([(12, 17), (19, 8), (31, 8), (38, 17), (24, 41)], fill=PALETTE["cyan"], outline=PALETTE["ink"])
        d.line([19, 9, 24, 40, 31, 9], fill=PALETTE["white"], width=1 + (i % 2))
        d.line([13, 17, 38, 17], fill=PALETTE["white"], width=1)
        px(d, 20, 12, PALETTE["white"], 4, 3)
        frames.append(im)
    return frames


def crown():
    frames = []
    for i in range(4):
        im = frame(54, 42)
        d = ImageDraw.Draw(im)
        y = 10 + (i % 2)
        d.polygon([(8, y + 21), (8, y + 8), (18, y + 17), (27, y + 4), (36, y + 17), (46, y + 8), (46, y + 21)], fill=PALETTE["yellow"], outline=PALETTE["ink"])
        rect(d, [10, y + 22, 44, y + 30], PALETTE["orange"], PALETTE["ink"], 2)
        for x, c in [(17, "pink"), (27, "cyan"), (37, "lime")]:
            rect(d, [x, y + 22, x + 4, y + 26], PALETTE[c], PALETTE["ink"])
        frames.append(im)
    return frames


def construction():
    frames = []
    for i in range(6):
        im = frame(92, 34)
        d = ImageDraw.Draw(im)
        rect(d, [2, 5, 89, 29], PALETTE["yellow"], PALETTE["ink"], 2)
        for x in range(-20 + i * 4, 100, 18):
            d.polygon([(x, 5), (x + 8, 5), (x + 25, 29), (x + 17, 29)], fill=PALETTE["pink"])
        rect(d, [6, 11, 85, 23], None, PALETTE["ink"], 1)
        frames.append(im)
    return frames


def new_badge():
    frames = []
    for i in range(4):
        im = frame(66, 38)
        d = ImageDraw.Draw(im)
        c = PALETTE["lime"] if i % 2 else PALETTE["hot"]
        rect(d, [4, 7, 61, 31], c, PALETTE["ink"], 2)
        for x in [14, 22, 30, 41, 49]:
            rect(d, [x, 15 + i % 2, x + 5, 22 + i % 2], PALETTE["cream"], PALETTE["ink"])
        frames.append(im)
    return frames


def sparkle_line():
    frames = []
    for i in range(6):
        im = frame(104, 28)
        d = ImageDraw.Draw(im)
        for x in range(6, 100, 18):
            s = (i + x // 18) % 3
            color = [PALETTE["pink"], PALETTE["cyan"], PALETTE["lime"]][s]
            rect(d, [x, 12, x + 9, 15], color)
            rect(d, [x + 3, 8, x + 6, 19], color)
        frames.append(im)
    return frames


def smile():
    frames = []
    for i in range(4):
        im = frame(48, 48)
        d = ImageDraw.Draw(im)
        d.ellipse([7, 7, 40, 40], fill=PALETTE["yellow"], outline=PALETTE["ink"], width=2)
        rect(d, [16, 18, 20, 22], PALETTE["ink"])
        rect(d, [29, 18, 33, 22], PALETTE["ink"])
        if i % 2:
            d.arc([15, 17, 34, 35], 20, 160, fill=PALETTE["ink"], width=2)
        else:
            d.arc([15, 19, 34, 35], 20, 160, fill=PALETTE["hot"], width=3)
        frames.append(im)
    return frames


def lightning():
    frames = []
    for i in range(4):
        im = frame()
        d = ImageDraw.Draw(im)
        color = PALETTE["yellow"] if i % 2 else PALETTE["cyan"]
        d.polygon([(27, 3), (13, 25), (24, 25), (18, 45), (36, 19), (25, 19)], fill=color, outline=PALETTE["ink"])
        frames.append(im)
    return frames


def flower():
    frames = []
    for i in range(5):
        im = frame()
        d = ImageDraw.Draw(im)
        cx, cy = 24, 22 + i % 2
        for dx, dy in [(0, -10), (10, 0), (0, 10), (-10, 0)]:
            d.ellipse([cx + dx - 7, cy + dy - 7, cx + dx + 7, cy + dy + 7], fill=PALETTE["pink"], outline=PALETTE["ink"])
        d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=PALETTE["yellow"], outline=PALETTE["ink"])
        rect(d, [23, 32, 26, 45], PALETTE["lime"], PALETTE["ink"])
        frames.append(im)
    return frames


ASSETS = {
    "heart.gif": heart,
    "star.gif": star,
    "computer.gif": computer,
    "floppy.gif": floppy,
    "cursor.gif": cursor,
    "planet.gif": planet,
    "flame.gif": flame,
    "portal.gif": portal,
    "book.gif": book,
    "cassette.gif": cassette,
    "envelope.gif": envelope,
    "gem.gif": gem,
    "crown.gif": crown,
    "construction.gif": construction,
    "new-badge.gif": new_badge,
    "sparkle-line.gif": sparkle_line,
    "smile.gif": smile,
    "lightning.gif": lightning,
    "flower.gif": flower,
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, maker in ASSETS.items():
        save_gif(name, maker())
        print(name)


if __name__ == "__main__":
    main()

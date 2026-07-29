#!/usr/bin/env python3
# 无依赖生成马卡龙风格 PWA 图标 PNG（192/512/180/512-maskable）
import struct, zlib, math, os

OUT = os.path.join(os.path.dirname(__file__), "assets", "icons")
os.makedirs(OUT, exist_ok=True)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def write_png(path, size, pixels, has_alpha=True):
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0
        row = pixels[y]
        for x in range(size):
            r, g, b, a = row[x]
            raw += bytes((r, g, b, a))
    comp = zlib.compress(bytes(raw), 9)
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    color_type = 6 if has_alpha else 2  # 6=RGBA,2=RGB
    ihdr = struct.pack(">IIBBBBB", size, size, 8, color_type, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", comp))
        f.write(chunk(b"IEND", b""))

def rounded_alpha(x, y, size, radius):
    # 透明圆角矩形遮罩：圆角内=255，圆角外=0
    if x >= radius and x <= size - radius:
        return 255 if (y >= radius and y <= size - radius) else (255 if (y < radius or y > size - radius) and False else 0)
    if y >= radius and y <= size - radius:
        return 255 if (x < radius or x > size - radius) and False else 0
    # 角区域
    cx = radius if x < radius else size - radius
    cy = radius if y < radius else size - radius
    d = math.hypot(x - cx, y - cy)
    return 255 if d <= radius else 0

def build(size, radius_ratio, circles, top, bottom):
    radius = int(size * radius_ratio)
    px = [[(0,0,0,0)]*size for _ in range(size)]
    for y in range(size):
        t = y/(size-1) if size>1 else 0
        base = lerp(top, bottom, t)
        for x in range(size):
            a = 255 if radius_ratio == 0 else rounded_alpha(x, y, size, radius)
            if a == 0:
                px[y][x] = (0,0,0,0)
                continue
            r, g, b = base
            # 叠加马卡龙圆点
            for (cx, cy, cr, col, ca) in circles:
                d = math.hypot(x - cx*size, y - cy*size)
                if d < cr*size:
                    # 柔和边缘
                    edge = max(0.0, 1 - (d/(cr*size)))
                    aa = ca * (0.6 + 0.4*edge)
                    r = int(r*(1-aa) + col[0]*aa)
                    g = int(g*(1-aa) + col[1]*aa)
                    b = int(b*(1-aa) + col[2]*aa)
            px[y][x] = (r, g, b, a)
    return px

TOP = (247, 168, 196)    # 马卡龙粉
BOTTOM = (185, 167, 232) # 薰衣草
DOTS = [
    (0.32, 0.34, 0.20, (174, 222, 194), 0.85),  # 薄荷
    (0.68, 0.40, 0.16, (246, 180, 131), 0.85),  # 蜜桃
    (0.40, 0.66, 0.17, (253, 238, 180), 0.90),  # 奶油
    (0.70, 0.70, 0.14, (174, 217, 240), 0.85),  # 天空蓝
]

# 普通图标（圆角、透明背景）
write_png(os.path.join(OUT, "icon-192.png"), 192, build(192, 0.22, DOTS, TOP, BOTTOM))
write_png(os.path.join(OUT, "icon-512.png"), 512, build(512, 0.22, DOTS, TOP, BOTTOM))
# 苹果 touch 图标（无透明、直角，180）
write_png(os.path.join(OUT, "apple-touch-icon.png"), 180, build(180, 0.0, DOTS, TOP, BOTTOM), has_alpha=False)
# maskable（无透明、直角、内容居中安全区）
write_png(os.path.join(OUT, "icon-maskable-512.png"), 512, build(512, 0.0, DOTS, TOP, BOTTOM), has_alpha=False)
# favicon（用 192 圆角）
print("icons written:", os.listdir(OUT))

#!/usr/bin/env python3
# 无依赖生成莫兰迪奶油白风格 PWA 图标 PNG
import struct, zlib, math, os

OUT = os.path.join(os.path.dirname(__file__), "assets", "icons")
os.makedirs(OUT, exist_ok=True)

# 莫兰迪奶油白主题色
CREAM = (243, 239, 232)      # #f3efe8 奶油白
TERRA = (176, 141, 126)      # #b08d7e 陶土色
SAGE = (148, 168, 155)       # #94a89b 鼠尾草绿
DEEP = (120, 95, 85)         # 深陶土，用于点缀

def write_png(path, size, pixels, has_alpha=True):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        row = pixels[y]
        for x in range(size):
            r, g, b, a = row[x]
            raw += bytes((r, g, b, a))
    comp = zlib.compress(bytes(raw), 9)
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    color_type = 6 if has_alpha else 2
    ihdr = struct.pack(">IIBBBBB", size, size, 8, color_type, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", comp))
        f.write(chunk(b"IEND", b""))

def rounded_alpha(x, y, size, radius):
    if radius <= 0:
        return 255
    if x >= radius and x <= size - 1 - radius:
        return 255 if (y >= radius and y <= size - 1 - radius) else 0
    if y >= radius and y <= size - 1 - radius:
        return 255 if (x >= radius and x <= size - 1 - radius) else 0
    cx = radius if x < radius else size - 1 - radius
    cy = radius if y < radius else size - 1 - radius
    return 255 if math.hypot(x - cx, y - cy) <= radius else 0

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def build_icon(size, radius_ratio, bg, main_color, accent_color):
    radius = int(size * radius_ratio)
    px = [[(0, 0, 0, 0)] * size for _ in range(size)]
    cx = cy = size // 2
    # 主体圆角方块背景
    for y in range(size):
        for x in range(size):
            a = rounded_alpha(x, y, size, radius)
            if a == 0:
                px[y][x] = bg + (0,)
                continue
            # 背景色
            r, g, b = bg
            # 居中圆形陶土色
            d = math.hypot(x - cx, y - cy)
            circle_r = size * 0.34
            if d <= circle_r:
                edge = max(0.0, 1 - d / circle_r)
                blend = 0.95 if edge > 0.05 else (0.5 + 0.5 * edge / 0.05)
                r = int(r * (1 - blend) + main_color[0] * blend)
                g = int(g * (1 - blend) + main_color[1] * blend)
                b = int(b * (1 - blend) + main_color[2] * blend)
            # 右下角小圆点装饰
            dot_dx = x - (cx + size * 0.18)
            dot_dy = y - (cy + size * 0.18)
            dot_d = math.hypot(dot_dx, dot_dy)
            if dot_d <= size * 0.09:
                blend = max(0.0, 1 - dot_d / (size * 0.09))
                r = int(r * (1 - blend) + accent_color[0] * blend)
                g = int(g * (1 - blend) + accent_color[1] * blend)
                b = int(b * (1 - blend) + accent_color[2] * blend)
            px[y][x] = (r, g, b, 255)
    return px

# 1) 普通 PWA 图标：透明背景 + 圆角
icon192 = build_icon(192, 0.22, CREAM, TERRA, SAGE)
icon512 = build_icon(512, 0.22, CREAM, TERRA, SAGE)
write_png(os.path.join(OUT, "icon-192.png"), 192, icon192, has_alpha=True)
write_png(os.path.join(OUT, "icon-512.png"), 512, icon512, has_alpha=True)

# 2) Apple Touch Icon：不透明直角正方形 180x180
apple = build_icon(180, 0.0, CREAM, TERRA, SAGE)
write_png(os.path.join(OUT, "apple-touch-icon.png"), 180, apple, has_alpha=False)

# 3) Maskable：不透明直角，内容在中心安全区
maskable = build_icon(512, 0.0, CREAM, TERRA, SAGE)
write_png(os.path.join(OUT, "icon-maskable-512.png"), 512, maskable, has_alpha=False)

print("icons written:", sorted(os.listdir(OUT)))

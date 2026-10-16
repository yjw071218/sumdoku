"""Export Play Games artwork using the existing Sumdoku icon and app screenshots."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "play-games-assets"
OUT.mkdir(exist_ok=True)
BLUE = (37, 99, 235)
MINT = (52, 211, 153)
WHITE = (255, 255, 255)

def existing_icon_at_512():
    # Direct 512px rasterization of app/src/main/assets/app-icon.svg's exact geometry.
    scale = 512 / 108
    def q(n): return round(n * scale)
    im = Image.new("RGB", (512, 512), BLUE)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, 511, 511), radius=q(24), fill=BLUE)
    d.rectangle((q(29), q(29), q(79), q(79)), fill=WHITE)
    d.rectangle((q(44), q(29), q(47), q(79)), fill=BLUE)
    d.rectangle((q(61), q(29), q(64), q(79)), fill=BLUE)
    d.rectangle((q(29), q(44), q(79), q(47)), fill=BLUE)
    d.rectangle((q(29), q(61), q(79), q(64)), fill=BLUE)
    d.rectangle((q(64), q(29), q(79), q(44)), fill=MINT)
    # The small blue marks are the same marks in the existing SVG icon.
    d.rectangle((q(35), q(33), q(38), q(40)), fill=BLUE)
    # SVG path d="M51 50h7v3h-4v2h4v3h-7z"
    d.polygon([(q(51),q(50)),(q(58),q(50)),(q(58),q(53)),(q(54),q(53)),(q(54),q(55)),(q(58),q(55)),(q(58),q(58)),(q(51),q(58))], fill=BLUE)
    # SVG path d="M68 68h7v3h-4v4h-3z"
    d.polygon([(q(68),q(68)),(q(75),q(68)),(q(75),q(71)),(q(71),q(71)),(q(71),q(75)),(q(68),q(75))], fill=BLUE)
    return im

icon = existing_icon_at_512()
icon.save(OUT / "sumdoku-game-icon-512.png", format="PNG", optimize=True)

full = Image.open(OUT / "sumdoku-gameplay-full.png").convert("RGB")
board = Image.open(OUT / "sumdoku-gameplay-board.png").convert("RGB")

# Simple Play Games landscape banner: the original icon and two genuine captures
# from the app, with no invented board artwork or replacement branding.
W, H = 1024, 500
banner = Image.new("RGB", (W, H), BLUE)
draw = ImageDraw.Draw(banner)
draw.rounded_rectangle((24, 24, 1000, 476), radius=30, fill=(31, 83, 193))

icon_card = Image.new("RGBA", (208, 208), (255, 255, 255, 255))
icon_large = icon.resize((184, 184), Image.Resampling.LANCZOS)
icon_card.alpha_composite(icon_large.convert("RGBA"), (12, 12))
banner.paste(icon_card.convert("RGB"), (56, 146))

def fit_cover(source, size):
    sw, sh = source.size; tw, th = size
    ratio = max(tw/sw, th/sh)
    resized = source.resize((round(sw*ratio), round(sh*ratio)), Image.Resampling.LANCZOS)
    x = (resized.width-tw)//2; y = (resized.height-th)//2
    return resized.crop((x, y, x+tw, y+th))

def framed(source, xy, size, radius=20):
    x, y = xy; w, h = size
    crop = fit_cover(source, (w, h))
    mask = Image.new("L", (w,h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1), radius=radius, fill=255)
    banner.paste(crop, (x,y), mask)
    ImageDraw.Draw(banner).rounded_rectangle((x-4,y-4,x+w+3,y+h+3), radius=radius+4, outline=WHITE, width=4)

# Board close-up and complete live game screen are both captured from the app.
framed(board, (322, 86), (330, 330), radius=22)
framed(full, (698, 56), (258, 388), radius=20)
banner.save(OUT / "sumdoku-graphic-1024x500.png", format="PNG", optimize=True)
print(f"Updated icon from existing app icon design: {OUT / 'sumdoku-game-icon-512.png'}")
print(f"Updated gameplay banner from captured in-game screens: {OUT / 'sumdoku-graphic-1024x500.png'}")

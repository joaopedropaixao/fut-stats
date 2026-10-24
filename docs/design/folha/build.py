"""Gera a folha do DS v1.4 (arquivo design-system-v1.3.html, nome mantido para não quebrar links) com estilo inline e tokens, no formato aceito pelo Paper:
só div/span/svg, sem margin, sem calc. Rodar: python3 build.py"""
import math
import re
from pathlib import Path

OUT = Path(__file__).with_name("design-system-v1.3.html")

TOKENS = """
  --color-bg: #0D2717; --color-surface: #143521; --color-surface-raised: #1A3F29; --color-surface-3: #1E472E;
  --color-border: #2F6444; --color-border-strong: #77A285; --color-track: #09190F;
  --color-bg-night: #0A0F0C; --color-surface-night: #141A16; --color-surface-raised-night: #1E2520;
  --color-surface-3-night: #262E28; --color-border-night: #2A332D; --color-border-strong-night: #667069;
  --color-text: #F3EAD3; --color-text-muted: #CFCAB5; --color-disabled: #9DB0A2;
  --color-accent: #FACC15; --color-accent-pressed: #E0B20A; --color-on-accent: #111111;
  --color-accent-glow: rgb(250 204 21 / 40%); --color-game: var(--color-accent);
  --color-team-white: #FFFFFF; --color-team-black: #000000;
  --color-success: #22C55E; --color-danger: #EF4444; --color-warning: #FB923C;
  --color-gold: #E8A93A; --color-flop: #C4A07C;
  --color-highlight: rgb(255 255 255 / 7%); --color-chalk: rgb(255 255 255 / 14%);
  --color-floodlight: rgb(214 250 190 / 18%); --color-floodlight-night: rgb(236 244 214 / 16%);
  --color-scrim: rgb(0 0 0 / 62%); --color-field: #1B4F2D;
  --font-sans: Chakra Petch; --font-pixel: Silkscreen; --font-pixel-num: "Dígitos 6x9 (SVG próprio)";
  --text-xs: 12px; --text-caption: 13px; --text-sm: 14px; --text-base: 16px; --text-lg: 20px;
  --text-subtitle: 24px; --text-xl: 28px; --text-2xl: 40px; --text-display: 64px; --text-hero: 112px;
  --font-weight-regular: 400; --font-weight-medium: 500; --font-weight-semibold: 600;
  --font-weight-bold: 700; --font-weight-extrabold: 800;
  --tracking-tight: -0.01em; --tracking-wide: 0.08em; --leading-tight: 105%; --leading-normal: 150%;
  --opacity-muted: 60%;
  --breakpoint-sm: 390px; --breakpoint-md: 768px; --breakpoint-lg: 1280px;
  --container-mobile: 390px; --container-content: 640px;
  --spacing-1: 4px; --spacing-2: 8px; --spacing-3: 12px; --spacing-4: 16px; --spacing-6: 24px;
  --spacing-8: 32px; --spacing-12: 48px; --spacing-14: 56px;
  --radius-sm: 8px; --radius-md: 14px; --radius-lg: 20px; --radius-full: 999px;
"""

# ---------- pixel art ----------
PLAYER = ["..hhhh..", "..hsss..", "..ssss..", "...ss...", ".TTTTTT.", "sTTTTTTs", "sTTTTTTs", "..TTTT..",
          "..kkkk..", "..s..s..", "..s..s..", ".bb..bb."]
RUNNER = ["...hhhh.", "...hsss.", "...ssss.", "....ss..", "..TTTTTs", ".sTTTTT.", "s.TTTT..", "..TTTT..",
          "..kkkk..", ".s....s.", "s......s", "b.......b"[:8]]
CELEBRA = ["G.........G.", "..s.hhhh.s..", "..s.hsss.s..", "..sTssssTs..", "...TTssTT...", "....TTTT....",
           "G...TTTT...G", "....kkkk....", "....s..s....", "....s..s....", "...bb..bb...", ".G........G."]
STAR = ["....G....", "...GGG...", "...GYG...", "GGGGYGGGG", ".GGYYYGG.", "..GGGGG..", "..GG.GG..",
        ".GG...GG.", "GG.....GG"]
STAR_SOLID = ["....K....", "...KKK...", "...KKK...", "KKKKKKKKK", ".KKKKKKK.", "..KKKKK..", "..KK.KK..",
              ".KK...KK.", "KK.....KK"]
BALL = ["..WWW..", ".WKWWW.", "WWWWKWW", "WKWWWWW", "WWWKWKW", ".WWWWW.", "..WWW.."]
BURST = ["....Y....Y....Y....", ".....Y...Y...Y.....", "Y.....Y..Y..Y.....Y", ".Y.............Y...",
         "..Y.............Y..", "...................", "YYY.............YYY", "...................",
         "..Y.............Y..", ".Y...............Y.", "Y.....Y..Y..Y.....Y", ".....Y...Y...Y.....",
         "....Y....Y....Y...."]


def team_pal(team):
    white = team == "w"
    return {"h": "#3A2414", "s": "#D9A07A", "T": "#FFFFFF" if white else "#2E2E2E",
            "k": "#1B1B1B" if white else "#FFFFFF", "b": "#111111" if white else "#555555",
            "G": "#E8A93A", "Y": "#FCE7A1", "K": "#111111", "W": "#F3EAD3"}


def rle_paths(maps, palette, offsets):
    by = {}
    for m, (ox, oy) in zip(maps, offsets):
        for y, line in enumerate(m):
            x = 0
            while x < len(line):
                c = line[x]
                if c in palette:
                    e = x
                    while e < len(line) and line[e] == c:
                        e += 1
                    by.setdefault(palette[c], []).append(f"M{ox + x} {oy + y}h{e - x}v1h-{e - x}z")
                    x = e
                else:
                    x += 1
    return "".join(f'<path d="{"".join(v)}" fill="{k}"/>' for k, v in by.items())


def sprite(m, scale, palette=None, name="", extra_style=""):
    palette = palette or team_pal("w")
    h, w = len(m), max(len(r) for r in m)
    m = [r.ljust(w, ".") for r in m]
    return (f'<svg layer-name="{name}" width="{w * scale}" height="{h * scale}" viewBox="0 0 {w} {h}" '
            f'style="flex-shrink:0;shape-rendering:crispEdges{extra_style}">{rle_paths([m], palette, [(0, 0)])}</svg>')


def squad(team, n=7, scale=2, name=""):
    w = 8 * n + (n - 1)
    return (f'<svg layer-name="{name}" width="{w * scale}" height="{12 * scale}" viewBox="0 0 {w} 12" '
            f'style="flex-shrink:0;shape-rendering:crispEdges">'
            f'{rle_paths([PLAYER] * n, team_pal(team), [(i * 9, 0) for i in range(n)])}</svg>')


# ---------- dígitos pixel próprios (grade 6x9, traço de 2, largura fixa) ----------
GLYPHS = {
    "0": [".####.", "##..##", "##..##", "##.###", "###.##", "##..##", "##..##", "##..##", ".####."],
    "1": ["..##..", ".###..", "####..", "..##..", "..##..", "..##..", "..##..", "..##..", "######"],
    "2": [".####.", "##..##", "....##", "....##", "..###.", ".##...", "##....", "##....", "######"],
    "3": ["#####.", "....##", "....##", "....##", ".####.", "....##", "....##", "....##", "#####."],
    "4": ["##..##", "##..##", "##..##", "##..##", "######", "....##", "....##", "....##", "....##"],
    "5": ["######", "##....", "##....", "#####.", "....##", "....##", "....##", "##..##", ".####."],
    "6": [".####.", "##....", "##....", "#####.", "##..##", "##..##", "##..##", "##..##", ".####."],
    "7": ["######", "....##", "....##", "...##.", "..##..", "..##..", "..##..", "..##..", "..##.."],
    "8": [".####.", "##..##", "##..##", "##..##", ".####.", "##..##", "##..##", "##..##", ".####."],
    "9": [".####.", "##..##", "##..##", "##..##", ".#####", "....##", "....##", "....##", ".####."],
    ",": ["..", "..", "..", "..", "..", "##", "##", ".#", "#."],
    "+": ["......", "......", "..##..", "..##..", "######", "######", "..##..", "..##..", "......"],
    "×": ["......", "......", "##..##", ".####.", "..##..", ".####.", "##..##", "......", "......"],
    "/": ["....##", "....##", "...##.", "...##.", "..##..", ".##...", ".##...", "##....", "##...."],
    " ": ["...", "...", "...", "...", "...", "...", "...", "...", "..."],
}


def pn(text, scale=3, color="var(--color-text)", name="", extra=""):
    """Número em pixel (grade 6x9, traço de 2). Altura = 9 x escala; escala inteira, nunca fração."""
    x, parts = 0, []
    for ch in str(text):
        g = GLYPHS[ch]
        w = len(g[0])
        for y, line in enumerate(g):
            run = 0
            while run < len(line):
                if line[run] == "#":
                    e = run
                    while e < len(line) and line[e] == "#":
                        e += 1
                    parts.append(f"M{x + run} {y}h{e - run}v1h-{e - run}z")
                    run = e
                else:
                    run += 1
        x += w + 1
    w = max(x - 1, 1)
    return (f'<svg layer-name="{name or "Número pixel"}" width="{w * scale}" height="{9 * scale}" viewBox="0 0 {w} 9" '
            f'style="flex-shrink:0;shape-rendering:crispEdges;color:{color}{";" + extra if extra else ""}">'
            f'<path d="{"".join(parts)}" fill="currentColor"/></svg>')


# ---------- peças ----------
CARD = "box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset"
FLOAT = "box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset, #000000 4px 4px 0px 0px"
PIX = ("font-family:Silkscreen;font-weight:700;text-transform:uppercase;white-space:nowrap;"
       "-webkit-font-smoothing:none;font-smooth:never")
NUMRE = re.compile(r"(\d+(?:,\d+)*)")


def t(text, size=16, color="var(--color-text)", weight=400, lh=None, extra=""):
    """Texto corrido em Chakra Petch: frases, explicações, mensagens e o que a pessoa digita nos campos."""
    lh = max(lh or round(size * 1.45), math.ceil(size * 1.4))
    if extra and "line-height" in extra:
        extra = re.sub(r"line-height:(\d+)px", lambda m: f"line-height:{max(int(m.group(1)), math.ceil(size * 1.4))}px", extra)
    return (f'<div style="font-family:Chakra Petch;font-size:{size}px;font-weight:{weight};line-height:{lh}px;'
            f'color:{color}{";" + extra if extra else ""}">{text}</div>')


def muted(text, size=13, extra=""):
    return t(text, size, "var(--color-text-muted)", extra=extra)


def pix(name, size=16, color="var(--color-text)", lh=None, extra=""):
    """Texto em pixel (Silkscreen, caixa alta). Só múltiplos de 8 (16, 24, 32...): é a grade da fonte.
    A Silkscreen não tem reticências: apelido tem até 10 letras e aparece inteiro, sem corte."""
    return (f'<div style="{PIX};font-size:{size}px;line-height:{lh or size + 4}px;color:{color}'
            f'{";" + extra if extra else ""}">{name}</div>')


def px(text, size=16, color="var(--color-text)", lh=None, extra="", wrap=False):
    """Texto de interface em pixel. Dígitos viram dígitos pixel (pn), nunca a fonte: 0 e O, 2 e Z não se confundem.
    wrap=True deixa o título quebrar em duas linhas."""
    parts = NUMRE.split(text)
    if len(parts) == 1:
        return pix(text, size, color, lh, ("white-space:normal;" if wrap else "") + extra)
    lh = lh or size + 4
    scale = max(size // 8, 2)
    items = ""
    for i, p in enumerate(parts):
        if not p:
            continue
        if i % 2:
            items += pn(p, scale, color)
        else:
            items += pix(p.replace(" ", "&nbsp;"), size, color, lh, "overflow:visible")
    return (f'<div style="display:flex;align-items:baseline;{"flex-wrap:wrap;" if wrap else ""}{extra}">{items}</div>')


def section(name, title, lede, body, gap=16):
    return (f'<div layer-name="{name}" style="display:flex;flex-direction:column;gap:{gap}px">'
            f'<div style="display:flex;flex-direction:column;gap:8px">'
            f'{px(title, 24, lh=36, wrap=True, extra="padding-top:4px")}'
            f'{t(lede, 16, "var(--color-text-muted)", lh=24, extra="max-width:340px")}</div>{body}</div>')


def key(label, h=56, flex="", icon="", name="Botão/Primário"):
    return (f'<div layer-name="{name}" style="{flex}display:flex;align-items:center;justify-content:center;gap:8px;'
            f'height:{h}px;background-color:var(--color-accent);'
            f'box-shadow:#000000 0px 0px 0px 3px inset, #000000 4px 4px 0px 0px">{icon}'
            f'{px(label, 16, "var(--color-on-accent)")}</div>')


def ghost(label, h=52, flex="", icon="", name="Botão/Contorno"):
    return (f'<div layer-name="{name}" style="{flex}display:flex;align-items:center;justify-content:center;gap:8px;'
            f'height:{h}px;{CARD}">{icon}{px(label, 16, "var(--color-text)")}</div>')


def avatar(initials, team="w", size=40, ring=None, bg_ring="var(--color-surface)"):
    fs = 24 if size >= 56 else 16
    if team == "w":
        bg, fg = "#FFFFFF", "#000000"
        sh = f"0px 0px 0px 2px {bg_ring}, 0px 0px 0px {3.5 if ring else 4}px {ring or '#FFFFFF'}"
    else:
        bg, fg = "#000000", "#FFFFFF"
        sh = (f"0px 0px 0px 2px {bg_ring}, 0px 0px 0px 3.5px {ring}" if ring else
              f"0px 0px 0px 2px {bg_ring}, 0px 0px 0px 4px #000000, 0px 0px 0px 5px rgb(255 255 255 / 35%)")
    return (f'<div style="width:{size}px;height:{size}px;flex-shrink:0;border-radius:999px;display:flex;'
            f'align-items:center;justify-content:center;background-color:{bg};box-shadow:{sh}">'
            f'{pix(initials, fs, fg, fs, "padding-left:2px")}</div>')


def svg_icon(d, size=20, color="#F3EAD3", sw=2, fill="none"):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="{fill}" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="square" stroke-linejoin="miter" style="flex-shrink:0">{d}</svg>')


STAR_PATH = '<path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z"/>'
STILTS = ('<path d="M5 2.5v19M15 2.5v19"/><path d="M5 9h2.6v3.6l2.6 1c.5.2.8.7.8 1.2v.7H5zM15 9h2.6v3.6l2.6 1'
          'c.5.2.8.7.8 1.2v.7H15z" fill="#B08D6A" stroke-width="1.4"/><path d="M7.6 9V5.5M17.6 9V5.5"/>')
CLOCK = '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/>'
CHECK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
PLUS = '<path d="M12 5v14M5 12h14"/>'
MINUS = '<path d="M5 12h14"/>'
CHEV_L = '<path d="M15 18l-6-6 6-6"/>'
CHEV_R = '<path d="M9 6l6 6-6 6"/>'
PENCIL = '<path d="M4 20h4L19 9l-4-4L4 16z"/>'
LOCK = '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
REDO = '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>'
TRASH = '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'
SHARE = '<path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5"/>'
URNA = '<path d="M4 13h16v7H4z"/><path d="M8 13V4h8v9"/><path d="M10.5 8.5l1.3 1.3 2.7-2.8"/>'
INVITE = '<rect x="3" y="5" width="18" height="14"/><path d="M3 6l9 7 9-7"/>'
XMARK = '<path d="M6 6l12 12M18 6L6 18"/>'
ERR = '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'
ALERT = '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.01"/>'
SPINNER = ('<svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0"><circle cx="12" cy="12" r="9" '
           'fill="none" stroke="rgb(17 17 17 / 20%)" stroke-width="3"/><path d="M12 3a9 9 0 0 1 9 9" fill="none" '
           'stroke="#111111" stroke-width="3"/></svg>')


def tri(up):
    path = '<path d="M12 5l8 12H4z"/>' if up else '<path d="M12 19L4 7h16z"/>'
    color = "#22C55E" if up else "#EF4444"
    return f'<svg width="12" height="12" viewBox="0 0 24 24" fill="{color}" style="flex-shrink:0">{path}</svg>'


# ---------- seções ----------
def hero():
    lines = ('<svg layer-name="Linhas de giz" width="390" height="460" viewBox="0 0 390 460" '
             'style="position:absolute;left:0px;top:0px">'
             '<line x1="0" y1="250" x2="390" y2="250" stroke="rgb(255 255 255 / 10%)" stroke-width="2"/>'
             '<circle cx="300" cy="250" r="96" fill="none" stroke="rgb(255 255 255 / 10%)" stroke-width="2"/>'
             '<rect x="296" y="246" width="8" height="8" fill="rgb(255 255 255 / 14%)"/>'
             '<rect x="-60" y="-40" width="170" height="110" fill="none" stroke="rgb(255 255 255 / 5%)" '
             'stroke-width="2"/></svg>')
    return (f'{lines}<div layer-name="Capa" style="position:relative;display:flex;flex-direction:column;gap:20px">'
            f'{pix("Design system v1.4", 16, "var(--color-gold)", 20)}'
            f'<div style="display:flex;flex-direction:column">{pix("Fut", 80, "var(--color-text)", 84)}'
            f'{pix("Stats", 80, "var(--color-text)", 84)}</div>'
            f'{t("Todo dia de pelada tem clássico. Branco contra Preto, nota pra todo mundo e um craque por rodada.", 18, lh=27, extra="max-width:320px")}'
            f'</div>')


def swatch(label, style, flex="flex:1"):
    return (f'<div style="{flex};display:flex;flex-direction:column;gap:6px"><div style="height:40px;{style}"></div>'
            f'{muted(label, 13)}</div>')


def cores():
    body = (
        f'<div layer-name="Times" style="display:flex;justify-content:space-between;align-items:flex-end;height:120px;'
        f'padding:16px;background-image:linear-gradient(112deg, #FFFFFF 0%, #FFFFFF 50%, #000000 50%, #000000 100%);'
        f'{FLOAT}">{pix("Branco", 24, "#000000", 28)}{pix("Preto", 24, "#FFFFFF", 28)}</div>'
        f'<div style="display:flex;gap:12px">'
        f'<div layer-name="Cor/Apito" style="flex:1;display:flex;flex-direction:column;justify-content:space-between;'
        f'height:104px;padding:14px;background-color:var(--color-accent);box-shadow:#000000 0px 0px 0px 3px inset, '
        f'#000000 4px 4px 0px 0px">{pix("Apito", 24, "var(--color-on-accent)", 28)}'
        f'{t("Ação, e a palavra VS. Sem brilho.", 13, "var(--color-on-accent)", 600, 18)}</div>'
        f'<div layer-name="Cor/Ouro" style="flex:1;display:flex;flex-direction:column;justify-content:space-between;'
        f'height:104px;padding:14px;background-image:linear-gradient(160deg, #2B2312 0%, #17140C 100%);'
        f'box-shadow:var(--color-gold) 0px 0px 0px 2px inset">{pix("Ouro", 24, "var(--color-gold)", 28)}'
        f'{t("Craque e líder.", 13, "#F2D9A8", 600, 18)}</div></div>'
        f'<div style="display:flex;gap:8px">'
        f'{swatch("Gramado", "background-color:var(--color-bg);box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset")}'
        f'{swatch("Nível 1", "background-color:var(--color-surface)")}'
        f'{swatch("Nível 2", "background-color:var(--color-surface-raised)")}'
        f'{swatch("Nível 3", "background-color:var(--color-surface-3)")}</div>'
        f'<div style="display:flex;gap:8px">'
        f'{swatch("Vitória", "background-color:var(--color-success)")}'
        f'{swatch("Derrota", "background-color:var(--color-danger)")}'
        f'{swatch("Prazo", "background-color:var(--color-warning)")}'
        f'{swatch("Madeira", "background-color:var(--color-flop)")}'
        f'{swatch("Contorno", "box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset")}</div>'
        f'{muted("Texto em creme (#F3EAD3). Branco puro só no time Branco.", 13, "line-height:18px")}'
    )
    return section("Cores", "Cores", "Os times são a identidade. Amarelo quer dizer toque aqui, com uma exceção: "
                   "a palavra VS. Ouro é mérito, madeira é zoeira. O fundo padrão é o verde Gramado.", body)


def fundo():
    def screen(label, sub, bg, surf, edge, light):
        return (f'<div layer-name="Fundo/{label}" style="flex:1;display:flex;flex-direction:column;gap:12px;'
                f'height:224px;padding:16px 12px;background-color:{bg};background-image:radial-gradient(160px 120px at '
                f'86px -20px, {light} 0px, transparent 120px);box-shadow:{edge} 0px 0px 0px 2px inset">'
                f'{pix("Fut Stats", 16, lh=20)}'
                f'<div style="display:flex;flex-direction:column;gap:6px;padding:12px;background-color:{surf};'
                f'box-shadow:{edge} 0px 0px 0px 2px inset">{px("Rodada 12", 16, "var(--color-text-muted)")}'
                f'{pn("4×3", 3)}</div>'
                f'<div style="display:flex;flex-direction:column;gap:2px">{pix(label, 16, lh=20)}{pix(sub, 16, "var(--color-text-muted)", 20)}</div></div>')
    body = (f'<div layer-name="Fundos" style="display:flex;gap:12px">'
            f'{screen("Gramado", "padrão", "var(--color-bg)", "var(--color-surface)", "var(--color-border-strong)", "var(--color-floodlight)")}'
            f'{screen("Noite", "opção", "var(--color-bg-night)", "var(--color-surface-night)", "var(--color-border-strong-night)", "var(--color-floodlight-night)")}'
            f'</div>'
            f'{muted("Tokens do Gramado: bg, surface, surface-raised, surface-3, border. Os da Noite têm o sufixo -night. Em Configurações, “Fundo: Gramado · Noite” troca só esses tokens.", 13, "line-height:18px")}')
    return section("Fundo e holofote", "Fundo e holofote", "O holofote é a luz do refletor no topo da tela. "
                   "O Gramado, verde-escuro, é o fundo padrão; a Noite, quase preta, é uma opção nas configurações.", body)


def tipografia():
    def row(sample, label):
        return (f'<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">{sample}'
                f'{muted(label, 13, "white-space:nowrap;text-align:right")}</div>')
    body = (
        row(pn("4×3", 8), "Placar · número ×8 = 72")
        + row(px("Ranking geral", 24, lh=28), "Título 24")
        + row(px("Votação aberta", 16), "Card, botão, aba 16")
        + row(pix("Zagueirão", 16), "Nome 16 · 24")
        + row(pn("8,4 9,0", 4, "var(--color-gold)"), "Número ×4 = 36")
        + row(t("Dê sua nota até as 22h.", 16, lh=24), "Texto corrido 16")
        + row(t("12 jogos, 7 vitórias", 13, "var(--color-text-muted)", 500, 18), "Legenda 13")
        + f'<div layer-name="Regra das fontes" style="display:flex;flex-direction:column;gap:8px;padding:16px;{CARD}">'
        + t("<b>Pixel</b> = interface: títulos, botões, abas, selos, nomes e números. "
            "<b>Chakra Petch</b> = texto corrido e campos.", 14, lh=21)
        + muted("Pixel é Silkscreen em 16, 24 ou 32px, caixa alta, e dígitos pixel para todo número. "
                "Chakra Petch vale para frases de mais de uma linha, explicações, mensagens de erro e o texto digitado nos campos. "
                "A Barlow Condensed saiu da interface. Apelido tem até 10 letras: aparece inteiro em todo lugar. Em pixel não se abrevia (datas e horas são a exceção).", 13, "line-height:19px")
        + '</div>'
    )
    return section("Tipografia", "Tipografia", "Pixel é a voz do app: tudo que é rótulo, nome e número. "
                   "Chakra Petch só entra quando é para ler uma frase.", body)


def pixel_legivel():
    def cmp(label, left, right, note):
        return (f'<div style="display:flex;flex-direction:column;gap:8px;padding:14px 16px;{CARD}">'
                f'{px(label, 16)}'
                f'<div style="display:flex;flex-direction:column;gap:10px">{left}{right}</div>{muted(note, 13, "line-height:18px")}</div>')
    old = lambda txt, size: (f'<div style="font-family:Silkscreen;font-weight:700;font-size:{size}px;line-height:{size + 6}px;'
                             f'color:var(--color-text-muted);white-space:nowrap">{txt}</div>')
    tag = lambda txt: muted(txt, 13)
    body = (
        cmp("Números", f'<div style="display:flex;flex-direction:column;gap:4px">{tag("Proibido: fora da grade · Silkscreen 20px")}{old("0 4 9 · 8,4 · 2Z 0O", 20)}</div>',
            f'<div style="display:flex;flex-direction:column;gap:4px">{tag("Certo · dígitos pixel ×3")}'
            f'<div style="display:flex;align-items:center;gap:10px">{pn("0123456789", 3)}</div>'
            f'<div style="display:flex;align-items:center;gap:12px">{pn("8,4", 3, "var(--color-gold)")}{pn("2", 3)}'
            f'{pix("Z", 24, lh=24)}{pn("0", 3)}{pix("O", 24, lh=24)}</div></div>',
            "O 4 vira aberto, o 0 ganha um risco no meio, o 2 tem topo curvo e base reta (não é Z), a vírgula é estreita, o traço tem 2 pixels e todo algarismo tem a mesma largura.")
        + cmp("Nomes", f'<div style="display:flex;flex-direction:column;gap:4px">{tag("Proibido: fora da grade · 14px")}{old("Zagueirão", 14).replace("text-transform:uppercase;", "")}</div>',
              f'<div style="display:flex;flex-direction:column;gap:4px">{tag("Certo · 16px, na grade")}{pix("Zagueirão", 16)}</div>',
              "Na grade, cada pixel da fonte vira 2 pixels da tela, sem borrar.")
        + f'<div layer-name="Regra de tamanhos" style="display:flex;flex-direction:column;gap:8px;padding:16px;{CARD}">'
        + px("Tamanhos permitidos", 16)
        + muted("Texto: Silkscreen em 16, 24 ou 32px (múltiplos de 8). Nunca 13, 14, 20 ou 26.", 13, "line-height:19px")
        + muted("Número: dígitos pixel em escala inteira. Grade 6×9 com traço de 2 pixels; altura = 9 × escala: 18, 27, 36 ... 90px. Nunca fração. Número dentro de um rótulo (“Fecha em 2h”) também vira dígito pixel, na escala 2.", 13, "line-height:19px")
        + muted("Apelido tem até 10 letras: aparece inteiro em todo lugar. “RONALDINHO” ocupa uns 136px em 16px, então listas e vagas do campo foram feitas para isso.", 13, "line-height:19px")
        + muted("Em pixel não se abrevia: “RODADA 12”, “ZAGUEIRO”, “MINUTOS”. A exceção são datas e horas no formato do app (“SÁB, 24 OUT · 9H”). Iniciais do avatar = 2 primeiras letras do apelido.", 13, "line-height:19px")
        + muted("Testadas e descartadas: Press Start 2P (sem Ã e acentos) e Jersey 10 e Tiny5 (0 e O iguais, 2 e Z parecidos).", 13, "line-height:19px")
        + '</div>'
    )
    return section("Pixel legível", "Pixel legível", "Texto em Silkscreen, número em dígitos próprios. "
                   "Fonte pixel só fica nítida quando o tamanho respeita a grade dela.", body)


def forma():
    def shape(label, style):
        return (f'<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px">'
                f'<div style="width:56px;height:56px;{style}"></div>{muted(label, 13)}</div>')

    def level(h, bg, title, sub, shadow):
        return (f'<div style="flex:1;height:{h}px;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;'
                f'padding:12px;background-color:{bg};box-shadow:{shadow}">{t(title, 14, weight=600, lh=18)}'
                f'{muted(sub, 13)}</div>')
    rows = [("Movimento", "rápido 150 · normal 250 · grande momento 400 ms"),
            ("Curva", "sai rápido, freia no fim (ease-out); pixel anda em degraus"),
            ("Camadas", "nav 10 · gaveta 20 · aviso 30 · arrasto 40"),
            ("Sem movimento", "vira só fade")]
    table = "".join(
        f'<div style="display:flex;flex-direction:column;gap:4px;padding:12px 16px;'
        f'{"box-shadow:var(--color-border) 0px 2px 0px 0px inset" if i else ""}">{px(a, 16)}'
        f'{muted(b, 13)}</div>' for i, (a, b) in enumerate(rows))
    body = (
        f'<div style="display:flex;gap:10px;align-items:flex-end">'
        f'{shape("Selos", "background-color:var(--color-surface-raised);" + CARD)}'
        f'{shape("Botões", "background-color:var(--color-accent);box-shadow:#000000 0px 0px 0px 3px inset, #000000 4px 4px 0px 0px")}'
        f'{shape("Cards", "background-color:var(--color-surface-raised);" + CARD)}'
        f'{shape("Avatar", "border-radius:999px;background-color:var(--color-surface-raised);" + CARD)}</div>'
        f'<div style="display:flex;gap:12px;align-items:flex-end">'
        f'{level(84, "var(--color-surface)", "Nível 1", "Listas: contorno", "var(--color-border-strong) 0px 0px 0px 2px inset")}'
        f'{level(100, "var(--color-surface-raised)", "Nível 2", "Cards: contorno", "var(--color-border-strong) 0px 0px 0px 2px inset")}'
        f'{level(116, "var(--color-surface-3)", "Nível 3", "Flutua: sombra", "var(--color-border-strong) 0px 0px 0px 2px inset, #000000 4px 4px 0px 0px")}'
        f'</div>'
        f'<div layer-name="Movimento e camadas" style="display:flex;flex-direction:column;background-color:var(--color-surface);'
        f'{CARD}">{table}</div>'
        f'{muted("Exceção: a barra de abas é redonda (veja Navegação).", 13)}'
    )
    return section("Forma e profundidade", "Forma e profundidade", "Canto reto, contorno duro e sombra sólida, "
                   "como tecla de fliperama. Só avatar, ponto e bolinha do slider são redondos.", body, 20)


def botoes():
    def state(label, extra_style, cap):
        return (f'<div style="flex:1;display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;'
                f'justify-content:center;height:48px;{extra_style}">{px(label, 16, "var(--color-on-accent)")}</div>'
                f'{muted(cap, 13, "text-align:center")}</div>')
    body = (
        key("Confirmar presença")
        + '<div style="display:flex;gap:12px">'
        + state("Confirmar", "background-color:var(--color-accent-pressed);transform:translate(4px, 4px);"
                "box-shadow:#000000 0px 0px 0px 3px inset", "Pressionado")
        + state("Confirmar", "background-color:var(--color-accent);box-shadow:#000000 0px 0px 0px 3px inset, "
                "var(--color-bg) 0px 0px 0px 2px, var(--color-text) 0px 0px 0px 4px", "Foco")
        + '</div>'
        + f'<div style="display:flex;flex-direction:column;gap:8px">{key("Salvando", 48, icon=SPINNER, name="Botão/Carregando")}'
        f'{muted("Carregando", 13, "text-align:center")}</div>'
        + '<div style="display:flex;gap:12px">'
        + f'<div layer-name="Botão/Secundário" style="flex:1;display:flex;align-items:center;justify-content:center;height:52px;'
        f'background-color:var(--color-surface-raised);{FLOAT}">{px("Ver times", 16)}</div>'
        + ghost("Sortear", flex="flex:1;", icon=svg_icon(REDO, 18))
        + '</div><div style="display:flex;gap:12px">'
        + f'<div layer-name="Botão/Desabilitado" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;'
        f'height:52px;background-color:var(--color-surface)">{svg_icon(LOCK, 16, "#9DB0A2")}'
        f'{px("Fechada", 16, "var(--color-disabled)")}</div>'
        + f'<div layer-name="Botão/Perigo" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;'
        f'height:52px;background-color:rgb(239 68 68 / 14%);box-shadow:var(--color-danger) 0px 0px 0px 2px inset">'
        f'{svg_icon(TRASH, 18, "#F87171")}{px("Remover", 16, "#FCA5A5")}</div></div>'
        + '<div style="display:flex;align-items:center;gap:12px">'
        + "".join(f'<div layer-name="Botão/Ícone" style="width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;'
                  f'justify-content:center;background-color:var(--color-surface-raised);{FLOAT}">{svg_icon(d, 20)}</div>'
                  for d in (CHEV_L, SHARE))
        + muted("Botão de ícone: 44 × 44, sempre com nome para leitor de tela.", 13, "line-height:18px")
        + '</div>'
    )
    return section("Botões", "Botões", "Um amarelo por tela. Ele é a ação que importa e afunda como tecla "
                   "quando você aperta. O rótulo é sempre em pixel.", body)


def badge(label, fg, bg, edge, icon="", name="Selo"):
    return (f'<div layer-name="{name}" style="display:flex;align-items:center;gap:6px;height:32px;padding:0px 12px;'
            f'background-color:{bg};box-shadow:{edge} 0px 0px 0px 2px inset">{icon}{px(label, 16, fg)}</div>')


def selos():
    star = svg_icon(STAR_PATH, 13, "none", 0, "#E8A93A")
    cap = lambda txt: pix(txt, 16, "var(--color-text-muted)", 20)
    body = (
        '<div style="display:flex;flex-wrap:wrap;gap:8px">'
        + badge("BRANCO", "#000000", "#FFFFFF", "#FFFFFF", name="Selo/Branco")
        + badge("PRETO", "#FFFFFF", "#000000", "rgb(255 255 255 / 35%)", name="Selo/Preto")
        + badge("CRAQUE", "var(--color-gold)", "rgb(232 169 58 / 14%)", "var(--color-gold)", star, name="Selo/Craque")
        + badge("PERNA DE PAU", "var(--color-flop)", "rgb(196 160 124 / 14%)", "var(--color-flop)",
                svg_icon(STILTS, 16, "#C4A07C"), name="Selo/Perna de Pau")
        + badge("Zagueiro", "var(--color-text)", "transparent", "var(--color-border-strong)", name="Selo/Posição")
        + badge("Fecha em 2h", "var(--color-text)", "transparent", "var(--color-border-strong)",
                svg_icon(CLOCK, 13, "#FB923C", 2.4), "Selo/Prazo")
        + '</div>'
        + '<div layer-name="Avatares" style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;padding:8px 4px 0px">'
        + f'<div style="display:flex;flex-direction:column;align-items:center;gap:8px">{avatar("RO", "w", 56, bg_ring="var(--color-bg)")}{muted("56", 13)}</div>'
        + f'<div style="display:flex;flex-direction:column;align-items:center;gap:8px">{avatar("ZA", "b", 40, bg_ring="var(--color-bg)")}{muted("40", 13)}</div>'
        + f'<div style="display:flex;flex-direction:column;align-items:center;gap:8px">{avatar("MA", "w", 32, bg_ring="var(--color-bg)")}{muted("32", 13)}</div>'
        + f'<div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="position:relative;width:48px;height:48px">'
        f'{avatar("DI", "w", 40, bg_ring="var(--color-bg)")}<div layer-name="Selo/Goleiro" style="position:absolute;left:28px;top:28px;width:20px;'
        f'height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;background-color:var(--color-text);'
        f'box-shadow:var(--color-bg) 0px 0px 0px 2px">{pix("G", 16, "#000000", 16, "padding-left:1px")}'
        f'</div></div>{cap("Goleiro")}</div>'
        + f'<div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="display:flex;gap:4px">'
        f'{avatar("RO", "w", 32, bg_ring="var(--color-bg)")}{avatar("ZA", "b", 32, bg_ring="var(--color-bg)")}'
        f'<div style="width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;'
        f'background-color:var(--color-surface-raised)">{pn("+9", 2)}</div></div>{cap("Grupo")}</div>'
        + '</div>'
        + muted("Para quem não enxerga cor, o avatar sempre vem com o nome do time escrito por perto. Iniciais = 2 primeiras letras do apelido.", 13, "line-height:18px")
        + f'<div layer-name="Elenco da folha" style="display:flex;flex-direction:column;gap:6px;padding:16px;{CARD}">'
        + px("Elenco da folha", 16)
        + muted("O mesmo elenco aparece em toda a folha. Branco: Ronaldinho (RO, meia, craque da rodada 12, nota 9,1), Marcão (MA, atacante), Beto (BE, zagueiro) e Diogo (DI, goleiro). Preto: Zagueirão (ZA, zagueiro) e Lucão (LU, ala). No banco: Pedrinho (PE) e Juninho (JU).", 13, "line-height:19px")
        + '</div>'
    )
    return section("Selos e avatares", "Selos e avatares", "O anel do avatar diz o time. Prêmio é ouro, zoeira é "
                   "madeira. Nenhum brilha.", body)


def presenca():
    bars = "".join(f'<div style="flex:1;height:6px;background-color:{"var(--color-success)" if i < 12 else "var(--color-track)"}"></div>'
                   for i in range(14))
    body = (
        f'<div layer-name="Card/Presença" style="display:flex;flex-direction:column;gap:16px;padding:20px;'
        f'background-color:var(--color-surface-raised);{CARD}">'
        f'<div style="display:flex;flex-direction:column;gap:6px">{px("Sáb, 24 out · 9h", 16)}'
        f'{pix("Arena do Bairro", 16, "var(--color-text-muted)", 20)}</div>'
        f'<div layer-name="Segmentado/Presença" style="display:flex;flex-direction:column;padding:4px;gap:4px;background-color:var(--color-bg)">'
        f'<div style="display:flex;align-items:center;justify-content:center;gap:12px;height:64px;'
        f'background-color:var(--color-success);box-shadow:#000000 0px 0px 0px 2px inset">{svg_icon(CHECK, 24, "#04210F", 3)}'
        f'{px("Confirmar", 24, "#04210F")}</div>'
        f'<div style="display:flex;align-items:center;justify-content:center;gap:12px;height:64px;'
        f'box-shadow:var(--color-danger) 0px 0px 0px 2px inset">'
        f'{svg_icon(XMARK, 24, "#F87171", 3)}{px("Ausência", 24, "#F87171")}</div></div>'
        f'<div style="display:flex;flex-direction:column;gap:8px">{px("12 de 14 confirmados", 16)}'
        f'<div style="display:flex;gap:3px">{bars}</div>'
        f'{px("Faltam 2", 16, "var(--color-text-muted)")}</div></div>'
        f'<div style="display:flex;flex-direction:column;gap:8px">{px("Apelido", 16)}'
        f'<div layer-name="Campo/Foco" style="display:flex;align-items:center;height:52px;padding:0px 16px;'
        f'background-color:var(--color-surface);box-shadow:var(--color-text) 0px 0px 0px 2px inset, '
        f'rgb(243 234 211 / 14%) 0px 0px 0px 4px">{t("Zagueirão", 16, lh=20)}'
        f'<div style="width:2px;height:20px;background-color:var(--color-accent)"></div></div>'
        f'{muted("É assim que o grupo te vê no ranking. Até 10 letras.", 13)}</div>'
        f'<div style="display:flex;flex-direction:column;gap:8px">{px("Apelido", 16)}'
        f'<div layer-name="Campo/Erro" style="display:flex;align-items:center;justify-content:space-between;height:52px;'
        f'padding:0px 16px;background-color:var(--color-surface);box-shadow:var(--color-danger) 0px 0px 0px 2px inset">'
        f'{t("Ronaldinho", 16, lh=20)}{svg_icon(ERR, 20, "#F87171", 2.2)}</div>'
        f'{t("Esse apelido já está em uso no grupo.", 13, "#FCA5A5", lh=18)}</div>'
    )
    return section("Presença e campos", "Presença e campos", "Responder se vai tem que levar um toque. "
                   "Escrever, só quando precisa. O que a pessoa digita fica em Chakra Petch.", body)


def classico():
    body = (
        f'<div layer-name="Card/Partida" style="display:flex;flex-direction:column;background-color:var(--color-surface);{CARD}">'
        f'<div style="display:flex;flex-direction:column;gap:8px;padding:16px 20px 20px;'
        f'background-image:linear-gradient(112deg, #FFFFFF 0%, #FFFFFF 50%, #000000 50%, #000000 100%)">'
        f'<div style="display:flex;justify-content:space-between;align-items:center">{px("Rodada 12", 16, "#3A3F3B")}'
        f'{px("18 out", 16, "#B8BCB9")}</div>'
        f'<div style="display:flex;justify-content:space-between;align-items:flex-end">'
        f'<div style="display:flex;align-items:flex-end;gap:12px">{pn("4", 12, "#000000")}'
        f'<div style="display:flex;align-items:center;gap:4px;height:28px;padding:0px 8px;background-color:var(--color-success)">'
        f'{svg_icon(CHECK, 14, "#04210F", 3)}{px("Venceu", 16, "#04210F")}</div></div>'
        f'{pn("3", 12, "#FFFFFF")}</div>'
        f'<div style="display:flex;justify-content:space-between;align-items:center">{pix("Branco", 16, "#000000", 20)}'
        f'{pix("Preto", 16, "#FFFFFF", 20)}</div></div>'
        f'<div layer-name="Linha do Craque" style="display:flex;align-items:center;gap:12px;padding:14px 20px">'
        f'{avatar("RO", "w", 40, "var(--color-gold)")}'
        f'<div style="flex:1;min-width:0px;display:flex;flex-direction:column;gap:4px">'
        f'<div style="display:flex;align-items:center;gap:6px">{svg_icon(STAR_PATH, 14, "none", 0, "#E8A93A")}'
        f'{pix("Craque", 16, "var(--color-gold)", 20)}</div>{pix("Ronaldinho", 16)}</div>'
        f'{pn("9,1", 3, "var(--color-gold)")}</div></div>'
        f'{muted("Apelido tem até 10 letras: aparece inteiro em todo lugar. O placar usa dígitos pixel grandes (escala 12).", 13, "line-height:18px")}'
    )
    return section("O clássico", "O clássico", "Primeira assinatura. O corte diagonal só existe no placar.", body)


def slot(center, top, inner, label, label_color="var(--color-text)", player=False):
    label_html = (pix(label, 16, "var(--color-text)", 20, "text-align:center") if player
                  else px(label, 16, label_color, 20, "justify-content:center"))
    return (f'<div style="position:absolute;left:{center - 68}px;top:{top}px;width:136px;display:flex;flex-direction:column;'
            f'align-items:center;gap:6px">{inner}{label_html}</div>')


def campo():
    field_av = lambda i: avatar(i, "w", 44, bg_ring="var(--color-field)")
    w = "rgb(255 255 255 / 30%)"
    lines = ('<svg layer-name="Linhas" width="358" height="480" viewBox="0 0 358 480" style="position:absolute;left:0px;top:0px">'
             f'<rect x="14" y="14" width="330" height="452" fill="none" stroke="{w}" stroke-width="2"/>'
             f'<path d="M119 14a60 60 0 0 0 120 0" fill="none" stroke="{w}" stroke-width="2"/>'
             f'<rect x="99" y="392" width="160" height="74" fill="none" stroke="{w}" stroke-width="2"/>'
             f'<rect x="139" y="438" width="80" height="28" fill="none" stroke="{w}" stroke-width="2"/></svg>')
    target = (f'<div style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;'
              f'box-shadow:var(--color-accent) 0px 0px 0px 2px inset, rgb(250 204 21 / 14%) 0px 0px 0px 6px">'
              f'{svg_icon(PLUS, 18, "#FACC15", 2.4)}</div>')
    free = (f'<div style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;'
            f'box-shadow:rgb(255 255 255 / 35%) 0px 0px 0px 2px inset">{svg_icon(PLUS, 16, "#CFCAB5", 2.2)}</div>')
    chip = lambda ini, name, sel: (
        f'<div layer-name="Chip/{"Selecionado" if sel else "Banco"}" style="display:flex;align-items:center;gap:6px;min-height:52px;'
        f'padding:4px 10px 4px 6px;background-color:{"var(--color-surface-3)" if sel else "var(--color-surface-raised)"};'
        f'box-shadow:{"var(--color-text) 0px 0px 0px 3px inset" if sel else "none"}">'
        f'<div style="width:40px;height:40px;flex-shrink:0;border-radius:999px;display:flex;align-items:center;justify-content:center;'
        f'background-color:var(--color-surface-3);box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset">'
        f'{pix(ini, 16, "var(--color-text)", 16, "padding-left:2px")}</div>'
        f'<div style="display:flex;flex-direction:column">{pix(name, 16, lh=20)}'
        f'{pix("Selecionado", 16, "var(--color-text-muted)", 20) if sel else ""}</div></div>')
    body = (
        f'<div layer-name="Segmentado/Time" style="display:flex;padding:4px;gap:4px;background-color:var(--color-surface);{CARD}">'
        f'<div style="flex:1;display:flex;align-items:center;justify-content:center;height:44px;background-color:#FFFFFF">'
        f'{pix("Branco", 16, "#000000")}</div>'
        f'<div style="flex:1;display:flex;align-items:center;justify-content:center;height:44px">'
        f'{pix("Preto", 16, "var(--color-text-muted)")}</div></div>'
        f'<div layer-name="Equilíbrio" style="display:flex;flex-direction:column;gap:10px;padding:16px;'
        f'background-color:var(--color-surface);{CARD}">'
        f'<div style="display:flex;justify-content:space-between;align-items:center">'
        f'<div style="display:flex;align-items:center;gap:8px">{pix("Branco", 16)}{pn("7,4", 3)}</div>'
        f'<div style="display:flex;align-items:center;gap:8px">{pn("7,3", 3)}{pix("Preto", 16)}</div></div>'
        f'<div style="display:flex;height:8px;box-shadow:rgb(255 255 255 / 25%) 0px 0px 0px 1px">'
        f'<div style="width:51%;background-color:#FFFFFF"></div><div style="width:49%;background-color:#000000"></div></div>'
        f'<div style="display:flex;align-items:center;gap:6px">{svg_icon(CHECK, 14, "#22C55E", 2.6)}'
        f'{muted("Equilibrado. Diferença de 0,1.", 13)}</div></div>'
        f'<div layer-name="Campo" style="position:relative;height:480px;overflow:hidden;'
        f'background-image:linear-gradient(180deg, #1F5A33 0%, #1B4F2D 100%);box-shadow:#000000 0px 0px 0px 3px inset, #000000 4px 4px 0px 0px">{lines}'
        f'{slot(179, 30, field_av("MA"), "Marcão", player=True)}'
        f'{slot(66, 160, free, "Ala", "var(--color-text)")}{slot(276, 160, target, "Toque aqui", "var(--color-accent)")}'
        f'{slot(179, 196, field_av("RO"), "Ronaldinho", player=True)}'
        f'{slot(100, 296, field_av("BE"), "Beto", player=True)}{slot(258, 296, free, "Zagueiro", "var(--color-text)")}'
        f'{slot(179, 392, field_av("DI"), "Diogo", player=True)}</div>'
        f'<div layer-name="Banco" style="display:flex;flex-direction:column;gap:10px;padding:16px;'
        f'background-color:var(--color-surface);{CARD}">'
        f'<div style="display:flex;justify-content:space-between;align-items:center">{px("Banco", 16)}'
        f'{px("2 sem time", 16, "var(--color-text-muted)")}</div>'
        f'<div style="display:flex;flex-wrap:wrap;gap:8px">{chip("PE", "Pedrinho", True)}{chip("JU", "Juninho", False)}</div>'
        f'{muted("Pedrinho selecionado. Toque numa vaga livre, ou num jogador do campo para trocar.", 13, "line-height:18px")}</div>'
        f'<div layer-name="Aviso/Desfazer" style="display:flex;align-items:center;gap:12px;height:56px;padding:0px 8px 0px 16px;'
        f'background-color:var(--color-surface-3);{FLOAT}"><div style="flex:1">{t("Pedrinho foi para a ala", 16, weight=600, lh=20)}</div>'
        f'<div style="display:flex;align-items:center;height:44px;padding:0px 8px">{px("Desfazer", 16, "var(--color-accent)")}</div></div>'
        f'{muted("Apelido tem até 10 letras: aparece inteiro em todo lugar. Só a vaga livre da vez é amarela: o campo tem um amarelo só. As vagas têm 136px de largura e, na linha de três, o jogador do meio fica mais atrás, para os nomes não se encostarem. O campo encolhe com a tela até 320px. Para os jogadores, a mesma peça vira a tela de times publicados, só para ver.", 13, "line-height:18px")}'
    )
    return section("O campo 1-2-3-1", "O campo 1-2-3-1", "Segunda assinatura. Toque no jogador e depois na vaga. "
                   "Arrastar é só um atalho.", body)


def figurinhas():
    def card(ini, name, pos, nota, craque):
        top_bg = "linear-gradient(180deg, #FFFFFF 0%, #D9DDD9 100%)" if craque else "linear-gradient(180deg, #000000 0%, #141A16 100%)"
        ini_color = "#000000" if craque else "#FFFFFF"
        badge_html = (f'<div style="position:absolute;left:8px;top:8px;display:flex;align-items:center;gap:4px;height:28px;'
                      f'padding:0px 8px;background-color:#17140C;box-shadow:var(--color-gold) 0px 0px 0px 2px inset">'
                      f'{svg_icon(STAR_PATH, 10, "none", 0, "#E8A93A")}{pix("Craque", 16, "var(--color-gold)", 20)}'
                      f'</div>') if craque else ""
        frame = ("padding:4px;background-image:linear-gradient(135deg, #E8A93A 0%, #FFF1C9 24%, #8CF0D8 46%, #E7A8FF 68%, "
                 "#E8A93A 100%);transform:rotate(-4deg);box-shadow:#000000 4px 4px 0px 0px") if craque else \
                f"padding:4px;background-color:var(--color-border);box-shadow:#000000 4px 4px 0px 0px"
        return (f'<div layer-name="Figurinha/{"Craque" if craque else "Jogador"}" style="flex:1;{frame}">'
                f'<div style="display:flex;flex-direction:column;background-color:#141A16">'
                f'<div style="position:relative;display:flex;align-items:center;justify-content:center;height:132px;'
                f'background-image:{top_bg}">{pix(ini, 64, ini_color, 64, "padding-left:4px")}'
                f'{badge_html}</div><div style="display:flex;flex-direction:column;'
                f'padding:10px 8px 12px;gap:4px"><div style="min-width:0px">{pix(name, 16)}</div>'
                f'{pix(pos, 16, "var(--color-text-muted)", 20)}'
                f'<div style="padding-top:2px">{pn(nota, 4, "var(--color-gold)" if craque else "var(--color-text)")}</div></div></div></div>')
    body = (f'<div style="display:flex;gap:12px;align-items:center;padding:12px 4px 20px">'
            f'{card("RO", "Ronaldinho", "Meia", "9,1", True)}{card("ZA", "Zagueirão", "Zagueiro", "7,9", False)}</div>')
    return section("Figurinhas", "Figurinhas", "Todo jogador vira figurinha. A do craque é holográfica e só ela "
                   "pode ficar inclinada.", body)


def dar_nota():
    stepper_key = lambda d, label: (
        f'<div layer-name="Stepper/{label}" style="width:56px;height:56px;flex-shrink:0;display:flex;align-items:center;'
        f'justify-content:center;background-color:var(--color-surface-3);{FLOAT}">{svg_icon(d, 22, "#F3EAD3", 2.6)}</div>')
    review_row = lambda name, n, first: (
        f'<div style="display:flex;align-items:center;gap:12px;height:52px;'
        f'{"" if first else "box-shadow:var(--color-border) 0px 2px 0px 0px inset"}">'
        f'<div style="flex:1;min-width:0px">{pix(name, 16)}</div>{pn(n, 3)}{svg_icon(PENCIL, 18, "#CFCAB5")}</div>')
    nota = (
        f'<div layer-name="Card/Nota" style="display:flex;flex-direction:column;gap:20px;padding:20px;'
        f'background-color:var(--color-surface-raised);{CARD}">'
        f'<div style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;align-items:center">'
        f'<div style="display:flex;align-items:center;gap:4px;height:44px">{svg_icon(CHEV_L, 18, "#F3EAD3", 2.2)}'
        f'{px("Anterior", 16)}</div><div style="display:flex;align-items:baseline;gap:6px">{pn("3", 3)}'
        f'{pix("de", 16, "var(--color-text-muted)", 20)}{pn("13", 3, "var(--color-text-muted)")}</div></div>'
        f'<div style="display:flex;height:4px;background-color:var(--color-track)"><div style="width:23%;background-color:var(--color-text)"></div></div></div>'
        f'<div style="display:flex;align-items:center;gap:12px">{avatar("ZA", "b", 44, bg_ring="var(--color-surface-raised)")}'
        f'<div style="flex:1;min-width:0px;display:flex;flex-direction:column;gap:4px">{pix("Zagueirão", 16, lh=20)}'
        f'{pix("Zagueiro · Preto", 16, "var(--color-text-muted)", 20)}</div></div>'
        f'<div style="display:flex;align-items:center;justify-content:space-between">{stepper_key(MINUS, "Menos")}'
        f'<div style="display:flex;flex-direction:column;align-items:center;gap:8px">{pn("7,5", 10)}'
        f'{px("Segurou a zaga", 16, "var(--color-text-muted)")}</div>{stepper_key(PLUS, "Mais")}</div>'
        f'<div style="display:flex;flex-direction:column;gap:8px"><div style="position:relative;height:44px;display:flex;align-items:center">'
        f'<div style="width:100%;height:8px;background-color:var(--color-track)"></div><div style="position:absolute;left:0px;top:18px;'
        f'width:75%;height:8px;background-color:var(--color-accent)"></div><div style="position:absolute;left:220px;top:4px;'
        f'width:36px;height:36px;border-radius:999px;background-color:#FFFFFF;box-shadow:var(--color-accent) 0px 0px 0px 5px, '
        f'#000000 3px 3px 0px 5px"></div></div><div style="display:flex;justify-content:space-between;padding:0px 2px">'
        f'{pn("0", 2, "var(--color-text-muted)")}{pn("5", 2, "var(--color-text-muted)")}{pn("10", 2, "var(--color-text-muted)")}</div></div>'
        f'<div style="display:flex;align-items:center;justify-content:center;gap:6px">{svg_icon(LOCK, 14, "#CFCAB5")}'
        f'{muted("Seu voto é anônimo. Só a média aparece.", 13)}</div>{key("Próximo jogador")}</div>'
        f'{muted("Nota é para todos: não dá para pular jogador. Quem joga dá nota a todos, menos a si.", 13, "line-height:18px")}'
    )
    revisao = (
        f'<div layer-name="Card/Revisão" style="display:flex;flex-direction:column;gap:12px;padding:20px;'
        f'background-color:var(--color-surface-raised);{CARD}">{px("Revise antes de enviar", 16)}'
        f'<div style="display:flex;flex-direction:column">{review_row("Ronaldinho", "9,0", True)}'
        f'{review_row("Marcão", "6,5", False)}{review_row("Zagueirão", "7,5", False)}</div>'
        f'{key("Continuar para o voto")}</div>'
    )

    def vrow(ini, team, name, teamname, prize=None, state="idle"):
        """Linha de 56px da lista de voto. state: idle | picked | blocked. O time vem por escrito à direita."""
        pc = {"gold": "var(--color-gold)", "flop": "var(--color-flop)"}.get(prize)
        second = ""
        if state == "picked":
            edge = f"{pc} 0px 0px 0px 3px inset"
            seal_icon = svg_icon(STAR_PATH, 14, "none", 0, "#111111") if prize == "gold" else svg_icon(STILTS, 16, "#111111", 2)
            second = (f'<div style="align-self:flex-start;display:flex;align-items:center;gap:4px;height:24px;padding:0px 6px;'
                      f'background-color:{pc}">{seal_icon}{pix("Escolhido", 16, "#111111", 20)}</div>')
            name_color = "var(--color-text)"
        elif state == "blocked":
            edge = "var(--color-border) 0px 0px 0px 2px inset"
            second = (f'<div style="display:flex;align-items:center;gap:4px">{svg_icon(STAR_PATH, 12, "none", 0, "#E8A93A")}'
                      f'{t("Já é seu craque", 13, "var(--color-disabled)", 600, 16, "white-space:nowrap")}</div>')
            name_color = "var(--color-disabled)"
        else:
            edge = "var(--color-border-strong) 0px 0px 0px 2px inset"
            name_color = "var(--color-text)"
        ring = pc if state == "picked" else None
        return (f'<div layer-name="Linha/{name}" style="display:flex;align-items:center;gap:10px;min-height:56px;padding:0px 8px 0px 6px;'
                f'background-color:var(--color-surface);box-shadow:{edge}">{avatar(ini, team, 40, ring, "var(--color-surface)")}'
                f'<div style="flex:1;min-width:0px;display:flex;flex-direction:column;gap:2px">{pix(name, 16, name_color, 20)}'
                f'{second}</div>{pix(teamname, 16, "var(--color-text-muted)", 20)}</div>')

    def vote_step(step, prize, title, ask, rows, more_label, send_label):
        pc = "var(--color-gold)" if prize == "gold" else "var(--color-flop)"
        icon = svg_icon(STAR_PATH, 26, "none", 0, "#E8A93A") if prize == "gold" else svg_icon(STILTS, 28, "#C4A07C")
        segs = "".join(f'<div style="flex:1;height:6px;background-color:{"var(--color-text)" if i < step else "var(--color-track)"}"></div>'
                       for i in range(2))
        return (
            f'<div layer-name="Card/Voto passo {step}" style="display:flex;flex-direction:column;gap:16px;padding:16px 14px;'
            f'background-color:var(--color-surface-raised);{CARD}">'
            f'<div style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;gap:4px">{segs}</div>'
            f'{px(f"Passo {step} de 2", 16, "var(--color-text-muted)")}</div>'
            f'<div style="display:flex;align-items:center;gap:10px">{icon}'
            f'<div style="flex:1;display:flex;flex-direction:column;gap:6px">{px(title, 24, pc, 28, wrap=True)}'
            f'{muted(ask, 14, "line-height:18px")}</div></div>'
            f'<div style="display:flex;flex-direction:column;gap:8px">{rows}'
            f'<div style="display:flex;align-items:center;justify-content:center;gap:6px;height:44px">'
            f'{px(more_label, 16, "var(--color-text-muted)")}</div></div>'
            f'<div style="display:flex;gap:12px">{ghost("Voltar", 56, "flex:1;")}{key(send_label, flex="flex:2;")}</div>'
            f'<div style="display:flex;align-items:center;justify-content:center;height:44px">'
            f'{px("Agora não", 16, "var(--color-text-muted)", extra="text-decoration:underline")}</div></div>')
    voto1 = vote_step(
        1, "gold", "Quem foi o craque?", "Escolha um jogador. Você não aparece na lista. Craque é obrigatório.",
        vrow("RO", "w", "Ronaldinho", "Branco", "gold", "picked")
        + vrow("ZA", "b", "Zagueirão", "Preto")
        + vrow("MA", "w", "Marcão", "Branco")
        + vrow("LU", "b", "Lucão", "Preto")
        + vrow("BE", "w", "Beto", "Branco"),
        "+ 8 jogadores", "Próximo")
    voto2 = vote_step(
        2, "flop", "E o perna de pau?", "Precisa ser outro jogador. Perna de pau é obrigatório.",
        vrow("RO", "w", "Ronaldinho", "Branco", "flop", "blocked")
        + vrow("ZA", "b", "Zagueirão", "Preto")
        + vrow("MA", "w", "Marcão", "Branco", "flop", "picked")
        + vrow("LU", "b", "Lucão", "Preto")
        + vrow("BE", "w", "Beto", "Branco"),
        "+ 8 jogadores", "Enviar votos")
    voto = voto1 + voto2 + muted("Votar é opcional como um todo (“Agora não”), mas quem vota escolhe os dois. Ninguém vota em si e o craque não pode ser também o perna de pau. A seleção tem contorno grosso, selo com ícone e a palavra ESCOLHIDO, então não depende de cor.", 13, "line-height:18px")
    count_box = lambda v, label: (
        f'<div style="min-width:104px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px;'
        f'background-color:var(--color-surface-raised);{CARD}">{pn(v, 4)}{pix(label, 16, "var(--color-text-muted)", 20)}</div>')
    fim = (
        f'<div layer-name="Fim de jogo" style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:28px 20px 20px;'
        f'background-color:var(--color-bg);background-image:radial-gradient(240px 170px at 159px -20px, var(--color-floodlight) 0px, '
        f'transparent 170px);{CARD}">'
        f'{sprite(CELEBRA, 6, name="Bonequinho/Comemora")}'
        f'{pix("Fim de jogo", 32, "var(--color-text)", 36)}'
        f'{t("Votos enviados! O resultado sai às 22h, ou antes, se todo mundo votar.", 16, "var(--color-text-muted)", lh=24, extra="text-align:center;max-width:290px")}'
        f'<div layer-name="Medidor" style="width:100%;display:flex;flex-direction:column;gap:8px">'
        f'<div style="position:relative;height:8px;background-color:var(--color-track)"><div style="position:absolute;left:0px;'
        f'top:0px;width:64%;height:8px;background-color:var(--color-success)"></div></div>'
        f'<div style="display:flex;flex-direction:column;align-items:center;gap:6px">{px("9 de 14 já votaram", 16)}'
        f'{px("Faltam 5", 16, "var(--color-text-muted)")}</div></div>'
        f'<div layer-name="Contagem" style="display:flex;gap:8px;justify-content:center">{count_box("02", "Horas")}{count_box("14", "Minutos")}</div>'
        f'{muted("Dá para mudar até o fim do prazo (22h).", 14, "text-align:center")}'
        f'{ghost("Editar votos", 52, "align-self:stretch;", icon=svg_icon(PENCIL, 18))}'
        f'{ghost("Voltar para o feed", 52, "align-self:stretch;")}</div>'
        f'{muted("O bonequinho dá um pulinho de 2 quadros; com “reduzir movimento”, fica parado. O horário (22h) é exemplo: o prazo da votação ainda não está definido.", 13, "line-height:18px")}'
    )
    def pencil():
        return (f'<div layer-name="Botão/Editar" style="width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;'
                f'justify-content:center;{CARD}">{svg_icon(PENCIL, 20)}</div>')

    def item(icon, label, value, editable):
        return (f'<div style="display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 8px 8px 12px;'
                f'box-shadow:var(--color-border) 0px 2px 0px 0px inset">{icon}'
                f'<div style="flex:1;min-width:0px;display:flex;flex-direction:column;gap:4px">'
                f'{pix(label, 16, "var(--color-text-muted)", 20)}{value}</div>{pencil() if editable else ""}</div>')

    def seus_votos(editable):
        head = (f'<div style="display:flex;align-items:center;gap:6px">{svg_icon(CLOCK, 16, "#FB923C", 2.4)}{px("Fecha em 2h", 16, "#FB923C")}</div>'
                if editable else
                f'<div style="display:flex;align-items:center;gap:6px">{svg_icon(LOCK, 16, "#F87171", 2.4)}{px("Votação encerrada", 16, "#FCA5A5")}</div>')
        return (f'<div layer-name="Card/Seus votos/{"Edição" if editable else "Encerrada"}" style="display:flex;flex-direction:column;'
                f'background-color:var(--color-surface-raised);{CARD}">'
                f'<div style="display:flex;flex-direction:column;gap:6px;padding:16px 16px 12px">{px("Seus votos", 16)}{head}</div>'
                + item(svg_icon(STAR_PATH, 22, "none", 0, "#E8A93A"), "Craque", pix("Ronaldinho", 16, "var(--color-gold)", 20), editable)
                + item(svg_icon(STILTS, 24, "#C4A07C"), "Perna de pau", pix("Marcão", 16, "var(--color-flop)", 20), editable)
                + item(svg_icon(URNA, 22, "#F3EAD3", 2.2), "Notas", px("13 notas enviadas", 16), editable)
                + '</div>')
    seus = (seus_votos(True)
            + muted("Notas e votos (Craque e Perna de Pau) podem ser alterados até o fim do prazo da votação. O lápis tem alvo de 44 × 44. O horário (22h) é exemplo: o prazo ainda não está definido.", 13, "line-height:19px")
            + seus_votos(False)
            + muted("Depois do prazo, o mesmo card mostra o cadeado e “VOTAÇÃO ENCERRADA”, e os lápis somem. Quem tentar votar vê o aviso “A votação fechou” (veja Configurações e admin).", 13, "line-height:19px"))
    return section("Dar nota e votar", "Dar nota e votar", "Arrasta para chegar perto, ajusta no mais e menos e "
                   "revisa tudo antes de enviar. O voto vem depois, um prêmio por vez, e dá para mudar até o fim do prazo.", nota + revisao + voto + fim + seus)


SK = "box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset"


def gaveta(title, text, cancel, confirm, danger=False, h=372, name="Gaveta"):
    ok = (f'<div layer-name="Botão/Perigo" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;'
          f'background-color:rgb(239 68 68 / 14%);box-shadow:var(--color-danger) 0px 0px 0px 2px inset">'
          f'{svg_icon(TRASH, 18, "#F87171")}{px(confirm, 16, "#FCA5A5")}</div>') if danger else key(confirm, 52, flex="flex:1;")
    return (f'<div layer-name="{name}" style="position:relative;height:{h}px;overflow:hidden;background-color:var(--color-bg);{CARD}">'
            f'<div style="position:absolute;left:16px;top:16px;width:326px;display:flex;flex-direction:column;gap:10px">'
            f'<div style="height:56px;background-color:var(--color-surface)"></div><div style="height:56px;background-color:var(--color-surface)"></div></div>'
            f'<div style="position:absolute;left:0px;top:0px;width:358px;height:{h}px;background-color:var(--color-scrim)"></div>'
            f'<div style="position:absolute;left:0px;bottom:0px;width:358px;display:flex;flex-direction:column;gap:12px;padding:12px 20px 20px;'
            f'background-color:var(--color-surface-3);box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset">'
            f'<div style="align-self:center;width:40px;height:4px;background-color:var(--color-border-strong)"></div>'
            f'{px(title, 24, lh=34, extra="padding-top:4px", wrap=True)}'
            f'{muted(text, 16, "line-height:24px")}'
            f'<div style="display:flex;gap:12px;padding-top:4px">{ghost(cancel, 52, "flex:1;")}{ok}</div></div></div>')


def avisos():
    skel_row = lambda first, w1, w2: (
        f'<div style="display:flex;align-items:center;gap:12px;padding:16px;'
        f'{"" if first else "box-shadow:var(--color-border) 0px 2px 0px 0px inset"}">'
        f'<div style="width:40px;height:40px;flex-shrink:0;border-radius:999px;background-color:var(--color-surface-3);{SK}"></div>'
        f'<div style="flex:1;display:flex;flex-direction:column;gap:8px"><div style="width:{w1}%;height:16px;'
        f'background-color:var(--color-surface-3);{SK}"></div><div style="width:{w2}%;height:14px;'
        f'background-color:var(--color-surface-3);{SK}"></div></div><div style="width:40px;height:28px;'
        f'background-color:var(--color-surface-3);{SK}"></div></div>')
    body = (
        f'<div layer-name="Aviso/Sucesso" style="display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 8px 6px 16px;'
        f'background-color:var(--color-surface-3);{FLOAT}"><div style="width:24px;height:24px;flex-shrink:0;border-radius:999px;'
        f'display:flex;align-items:center;justify-content:center;background-color:var(--color-success)">{svg_icon(CHECK, 14, "#04210F", 3)}</div>'
        f'<div style="flex:1">{px("Presença confirmada", 16, wrap=True)}</div>'
        f'<div style="display:flex;align-items:center;height:44px;padding:0px 8px">{px("Desfazer", 16, "var(--color-accent)")}</div></div>'
        f'<div layer-name="Carregando" style="display:flex;flex-direction:column;background-color:var(--color-surface);{CARD}">'
        f'{skel_row(True, 62, 38)}{skel_row(False, 48, 30)}</div>'
        f'<div layer-name="Vazio" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:32px 24px;{CARD}">'
        f'<svg width="96" height="56" viewBox="0 0 96 56" fill="none" stroke="rgb(255 255 255 / 28%)" stroke-width="2">'
        f'<rect x="2" y="2" width="92" height="52"/><line x1="48" y1="2" x2="48" y2="54"/><circle cx="48" cy="28" r="10"/>'
        f'<rect x="66" y="36" width="8" height="8" fill="#F3EAD3" stroke="none"/></svg>'
        f'{px("Nenhuma rodada marcada", 16, wrap=True, extra="text-align:center;justify-content:center")}'
        f'{muted("Quando o admin marcar a próxima, ela aparece aqui e você recebe um aviso.", 14, "line-height:20px;text-align:center;max-width:260px")}</div>'
        f'<div layer-name="Erro" style="display:flex;flex-direction:column;gap:12px;padding:16px;background-color:rgb(239 68 68 / 8%);'
        f'box-shadow:var(--color-danger) 0px 0px 0px 2px inset"><div style="display:flex;gap:12px">{svg_icon(ALERT, 22, "#F87171", 2.2)}'
        f'<div style="display:flex;flex-direction:column;gap:2px">{t("Não deu para carregar o ranking", 16, weight=600, lh=22)}'
        f'{muted("Parece que a internet caiu. Suas notas estão salvas.", 14, "line-height:20px")}</div></div>'
        f'{ghost("Tentar de novo", 44, icon=svg_icon(REDO, 16))}</div>'
        + gaveta("Publicar os times?", "Os 14 confirmados vão receber um aviso. Dá para trocar jogador depois.", "Voltar", "Publicar")
    )
    return section("Avisos e estados", "Avisos e estados", "Toda tela sabe o que dizer quando deu certo, quando "
                   "está carregando, quando está vazia e quando falhou.", body)


def feed():
    rank_row = lambda pos, ini, team, name, sub, nota, up, delta, first: (
        f'<div style="display:flex;align-items:center;gap:10px;padding:14px 12px;min-height:72px;'
        f'{"" if first else "box-shadow:var(--color-border) 0px 2px 0px 0px inset"}">'
        f'<div style="width:16px;flex-shrink:0;display:flex;justify-content:center">'
        f'{pn(pos, 3, "var(--color-gold)" if first else "var(--color-text-muted)")}</div>'
        f'{avatar(ini, team, 40, "var(--color-gold)" if first else None)}'
        f'<div style="flex:1;min-width:0px;display:flex;flex-direction:column;gap:4px">{pix(name, 16)}{muted(sub, 13)}</div>'
        f'<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px">'
        f'{pn(nota, 3, "var(--color-gold)" if first else "var(--color-text)")}'
        f'<div style="display:flex;align-items:center;gap:4px">{tri(up)}{pn(delta, 2, "var(--color-success)" if up else "#F87171")}</div></div></div>')

    def big(name, color, icon_box, title, line, action):
        return (f'<div layer-name="{name}" style="display:flex;flex-direction:column;gap:14px;padding:16px;'
                f'background-color:var(--color-surface-raised);box-shadow:{color} 0px 0px 0px 3px inset">'
                f'<div style="display:flex;align-items:center;gap:14px">{icon_box}'
                f'<div style="flex:1;min-width:0px;display:flex;flex-direction:column;gap:6px">'
                f'{px(title, 24, lh=30, wrap=True)}{line}</div></div>{action}</div>')

    def linha(name, color, icon, title, extra=""):
        return (f'<div layer-name="{name}" style="display:flex;align-items:center;gap:12px;height:56px;padding:0px 16px;'
                f'background-color:var(--color-surface-raised);{CARD}">{svg_icon(icon, 24, color, 2.2)}'
                f'<div style="flex:1;min-width:0px">{px(title, 16)}</div>{extra}{svg_icon(CHEV_R, 20, "#F3EAD3", 2.4)}</div>')

    pack_box = (f'<div style="width:48px;height:60px;flex-shrink:0;display:flex;align-items:center;justify-content:center;'
                f'background-color:var(--color-surface-3);box-shadow:var(--color-gold) 0px 0px 0px 2px inset">'
                f'{sprite(STAR, 3, team_pal("w"), "Estrela")}</div>')
    tab = lambda label, on: (f'<div style="flex:1;display:flex;align-items:center;justify-content:center;height:44px;'
                             f'{"background-color:var(--color-surface-3);box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset" if on else ""}">'
                             f'{px(label, 16, "var(--color-text)" if on else "var(--color-text-muted)")}</div>')
    prazo = f'<div style="display:flex;align-items:center;gap:4px">{svg_icon(CLOCK, 14, "#FB923C", 2.4)}{px("2h", 16)}</div>'
    body = (
        big("Aviso/Resultado", "var(--color-gold)", pack_box, "O resultado saiu",
            muted("Rodada 12 · notas fechadas. Quem foi o craque?", 14), key("Abrir pacote", 52))
        + linha("Aviso/Votação", "#FB923C", URNA, "Votação aberta", prazo)
        + linha("Aviso/Presença", "#22C55E", INVITE, "Presença aberta")
        + muted("Um aviso grande por vez, na ordem resultado > votação > presença; os outros em linha. Cada tipo tem ícone e cor própria (ouro, laranja, verde), e o título diz o tipo por escrito, para quem não distingue as cores.", 13, "line-height:19px")
        + f'<div layer-name="Abas/Ranking" style="display:flex;padding:4px;gap:4px;background-color:var(--color-surface);{CARD}">'
          f'{tab("Geral", True)}{tab("Posição", False)}{tab("Goleiros", False)}</div>'
        + f'<div layer-name="Card/Ranking" style="display:flex;flex-direction:column;background-color:var(--color-surface);{CARD}">'
          f'{rank_row("1", "RO", "w", "Ronaldinho", "Meia do Branco, 12 jogos", "8,4", True, "2", True)}'
          f'{rank_row("2", "ZA", "b", "Zagueirão", "Zagueiro do Preto, 11 jogos", "7,9", False, "1", False)}</div>'
        + muted("O ranking mostra a média da temporada (8,4); a nota da rodada (9,1) aparece no placar e na carta. A seta da tendência tem nome para leitor de tela: “subiu 2 posições”.", 13, "line-height:18px")
    )
    return section("Feed e ranking", "Feed e ranking", "O aviso chama para uma ação, com a cor do tipo. No dia da pelada, "
                   "o resultado chega como um pacote fechado. A lista fica quieta, e só o líder ganha ouro.", body)


def frame_label(n, title, timing):
    return (f'<div style="display:flex;flex-direction:column;gap:4px">{px(f"{n} · {title}", 16)}'
            f'{muted(timing, 13)}</div>')


def momentos():
    pal_w, pal_b = team_pal("w"), team_pal("b")
    sub = lambda s: px(s, 24, lh=28)
    closed = (f'<div layer-name="Pacote/1 Fechado" style="display:flex;flex-direction:column;gap:10px;align-items:center;'
              f'justify-content:center;width:173px;height:230px;background-color:var(--color-surface-3);'
              f'box-shadow:var(--color-game) 0px 0px 0px 3px inset, #000000 4px 4px 0px 0px">{sprite(STAR, 5, name="Estrela")}'
              f'{pix("Craque", 16, "var(--color-gold)", 20, "text-align:center")}'
              f'{px("Rodada 12", 16, "var(--color-gold)", extra="justify-content:center")}'
              f'{pix("Toque para abrir", 16, "var(--color-text-muted)", 18, "text-align:center;white-space:normal;width:130px")}</div>')
    torn = (f'<div layer-name="Pacote/2 Rasgando" style="position:relative;width:173px;height:230px;overflow:hidden;'
            f'background-color:#050806;box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset">'
            f'<div style="position:absolute;left:12px;top:14px;width:149px;height:70px;background-color:var(--color-surface-3);'
            f'transform:rotate(-8deg);box-shadow:var(--color-game) 0px 0px 0px 3px inset"></div>'
            f'<div style="position:absolute;left:12px;top:118px;width:149px;height:98px;background-color:var(--color-surface-3);'
            f'transform:rotate(3deg);box-shadow:var(--color-game) 0px 0px 0px 3px inset"></div>'
            f'<div style="position:absolute;left:0px;top:84px;width:173px;height:34px;background-image:linear-gradient(180deg, '
            f'rgb(252 231 161 / 0%) 0%, #FCE7A1 45%, #FFFFFF 50%, #FCE7A1 55%, rgb(252 231 161 / 0%) 100%)"></div>'
            f'</div>')
    card = (f'<div layer-name="Carta/Craque" style="display:flex;flex-direction:column;justify-content:space-between;width:168px;'
            f'height:236px;padding:12px;transform:rotate(-4deg);background-image:linear-gradient(135deg, #F6D77A 0%, #E8A93A 30%, '
            f'#FBE7A8 55%, #D4F0E6 78%, #E8A93A 100%);box-shadow:#000000 0px 0px 0px 3px inset, #000000 6px 6px 0px 0px">'
            f'<div style="display:flex;justify-content:space-between;align-items:center">'
            f'{pn("9,1", 4, "#111111")}{sprite(STAR_SOLID, 2, team_pal("w"), "Estrela")}</div>'
            f'<div style="display:flex;justify-content:center">{sprite(PLAYER, 5, pal_w, "Bonequinho")}</div>'
            f'<div style="display:flex;flex-direction:column;gap:2px">{pix("Ronaldinho", 16, "#111111", 20)}'
            f'{pix("Craque", 16, "#3A2A10", 20)}{px("Rodada 12", 16, "#3A2A10")}</div></div>')
    reveal = (f'<div layer-name="Pacote/3 Revelação" style="position:relative;display:flex;align-items:center;justify-content:center;'
              f'height:280px;overflow:hidden;background-color:#050806;background-image:radial-gradient(200px 160px at 179px 140px, '
              f'rgb(232 169 58 / 30%) 0px, transparent 160px);box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset">'
              f'<div style="position:absolute;left:84px;top:75px">{sprite(BURST, 10, team_pal("w"), "Luz em pixel")}</div>{card}</div>')
    pacote = (
        f'<div layer-name="Momento/Pacote" style="display:flex;flex-direction:column;gap:12px">'
        f'{sub("Pacote do Craque")}'
        f'<div style="display:flex;gap:12px"><div style="display:flex;flex-direction:column;gap:8px">{closed}'
        f'{frame_label(1, "Suspense", "toque: o pacote treme · 0–0,6 s")}</div>'
        f'<div style="display:flex;flex-direction:column;gap:8px">{torn}{frame_label(2, "Rasgo", "a luz vaza pela fenda · 0,6–1,2 s")}</div></div>'
        f'{reveal}{frame_label(3, "Revelação", "a carta gira e para de frente · 1,2–2 s · botão Compartilhar")}</div>'
    )
    half = lambda: (f'background-image:linear-gradient(104deg, #FFFFFF 0%, #FFFFFF 50%, #000000 50%, #000000 100%);'
                    f'box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset')
    speed = lambda left, top, w, color: (f'<div style="position:absolute;left:{left}px;top:{top}px;width:{w}px;height:3px;'
                                         f'background-color:{color}"></div>')
    entry = (f'<div layer-name="VS/1 Entrada" style="position:relative;width:173px;height:150px;overflow:hidden;{half()}">'
             f'{speed(4, 24, 14, "#111111")}{speed(4, 32, 10, "#111111")}'
             f'<div style="position:absolute;left:24px;top:18px">{squad("w", 3, 2, "Sprites/Branco")}</div>'
             f'<div style="position:absolute;left:97px;top:108px">{squad("b", 3, 2, "Sprites/Preto")}</div>'
             f'{speed(155, 112, 14, "#FFFFFF")}{speed(159, 120, 10, "#FFFFFF")}</div>')
    clash = (f'<div layer-name="VS/2 Choque" style="position:relative;width:173px;height:150px;overflow:hidden;{half()}">'
             f'<div style="position:absolute;left:0px;top:0px;width:173px;height:150px;background-color:rgb(255 255 255 / 55%)"></div>'
             f'<div style="position:absolute;left:30px;top:40px;width:112px;height:68px;display:flex;align-items:center;'
             f'justify-content:center;transform:rotate(-6deg) scale(1.25);font-family:Silkscreen;font-weight:700;font-size:56px;'
             f'line-height:60px;color:var(--color-game);text-shadow:#000000 4px 4px 0px, #000000 -2px -2px 0px, '
             f'#000000 2px -2px 0px, #000000 -2px 2px 0px">VS</div></div>')
    final = (f'<div layer-name="VS/3 Quadro final" style="position:relative;height:250px;overflow:hidden;{half()}">'
             f'<div style="position:absolute;left:14px;top:14px;display:flex;flex-direction:column;gap:6px">'
             f'{pix("Branco", 32, "#000000", 36)}{squad("w", name="Sprites/Branco")}</div>'
             f'<div style="position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;gap:6px;align-items:flex-end">'
             f'{squad("b", name="Sprites/Preto")}{pix("Preto", 32, "#FFFFFF", 36)}</div>'
             f'<div style="position:absolute;left:119px;top:91px;width:120px;height:68px;display:flex;align-items:center;'
             f'justify-content:center;transform:rotate(-6deg);font-family:Silkscreen;font-weight:700;font-size:56px;line-height:60px;'
             f'color:var(--color-game);text-shadow:#000000 4px 4px 0px, #000000 -2px -2px 0px, #000000 2px -2px 0px, '
             f'#000000 -2px 2px 0px">VS</div>'
             f'<div style="position:absolute;left:14px;bottom:14px">{px("Hoje, 20h", 16, "#000000")}</div></div>')
    vs = (
        f'<div layer-name="Momento/VS" style="display:flex;flex-direction:column;gap:12px">'
        f'{sub("VS dos times")}'
        f'<div style="display:flex;gap:12px"><div style="display:flex;flex-direction:column;gap:8px">{entry}'
        f'{frame_label(1, "Entrada", "os jogadores entram um a um · 0–0,6 s")}</div>'
        f'<div style="display:flex;flex-direction:column;gap:8px">{clash}{frame_label(2, "Choque", "VS bate, tela pisca e treme · 0,6–0,9 s")}</div></div>'
        f'{final}{frame_label(3, "Quadro final", "fica parado até o toque · botão Pular sempre visível")}</div>'
    )
    rules = (f'<div layer-name="Regras dos momentos" style="display:flex;flex-direction:column;gap:8px;padding:16px;{CARD}">'
             f'{px("Regras", 16)}'
             f'{muted("Até 2 s, sempre com “Pular”. Pixel anda em degraus (steps), sem suavizar. Com “reduzir movimento”, vai direto para o quadro final com um fade. Som desligado por padrão.", 13, "line-height:19px")}'
             f'</div>')
    return section("Grandes momentos", "Grandes momentos", "Três momentos, dentro do mesmo DS: o VS quando os times "
                   "saem, e no dia da pelada o resultado, que chega como pacote e revela a carta do Craque. Aqui o pixel "
                   "aparece inteiro.", vs + pacote + rules, 24)


NAV_ICONS = [("Feed", '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'),
             ("Times", '<rect x="3" y="4" width="18" height="16"/><path d="M12 4v16"/><circle cx="12" cy="12" r="3"/>'),
             ("Ranking", '<path d="M8 4h8v5a4 4 0 0 1-8 0zM12 13v4M8 20h8M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3"/>'),
             ("Histórico", '<rect x="4" y="5" width="16" height="15"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
             ("Perfil", '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>')]


def navegacao():
    def bar(active, name):
        tabs = ""
        for i, (label, d) in enumerate(NAV_ICONS):
            on = i == active
            icon = (f'<svg width="24" height="24" viewBox="0 0 24 24" fill="{"#F3EAD3" if on else "none"}" '
                    f'stroke="{"#F3EAD3" if on else "#CFCAB5"}" stroke-width="2" stroke-linejoin="round" style="flex-shrink:0">{d}</svg>')
            if on:
                tabs += (f'<div layer-name="Aba/{label}" style="flex-shrink:0;display:flex;align-items:center;justify-content:center;'
                         f'gap:8px;height:48px;padding:0px 14px;border-radius:14px;background-color:rgb(243 234 211 / 12%)">'
                         f'{icon}{pix(label, 16, "var(--color-text)", 20)}</div>')
            else:
                tabs += (f'<div layer-name="Aba/{label}" style="flex:1;min-width:44px;display:flex;align-items:center;'
                         f'justify-content:center;height:48px">{icon}</div>')
        return (f'<div layer-name="{name}" style="display:flex;gap:2px;padding:6px;border-radius:20px;'
                f'background-color:var(--color-surface);{FLOAT}">{tabs}</div>')
    body = (f'<div style="display:flex;flex-direction:column;gap:14px;padding:24px 8px 18px;background-image:linear-gradient(180deg, var(--color-bg) 0%, #07140C 100%)">'
            f'{bar(0, "Barra de abas")}{bar(2, "Barra de abas/Ranking")}</div>'
            f'{muted("Exceção ao canto reto: a barra fica sob o polegar o tempo todo. Cinco abas não cabem com nome em pixel de 16px, então só a aba ativa mostra o nome, dentro da pílula. As outras são só ícone, com nome para leitor de tela. Ao trocar de aba, a pílula cresce da largura do ícone até caber o nome (250 ms, ease-out); com “reduzir movimento”, troca sem animar. Alvo de toque mínimo de 44px.", 13, "line-height:18px")}')
    return section("Navegação", "Navegação", "O polegar mora aqui, então ela é redonda, como controle de "
                   "videogame. A aba ativa vira pílula com o nome.", body)



CAL = '<rect x="4" y="5" width="16" height="15"/><path d="M4 10h16M9 3v4M15 3v4"/>'
DOTS = ('<rect x="3" y="10" width="4" height="4" fill="#F3EAD3" stroke="none"/><rect x="10" y="10" width="4" height="4" fill="#F3EAD3" stroke="none"/>'
        '<rect x="17" y="10" width="4" height="4" fill="#F3EAD3" stroke="none"/>')


def config_admin():
    # --- interruptor ---
    def switch(on):
        track = ("background-color:var(--color-success);box-shadow:#000000 0px 0px 0px 2px inset" if on
                 else "background-color:var(--color-surface-3);box-shadow:var(--color-border-strong) 0px 0px 0px 2px inset")
        mark = (f'<div style="position:absolute;left:10px;top:10px">{svg_icon(CHECK, 20, "#04210F", 3)}</div>' if on
                else f'<div style="position:absolute;right:10px;top:10px">{svg_icon(XMARK, 20, "#CFCAB5", 2.6)}</div>')
        knob = (f'<div style="position:absolute;left:{40 if on else 4}px;top:4px;width:32px;height:32px;'
                f'background-color:#F3EAD3;box-shadow:#000000 0px 0px 0px 3px inset"></div>')
        return (f'<div layer-name="Interruptor/{"Ligado" if on else "Desligado"}" style="width:80px;height:48px;flex-shrink:0;'
                f'display:flex;align-items:center;justify-content:center"><div style="position:relative;width:76px;height:40px;{track}">'
                f'{mark}{knob}</div></div>')

    def sw_row(on, first):
        state = (f'<div style="display:flex;align-items:center;gap:6px">{svg_icon(CHECK, 14, "#22C55E", 3)}{px("Ligado", 16, "var(--color-success)")}</div>' if on
                 else f'<div style="display:flex;align-items:center;gap:6px">{svg_icon(XMARK, 14, "#CFCAB5", 3)}{px("Desligado", 16, "var(--color-text-muted)")}</div>')
        return (f'<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;min-height:76px;'
                f'{"" if first else "box-shadow:var(--color-border) 0px 2px 0px 0px inset"}">'
                f'<div style="display:flex;flex-direction:column;gap:6px">{px("Fundo Noite", 16)}{state}</div>{switch(on)}</div>')
    interruptor = (f'<div layer-name="Card/Interruptor" style="display:flex;flex-direction:column;background-color:var(--color-surface);{CARD}">'
                   f'{sw_row(True, True)}{sw_row(False, False)}</div>'
                   + muted("Interruptor: o botão vai para a direita e aparece o texto LIGADO com ✓; vai para a esquerda e aparece DESLIGADO com ✕. Cor nunca é o único sinal. Área de toque de 80 × 48.", 13, "line-height:19px"))

    # --- data e hora ---
    def field(label, value, icon, flex, opened=False):
        edge = ("var(--color-text) 0px 0px 0px 3px inset" if opened else "var(--color-border-strong) 0px 0px 0px 2px inset")
        return (f'<div style="{flex}display:flex;flex-direction:column;gap:8px">{px(label, 16, "var(--color-text-muted)")}'
                f'<div layer-name="Campo/{label}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;height:56px;'
                f'padding:0px 14px;background-color:var(--color-surface);box-shadow:{edge}">{value}{svg_icon(icon, 22, "#F3EAD3", 2)}</div></div>')
    days = [("Sex", 23), ("Sáb", 24), ("Dom", 25), ("Seg", 26), ("Ter", 27)]
    def day(wd, n, sel):
        edge = "var(--color-text) 0px 0px 0px 3px inset" if sel else "var(--color-border) 0px 2px 0px 0px inset"
        return (f'<div layer-name="Dia/{wd} {n}" style="display:flex;align-items:center;justify-content:space-between;height:52px;padding:0px 16px;'
                f'background-color:{"var(--color-surface-raised)" if sel else "transparent"};box-shadow:{edge}">'
                f'{px(f"{wd}, {n} out", 16)}'
                f'{svg_icon(CHECK, 22, "#22C55E", 3) if sel else ""}</div>')
    picker = (f'<div layer-name="Seletor de dia" style="display:flex;flex-direction:column;background-color:var(--color-surface-3);{FLOAT}">'
              f'<div style="padding:12px 16px 8px">{px("Escolha o dia", 16, "var(--color-text-muted)")}</div>'
              + "".join(day(w, n, n == 24) for w, n in days) + '</div>')
    datahora = (f'<div style="display:flex;gap:12px">{field("Data", px("Sáb, 24 out", 16), CAL, "flex:1;min-width:0px;", True)}'
                f'{field("Hora", px("9h", 16), CLOCK, "width:112px;flex-shrink:0;")}</div>'
                + picker
                + muted("O admin escolhe o dia de cada rodada: ele não é fixo. A lista mostra os próximos dias a partir de hoje, e a hora abre um seletor igual. Data e hora ficam no formato do app (“SÁB, 24 OUT · 9H”).", 13, "line-height:19px"))

    # --- elenco ---
    def selo(label, gold):
        c = "var(--color-gold)" if gold else "var(--color-border-strong)"
        return (f'<div style="display:flex;align-items:center;height:24px;padding:0px 6px;box-shadow:{c} 0px 0px 0px 2px inset">'
                f'{px(label, 16, "var(--color-gold)" if gold else "var(--color-text-muted)", 20)}</div>')
    def menu_btn():
        return (f'<div layer-name="Botão/Menu" style="width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;{CARD}">'
                f'{svg_icon(DOTS, 20)}</div>')
    def membro(ini, team, name, pos, admin, first):
        return (f'<div layer-name="Linha/{name}" style="display:flex;align-items:center;gap:10px;min-height:72px;padding:8px 8px 8px 12px;'
                f'{"" if first else "box-shadow:var(--color-border) 0px 2px 0px 0px inset"}">{avatar(ini, team, 40, bg_ring="var(--color-surface)")}'
                f'<div style="flex:1;min-width:0px;display:flex;flex-direction:column;gap:4px">{pix(name, 16, lh=20)}'
                f'<div style="display:flex;align-items:center;gap:8px">{pix(pos, 16, "var(--color-text-muted)", 20)}'
                f'{selo("Admin", True) if admin else selo("Jogador", False)}</div></div>{menu_btn()}</div>')
    menu_item = lambda icon, label, color, first: (
        f'<div style="display:flex;align-items:center;gap:12px;height:52px;padding:0px 16px;'
        f'{"" if first else "box-shadow:var(--color-border) 0px 2px 0px 0px inset"}">{svg_icon(icon, 20, color, 2.2)}{px(label, 16, color)}</div>')
    elenco = (f'<div layer-name="Card/Elenco" style="display:flex;flex-direction:column;background-color:var(--color-surface);{CARD}">'
              f'{membro("RO", "w", "Ronaldinho", "Meia", True, True)}{membro("ZA", "b", "Zagueirão", "Zagueiro", False, False)}'
              f'{membro("MA", "w", "Marcão", "Atacante", False, False)}</div>'
              f'<div layer-name="Menu do jogador" style="align-self:flex-end;width:274px;display:flex;flex-direction:column;'
              f'background-color:var(--color-surface-3);{FLOAT}">{menu_item(CHECK, "Tornar admin", "#F3EAD3", True)}'
              f'{menu_item(TRASH, "Remover jogador", "#FCA5A5", False)}</div>'
              + muted("O menu ⋯ tem alvo de 44 × 44 e abre este quadro. “Remover jogador” leva à confirmação abaixo.", 13, "line-height:19px"))

    # --- erro: votação fechou ---
    fechou = (f'<div layer-name="Erro/Votação fechou" style="display:flex;flex-direction:column;gap:14px;padding:16px;'
              f'background-color:rgb(239 68 68 / 8%);box-shadow:var(--color-danger) 0px 0px 0px 2px inset">'
              f'<div style="display:flex;align-items:center;gap:12px">{svg_icon(LOCK, 28, "#F87171", 2.2)}'
              f'{px("A votação fechou", 24, lh=30, wrap=True, extra="flex:1;")}</div>'
              f'{muted("O prazo acabou enquanto você votava. Os votos que ainda não tinham sido enviados não entram na conta.", 14, "line-height:20px")}'
              f'{key("Ver o resultado", 52)}{ghost("Voltar para o feed", 52)}</div>')
    body = (interruptor + datahora + elenco
            + gaveta("Encerrar votação?", "Os votos enviados até agora valem, e ninguém mais poderá votar nesta rodada.", "Voltar", "Encerrar", name="Gaveta/Encerrar votação")
            + gaveta("Remover Zagueirão?", "Ele sai do elenco do grupo. Dá para convidar de novo depois.", "Voltar", "Remover", danger=True, name="Gaveta/Remover jogador")
            + fechou)
    return section("Configurações e admin", "Configurações e admin", "Ajustes que o admin mexe de vez em quando. Mesmos padrões: "
                   "pixel no rótulo e no título, Chakra Petch na frase, canto reto, tecla e alvo de 44px.", body, 20)


# ---------- simulação de daltonismo ----------
MACHADO = {  # Machado, Oliveira e Fernandes (2009), severidade 1,0, aplicada em RGB linear
    "protanopia": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    "deuteranopia": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
}


def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c):
    c = min(max(c, 0), 1)
    return round(255 * (c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055))


def simula(hex_, kind):
    r, g, b = (_lin(int(hex_[i:i + 2], 16)) for i in (1, 3, 5))
    m = MACHADO[kind]
    out = [m[i][0] * r + m[i][1] * g + m[i][2] * b for i in range(3)]
    return "#%02X%02X%02X" % tuple(_gam(c) for c in out)


def _lab(hex_):
    r, g, b = (_lin(int(hex_[i:i + 2], 16)) for i in (1, 3, 5))
    x, y, z = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda v: v ** (1 / 3) if v > 0.008856 else 7.787 * v + 16 / 116
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def delta_e(a, b):
    la, lb = _lab(a), _lab(b)
    return sum((p - q) ** 2 for p, q in zip(la, lb)) ** 0.5


PAPEIS = [("Ouro", "#E8A93A"), ("Laranja", "#FB923C"), ("Verde", "#22C55E"), ("Vermelho", "#EF4444"),
          ("Madeira", "#C4A07C"), ("Amarelo", "#FACC15"), ("Gramado", "#0D2717")]
# pares que carregam significado: (a, b, o que também diz a diferença)
PARES = [("Ouro", "Laranja", "ícone de pacote ou urna + rótulo RESULTADO ou VOTAÇÃO"),
         ("Verde", "Vermelho", "ícone de check + “Venceu”; seta para cima ou para baixo"),
         ("Ouro", "Madeira", "estrela ou pernas de pau + palavra CRAQUE ou PERNA DE PAU"),
         ("Amarelo", "Ouro", "só a tecla é amarela; o ouro nunca é botão"),
         ("Verde", "Gramado", "o verde do CONFIRMAR tem check, texto e contorno preto")]


def daltonismo():
    colors = dict(PAPEIS)
    sw = lambda hex_: f'<div style="width:100%;height:28px;background-color:{hex_};box-shadow:#000000 0px 0px 0px 2px inset"></div>'
    head = (f'<div style="display:flex;gap:6px;align-items:flex-end">'
            f'<div style="width:64px;flex-shrink:0"></div>'
            + "".join(f'<div style="flex:1;text-align:center">{muted(x, 13)}</div>' for x in ("Normal", "Protan.", "Deuter."))
            + '</div>')
    rows = ""
    for name, hex_ in PAPEIS:
        rows += (f'<div style="display:flex;gap:6px;align-items:center"><div style="width:64px;flex-shrink:0">{t(name, 13, weight=600, lh=16)}</div>'
                 f'<div style="flex:1">{sw(hex_)}</div><div style="flex:1">{sw(simula(hex_, "protanopia"))}</div>'
                 f'<div style="flex:1">{sw(simula(hex_, "deuteranopia"))}</div></div>')
    pares = ""
    for a, b, carrega in PARES:
        d = [delta_e(simula(colors[a], k), simula(colors[b], k)) for k in MACHADO]
        close = min(d) < 25
        pares += (f'<div style="display:flex;flex-direction:column;gap:2px;padding:10px 12px;{CARD}">'
                  f'<div style="display:flex;justify-content:space-between;align-items:baseline">'
                  f'{t(f"{a} e {b}", 14, weight=600, lh=18)}'
                  f'{t(("Parecem iguais" if close else "Dá para ver a diferença"), 13, "var(--color-warning)" if close else "var(--color-success)", 600, 16)}</div>'
                  f'{muted(f"Protanopia {d[0]:.0f} · deuteranopia {d[1]:.0f} (diferença de cor; abaixo de 25 se confunde)", 13, "line-height:17px")}'
                  f'{muted("Quem diz a diferença: " + carrega, 13, "line-height:17px")}</div>')
    body = (head + f'<div style="display:flex;flex-direction:column;gap:6px">{rows}</div>'
            f'<div style="display:flex;flex-direction:column;gap:8px">{pares}</div>'
            + muted("Simulado com as matrizes de Machado (2009) em RGB linear. Regra: cor nunca é o único sinal. Todo significado de cor tem ícone, forma ou texto junto.", 13, "line-height:18px"))
    return section("Daltonismo", "Daltonismo", "Um colega do grupo é daltônico. Simulamos protanopia e "
                   "deuteranopia nas cores de papel e conferimos o que ainda carrega o significado.", body)


def build():
    sections = [cores(), fundo(), tipografia(), pixel_legivel(), forma(), botoes(), selos(), presenca(), classico(), campo(),
                figurinhas(), dar_nota(), avisos(), feed(), momentos(), navegacao(), config_admin(), daltonismo()]
    html = f"""<meta charset="utf-8">
<title>Fut Stats DS v1.4</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Silkscreen:wght@400;700&display=swap">
<style>
:root {{ color-scheme: dark;{TOKENS}}}
* {{ box-sizing: border-box; margin: 0; }}
body {{ background: #04100A; display: flex; justify-content: center; align-items: flex-start; }}
@media (prefers-reduced-motion: no-preference) {{
  [layer-name="Bonequinho/Comemora"] {{ animation: hop 900ms steps(2, jump-none) infinite; }}
  @keyframes hop {{ 50% {{ transform: translateY(-6px); }} }}
}}
</style>
<div layer-name="Design System v1.4 — Gramado" style="position:relative;width:390px;overflow:hidden;display:flex;flex-direction:column;gap:72px;padding:72px 16px 40px;background-color:var(--color-bg);background-image:radial-gradient(320px 260px at 195px 0px, var(--color-floodlight) 0px, rgb(214 250 190 / 6%) 260px, transparent 460px);font-family:Chakra Petch">
{hero()}
{"".join(chr(10) + s for s in sections)}
{muted("Design system v1.3, outubro de 2026.", 13)}
</div>
"""
    OUT.write_text(html, encoding="utf-8")
    print(f"ok {OUT} {len(html)} bytes")


if __name__ == "__main__":
    build()

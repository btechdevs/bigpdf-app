"""Cek menyeluruh: semua class Tailwind yang dipakai di JS/HTML harus ada di css/app.css.

Tailwind memindai file sumber sebagai teks, jadi class yang dirakit secara dinamis
(mis. `bg-${x}-100`) TIDAK akan terdeteksi dan akan hilang dari CSS hasil kompilasi.
Skrip ini menemukannya sebelum user melihat tampilan yang rusak.

Jalankan: python check-css.py      (exit 0 = aman, exit 1 = ada class hilang)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSS = (ROOT / "css" / "app.css").read_text(encoding="utf-8")

SOURCES = [ROOT / "index.html"] + sorted((ROOT / "js").glob("*.js")) + sorted((ROOT / "test").glob("*.html"))

# Class yang bukan milik Tailwind (disediakan Font Awesome) — abaikan.
NON_TAILWIND_PREFIX = ("fa-",)

# Class kustom / penanda logika Tailwind — tidak perlu punya rule sendiri.
# `*-grid` di bawah ini adalah hook JS (lihat README: "Aturan penamaan selector"),
# bukan class styling.
IGNORE = {"group", "peer", "container", "prose", "prose-slate", "no-scrollbar",
          "cat-tool-grid", "tools-cat-grid", "suggest-grid", "opts-grid"}


def css_has(cls: str) -> bool:
    """Apakah class ini punya rule di CSS?

    Tailwind meng-escape karakter khusus dengan backslash, dan koma sebagai
    hex escape `\\2c ` (mis. `lg:grid-cols-[minmax(0,1fr)_320px]` menjadi
    `.lg\\:grid-cols-\\[minmax\\(0\\2c 1fr\\)_320px\\]`). Jadi kita cari
    nama class dasar saja, bukan seluruh selector.
    """
    base = re.escape(cls).replace(r"\,", r"(?:,|\\2c )")
    # boleh ada backslash di depan setiap karakter (escape Tailwind)
    pattern = r"\." + r"\\?".join(base[i:i + 1] for i in range(0, len(base)))
    # perbaiki: re.escape menghasilkan grup seperti \(?:...\) yang tidak boleh dipisah
    # -> cara aman: bangun pola dari karakter asli
    chars = []
    for ch in cls:
        if ch == ",":
            chars.append(r"(?:,|\\2c )")
        else:
            chars.append(r"\\?" + re.escape(ch))
    pattern = r"\." + "".join(chars) + r"(?![\w\-])"
    return re.search(pattern, CSS) is not None


class_re = re.compile(r'class\s*=\s*(["\'])(.*?)\1', re.DOTALL)
# buang SELURUH ekspresi ${ ... } (bukan hanya "${")
expr_re = re.compile(r"\$\{[^{}]*\}")

tokens: dict[str, set[str]] = {}
dynamic_sources: list[str] = []

for path in SOURCES:
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    for m in class_re.finditer(text):
        raw = m.group(2)
        if expr_re.search(raw):
            dynamic_sources.append(f"{path.name}: {raw.strip()[:110]}")
            raw = expr_re.sub(" ", raw)
        for tok in raw.split():
            if not tok or any(c in tok for c in '{}"\'`<>?=|:;()[]'):
                # ':' '[' ']' boleh ada di nama class Tailwind asli
                if not re.fullmatch(r"[A-Za-z0-9:\-\[\]\/\.%,_!]+", tok):
                    continue
            if tok.startswith(NON_TAILWIND_PREFIX) or tok in IGNORE:
                continue
            tokens.setdefault(tok, set()).add(path.name)

missing = sorted(t for t in tokens if not css_has(t))

print(f"file sumber diperiksa : {', '.join(p.name for p in SOURCES if p.exists())}")
print(f"class unik ditemukan : {len(tokens)}")
print(f"class HILANG di CSS  : {len(missing)}")
print()

if missing:
    print("--- class yang tidak ada di css/app.css (tampilan akan rusak) ---")
    for t in missing:
        print(f"  {t:42s} dipakai di {', '.join(sorted(tokens[t]))}")
else:
    print("OK: semua class yang dipakai tersedia di css/app.css")

if dynamic_sources:
    print()
    print("--- class dirakit dinamis (Tailwind tidak bisa mendeteksi; pastikan aman) ---")
    for s in sorted(set(dynamic_sources)):
        print("  " + s)

sys.exit(1 if missing else 0)

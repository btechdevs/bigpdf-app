"""Verifikasi class yang dirakit dinamis di JS benar-benar tersedia.

Dua sumber nilai dinamis yang bisa membuat tampilan rusak:
  1. gradient kategori (cat.color / c.color) -> harus ada di css/app.css
  2. nama ikon (tool.icon / cat.icon)        -> harus ada di Font Awesome

Jalankan: python check-dynamic.py     (exit 0 = aman)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSS = (ROOT / "css" / "app.css").read_text(encoding="utf-8")
CONFIG = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
FA = (ROOT / "vendor" / "fontawesome" / "css" / "all.min.css").read_text(encoding="utf-8")


def has_class(cls: str) -> bool:
    chars = []
    for ch in cls:
        if ch == ",":
            chars.append(r"(?:,|\\2c )")
        else:
            chars.append(r"\\?" + re.escape(ch))
    return re.search(r"\." + "".join(chars) + r"(?![\w\-])", CSS) is not None


problems = []

# --- 1. gradient kategori ---
colors = re.findall(r"color:\s*'([^']+)'", CONFIG)
print(f"gradient kategori: {len(colors)}")
for c in colors:
    for cls in c.split():
        ok = has_class(cls)
        if not ok:
            problems.append(cls)
        print(f"  {'OK  ' if ok else 'MISS'} {cls:24s}  ({c})")

# --- 2. ikon ---
js_text = "\n".join(p.read_text(encoding="utf-8") for p in sorted((ROOT / "js").glob("*.js")))
icons = sorted(set(re.findall(r"icon:\s*'([a-z0-9\-]+)'", js_text)))
fa_missing = [i for i in icons if f".{i}:before" not in FA]
print(f"\nikon terdaftar: {len(icons)}  | tidak ada di Font Awesome: {len(fa_missing)}")
for i in fa_missing:
    print("   MISS", i)
problems += fa_missing

# --- 3. class Tailwind statis di dalam literal dinamis ---
# hanya token yang berpola class Tailwind (prefix yang dikenal)
PREFIX = re.compile(
    r"^(bg|text|border|from|to|via|ring|shadow|hover|focus|group|disabled|file|has|"
    r"sm|md|lg|xl|2xl|cursor|rounded|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|"
    r"min|max|flex|grid|gap|space|place|items|justify|col|row|order|opacity|blur|"
    r"backdrop|transition|transform|translate|scale|rotate|overflow|z|inset|top|bottom|"
    r"left|right|static|fixed|absolute|relative|sticky|inline|block|hidden|table|truncate|"
    r"leading|tracking|font|uppercase|lowercase|capitalize|underline|antialiased|select|"
    r"resize|outline|ring|divide|list|whitespace|break|align|vertical|object|aspect|"
    r"pointer|visible|isolate|shrink|grow|basis|content|self|auto|sr)-")

dyn_blocks = re.findall(r'class="([^"]*\$\{[^"]*)"', js_text)
expr_re = re.compile(r"\$\{[^{}]*\}")
candidates = set()
for b in dyn_blocks:
    for part in expr_re.split(b):
        candidates.update(part.split())
# class di dalam cabang kondisi ('cursor-grab', 'text-rose-500 fa-file-pdf')
for m in re.finditer(r"\$\{[^{}]*\}", js_text):
    for q in re.findall(r"'([^']+)'", m.group(0)):
        candidates.update(q.split())

# buang potongan HTML yang menempel pada nama class (mis. `py-0.5">Popular</span>`)
clean = set()
for t in candidates:
    t = re.split(r'["\'<>]', t)[0].rstrip("\\")
    if t:
        clean.add(t)
candidates = clean

tw_classes = sorted(t for t in candidates if PREFIX.match(t) and not t.startswith("fa-"))
miss3 = [t for t in tw_classes if not has_class(t)]
print(f"\nclass Tailwind statis dalam template dinamis: {len(tw_classes)}  | hilang: {len(miss3)}")
for t in miss3:
    print("   MISS", t)
problems += miss3

print()
if problems:
    print("MASALAH:", sorted(set(problems)))
    sys.exit(1)
print("SEMUA class dinamis tersedia — tampilan aman.")

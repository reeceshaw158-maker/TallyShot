"""Render docs/privacy-policy.md and docs/terms.md to standalone HTML pages.

Usage:  python scripts/build-legal-pages.py you@example.com
The contact email replaces {{CONTACT_EMAIL}}. No third-party packages needed.
"""
import html
import pathlib
import re
import sys

DOCS = pathlib.Path(__file__).resolve().parent.parent / "docs"
PAGES = [("privacy-policy.md", "privacy-policy.html"), ("terms.md", "terms.html")]

CSS = """
:root{--bg:#0b0d10;--fg:#e8edf2;--muted:#9aa6b2;--line:#1e252d;--accent:#00C896}
@media (prefers-color-scheme: light){:root{--bg:#fff;--fg:#111821;--muted:#56616d;--line:#e3e8ee;--accent:#00916d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 20px 80px}h1{font-size:30px;line-height:1.2;margin:0 0 8px}
h2{font-size:20px;margin:36px 0 8px}a{color:var(--accent)}hr{border:0;border-top:1px solid var(--line);margin:32px 0}
table{width:100%;border-collapse:collapse;font-size:14px;display:block;overflow-x:auto}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{background:color-mix(in srgb,var(--line) 60%,transparent)}li{margin:4px 0}.meta p{margin:2px 0;color:var(--muted)}
nav{font-size:14px;margin-bottom:24px}nav a{margin-right:16px}
"""


def inline(text: str) -> str:
    text = html.escape(text, quote=False)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)
    return text


def render(md: str) -> tuple[str, str]:
    out, title, para, i = [], "TallyShot", [], 0
    lines = md.splitlines()

    def flush():
        if para:
            out.append(f"<p>{inline(' '.join(para))}</p>")
            para.clear()

    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            flush()
        elif line.startswith("# "):
            flush(); title = line[2:].strip(); out.append(f"<h1>{inline(title)}</h1>")
        elif line.startswith("## "):
            flush(); out.append(f"<h2>{inline(line[3:])}</h2>")
        elif line.strip() == "---":
            flush(); out.append("<hr>")
        elif line.startswith("- "):
            flush(); items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(f"<li>{inline(lines[i][2:])}</li>"); i += 1
            out.append("<ul>" + "".join(items) + "</ul>"); continue
        elif line.startswith("|"):
            flush(); rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            head, body = rows[0], rows[1:]
            t = "<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
            t += "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body)
            out.append(t + "</tbody></table>"); continue
        else:
            para.append(line.strip())
        i += 1
    flush()
    return title, "\n".join(out)


def main():
    if len(sys.argv) < 2 or "@" not in sys.argv[1]:
        sys.exit("Usage: python scripts/build-legal-pages.py you@example.com")
    email = sys.argv[1]
    for src, dst in PAGES:
        md = (DOCS / src).read_text(encoding="utf-8").replace("{{CONTACT_EMAIL}}", f"[{email}](mailto:{email})")
        title, body = render(md)
        page = f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title>
<style>{CSS}</style></head><body><main>
<nav><a href="privacy-policy.html">Privacy Policy</a><a href="terms.html">Terms of Use</a></nav>
{body}
</main></body></html>
"""
        (DOCS / dst).write_text(page, encoding="utf-8")
        print(f"wrote docs/{dst}")


if __name__ == "__main__":
    main()

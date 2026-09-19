"""Cache-busting rewrite used at deploy time (see .github/scripts/cache_bust.py)."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".github", "scripts"))
from cache_bust import add_cache_busting, file_hash  # noqa: E402

with tempfile.TemporaryDirectory() as pub:
    os.makedirs(os.path.join(pub, "js"))
    for name, body in {"app.css": "a{}", "js/core.js": "1", "personal-foods.js": "2"}.items():
        with open(os.path.join(pub, name), "w") as handle:
            handle.write(body)
    html = (
        '<link rel="stylesheet" href="app.css">\n'
        '<link rel="icon" href="favicon.svg">\n'
        '<script src="js/core.js"></script>\n'
        '<script src="personal-foods.js"></script>\n'
        '<script src="js/missing.js"></script>\n'
        '<script src="https://cdn.example.com/x.js"></script>\n'
        '<link href="app.css?v=old" rel="stylesheet">\n'
    )
    out = add_cache_busting(html, pub)
    assert f'href="app.css?v={file_hash(os.path.join(pub, "app.css"))}"' in out
    assert f'src="js/core.js?v={file_hash(os.path.join(pub, "js/core.js"))}"' in out
    assert f'src="personal-foods.js?v={file_hash(os.path.join(pub, "personal-foods.js"))}"' in out
    assert 'href="favicon.svg"' in out, "non js/css links are untouched"
    assert 'src="js/missing.js"' in out, "files that do not exist are left alone"
    assert 'src="https://cdn.example.com/x.js"' in out, "remote scripts are untouched"
    assert 'app.css?v=old' in out, "an existing query string is not double-stamped"
    # changing a file changes its URL
    with open(os.path.join(pub, "app.css"), "w") as handle:
        handle.write("a{color:red}")
    assert add_cache_busting(html, pub) != out
    # the real index.html: every local reference resolves and gets a hash
    real = open(os.path.join(os.path.dirname(__file__), "..", "public", "index.html"), encoding="utf-8").read()
    busted = add_cache_busting(real, os.path.join(os.path.dirname(__file__), "..", "public"))
    import re
    refs = re.findall(r'(?:src|href)="((?:js/)?[^"/?]+\.(?:js|css))\?v=[0-9a-f]{10}"', busted)
    assert "app.css" in refs and "js/core.js" in refs and "personal-foods.js" in refs, refs
print("PASS: deploy cache-busting stamps local .js/.css references with content hashes.")

"""
Cache-busting for the deployed index.html.

Static files are cached hard by browsers; without this, a visitor can end up
with new HTML running against an old app.css/JS after a deploy. At deploy time
every local <script src> / <link href> in index.html gets ?v=<content hash>,
so a changed file always has a new URL. The repo copy of index.html is left
untouched -- only the uploaded copy is rewritten.
"""
import hashlib
import os
import re

_REF = re.compile(r'''(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?#]+\.(?:js|css))(")''')


def file_hash(path):
    with open(path, "rb") as handle:
        return hashlib.sha1(handle.read()).hexdigest()[:10]


def add_cache_busting(html, public_dir):
    """Returns html with ?v=<hash> on every local .js/.css reference that exists."""

    def replace(match):
        prefix, ref, suffix = match.groups()
        if ref.startswith(("http:", "https:", "//")):
            return match.group(0)
        path = os.path.join(public_dir, ref)
        if not os.path.isfile(path):
            return match.group(0)
        return f"{prefix}{ref}?v={file_hash(path)}{suffix}"

    return _REF.sub(replace, html)

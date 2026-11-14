# Web renderer Phase 4

Run from the repository root:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/web/`.

Character GIFs are optional. If present, place them under `web/characters/Mute/` and `web/characters/Ed/`.

## Messages portraits (v0.23)
Messages mode uses tiny static portraits. Bundled SVG fallbacks live at `characters/Mute/message.svg` and `characters/Ed/message.svg`. Optional `message.webp` files in the same folders are preferred when present. Animated motion GIFs are only fetched when Companions mode actually renders them.

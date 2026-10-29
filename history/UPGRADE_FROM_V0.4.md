# Upgrade from Web v0.4 (Phase 3) to v0.5 (Phase 4)

Keep your existing `web/content/`, `web/library.json`, and series `meta.json` files.

Replace these files from the v0.5 package:

- `web/index.html`
- `web/app.js`
- `web/styles.css`

Add this new file:

- `web/character.js`

Add these asset folders if you want the real Mute/Ed animations:

- `web/characters/Mute/`
- `web/characters/Ed/`

Copy the same optimized GIFs used by the Chrome extension.

Mute:
- normal.gif
- thinking.gif
- explain.gif
- serious.gif
- realize.gif
- confused.gif

Ed:
- normal.gif
- curious.gif
- ask.gif
- skeptical.gif
- surprised.gif
- smug.gif

If the GIFs are absent, the renderer falls back to simple M/E character circles, so the site still works.

## Local test

From the repository root:

```bash
python -m http.server 8000
```

Open:

`http://localhost:8000/web/`

## Git update

After checking the local page:

```bash
git status
git add web/index.html web/app.js web/styles.css web/character.js web/characters
git commit -m "Add phase 4 nocturnal character stage"
git push
```

Do not replace or delete your own `web/content/` folder.

# Upgrade from v0.7

Keep your existing `web/content/`, `web/library.json`, metadata, and character GIF folders.

Replace only:

- `web/index.html`
- `web/app.js`
- `web/styles.css`

No changes to `core.js` or `character.js` are required.

After replacement, test locally with:

```bash
python -m http.server 8000
```

Then commit:

```bash
git status
git add web/index.html web/app.js web/styles.css
git commit -m "Refine cast quiz and quiet reading flow"
git push
```

For DIALOGUE thumbnails, prefer paths relative to the series folder, e.g. `assets/seojin.webp`.

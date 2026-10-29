# Upgrade from v0.9

Do not replace your `web/content/` folder or `web/library.json`.

## 1. Preserve your current study page

The old `web/index.html` was the Study View. In v0.10 that role moves to `web/study.html`.

Copy these files from this package into your repository:

### Replace
- `web/index.html`
- `web/categories.json`

### Add
- `web/study.html`
- `web/front.css`
- `web/front.js`
- `web/shelf.html`
- `web/shelf.css`
- `web/shelf.js`
- `web/auxiliary.html`
- `web/auxiliary.css`
- `web/auxiliary.js`
- `web/about.json`

Your existing `web/app.js`, `web/styles.css`, `web/character.js`, `web/characters/`, `web/content/`, and `web/library.json` remain unchanged.

## 2. Local test

```bash
python -m http.server 8000
```

Open `http://localhost:8000/web/`.

Check:
- zodiac ring movement
- `Enter shelf`
- Shelf lecture links open `study.html`
- Search can find a series/lecture
- existing Study View still works

## 3. Git

```bash
git status
git add web/index.html web/study.html web/front.css web/front.js web/shelf.html web/shelf.css web/shelf.js web/auxiliary.html web/auxiliary.css web/auxiliary.js web/about.json web/categories.json
git commit -m "Add Nocturne library front and shelves"
git push
```

## Optional metadata

For accurate Recent ordering, add ISO dates to series metadata when convenient:

```json
"createdAt": "2026-10-29",
"updatedAt": "2026-10-29"
```

This is optional; the front works without them.

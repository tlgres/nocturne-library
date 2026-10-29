# Upgrade from Nocturne Library Web v0.6 Design Pass 1

Keep all of your own content and metadata.

Replace only:

```text
web/index.html
web/app.js
web/styles.css
```

`web/character.js`, `core.js`, `web/content/`, `web/library.json`, `web/categories.json`, series `meta.json`, and character GIF assets do not need to change.

After replacing the three files, test locally:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/web/`.

If it looks correct, commit only the changed renderer files:

```bash
git status
git add web/index.html web/app.js web/styles.css
git commit -m "Fix study viewport and reader controls"
git push
```

## New local preferences

The browser stores only small UI preferences:

- reader font family
- reader font size
- reader line height
- Focus mode state
- Dialogue Flow / Transcript preference
- existing last-read section index

No lecture content or quiz answers are stored by these new preferences.

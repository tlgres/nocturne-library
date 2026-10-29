# Upgrade from Web v0.2 to v0.3 Phase 2

If your repository already contains your own lecture files, do **not** replace the whole repository blindly.

## Replace these files

Copy these files from v0.3 over the corresponding files in your existing repository:

- `web/app.js`
- `web/styles.css`
- `web/index.html`
- `README.md` (optional; documentation only)

`core.js`, `categories.json`, `library.json`, and your existing `web/content/` do not need to be replaced for this phase.

## Optional demo

The package also contains:

- `web/content/philosophy/nocturne-example/03.md`
- an updated example `meta.json`

These are only for testing Phase 2 and are not required in your real library.

## Test locally

From the repository root:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/web/` and test CLOZE / CAST / QUIZ in one of your own lectures.

## Push to GitHub after testing

From the repository root:

```bash
git status
git add web/app.js web/styles.css web/index.html
git commit -m "Add renderer phase 2 interactions"
git push
```

If you also intentionally changed lecture content or metadata, add those files too before committing.

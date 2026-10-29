# Upgrade from Web v0.5 / Phase 4

Do not replace your `web/content/`, `web/library.json`, or series metadata.

Copy only these files from this package into the same paths in your existing repository:

```text
web/styles.css
web/app.js
web/index.html
```

`web/character.js`, `core.js`, your character GIFs, categories, library catalog, and lecture content do not need to change for this design pass.

Test locally from the repository root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/web/
```

If the design and interactions look correct, commit the three changed files:

```bash
git status
git add web/styles.css web/app.js web/index.html
git commit -m "Refine Nocturne study view design"
git push
```

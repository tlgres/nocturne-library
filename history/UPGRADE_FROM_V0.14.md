# Upgrade from v0.14

GitHub Pages hotfix for the shared Nocturne Core.

Replace/add these files in the repository:

- `web/core.js` (new public copy of the shared Core)
- `web/study.html`
- `tools/wizard/index.html`

Why: GitHub Pages deploys only `web/`, so the old `study.html -> ../core.js` reference pointed outside the deployed artifact and returned 404. The Wizard now also references the same `web/core.js` so there is a single runtime Core path.

After copying:

```bash
git add web/core.js web/study.html tools/wizard/index.html
git commit -m "Fix Pages core path"
git push
```

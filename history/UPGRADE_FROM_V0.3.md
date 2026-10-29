# Upgrade from v0.3 Phase 2

Keep your existing `web/content/`, `web/library.json`, and `web/categories.json`.

Replace only:

- `web/app.js`
- `web/styles.css`
- `web/index.html`

Phase 3 adds DIALOGUE rendering with Flow/Transcript modes, narrator strips, multi-speaker layout, and optional speaker metadata.

Optional speaker profiles can be declared in a series `meta.json`:

```json
{
  "dialogueSpeakers": {
    "A": {"name": "Bertrand", "thumbnail": "assets/bertrand.webp"},
    "B": {"name": "Elaine", "thumbnail": "assets/elaine.webp"}
  }
}
```

Lecture-level `dialogueSpeakers` overrides the series-level value for that lecture. Image paths are resolved by the browser as written, so prefer paths that are valid from `web/index.html` or absolute site paths.

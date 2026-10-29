# Upgrade from v0.12

Replace these files in your existing repository:

- `web/study.html`
- `web/app.js`
- `web/styles.css`
- `web/front.css`

Do not replace `web/content/`, `web/library.json`, character GIFs, or Wizard data.

## Changes
- KaTeX rendering for `\[...\]`, `\(...\)`, `$$...$$`, `$...$` in Study View.
- Study selectors are now category -> series -> lecture instead of one global series list.
- Home link underline removed.
- Front header truly overlays the star field; zodiac nodes shifted downward and closer to category details.

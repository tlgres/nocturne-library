# Upgrade from v0.13 to v0.14

Replace only:

- `web/app.js`
- `web/styles.css`
- `web/front.css`

Your `web/content/`, metadata, characters, Wizard files, and library catalog do not need to change.

## Fixes

- Display math delimited by `\\[ ... \\]` or `$$ ... $$` is protected before paragraph splitting, so multiline equations render through KaTeX instead of appearing as raw TeX.
- Added a dedicated horizontally-scrollable display-math container for very wide equations.
- Lowered the entire zodiac ring assembly and orbit line while increasing its viewport height to avoid top clipping.

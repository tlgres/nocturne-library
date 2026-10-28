# Web Reader Phase 1

`index.html`은 static hosting만으로 동작한다. 별도 npm/build step이 없다.

현재 Reader가 직접 사용하는 파일:

- `../core.js` — Nocturne Format parser
- `categories.json` — canonical 12 categories
- `library.json` — published series index
- `content/**/meta.json` — series metadata
- `content/**/*.md` — lecture sources

GitHub Pages에서 repository root를 배포하면 `/web/`가 Reader entry point가 된다.

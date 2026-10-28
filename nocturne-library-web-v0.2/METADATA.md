# Nocturne Library Metadata 1.0

Nocturne Format 1.0은 개별 강의 문서의 내용 구조를 정의한다. Library metadata는 시리즈를 탐색하고 강의 순서를 계산하기 위한 별도 계층이다.

## Category registry

`web/categories.json`이 12개 canonical category의 유일한 정의다. 각 category는 `slug`, 한국어명, 영문명, constellation을 가진다. constellation은 현재 navigation 의미론에는 영향을 주지 않으며 향후 visual identity에 사용할 수 있다.

Canonical order:

1. basic-med — 기초의학 — Basic Medicine — Virgo
2. clin-med — 임상의학 — Clinical Medicine — Pisces
3. science — 자연과학 — Natural Sciences — Capricorn
4. math-cs — 수학·전산 — Mathematics & Computing — Scorpio
5. language — 어학·언어 — Language & Linguistics — Gemini
6. history — 역사·지리 — History & Geography — Taurus
7. philosophy — 철학·사상 — Philosophy & Thought — Aquarius
8. religion — 신비·종교 — Mysticism & Religion — Sagittarius
9. law — 법학·제도 — Law & Institutions — Libra
10. pol-econ — 정치·경제 — Politics & Economics — Leo
11. soc-edu — 사회·교육 — Society & Education — Cancer
12. culture — 교양·처세 — Culture — Aries

## Series layout

```text
web/content/<category-slug>/<series-id>/
  meta.json
  01.md
  02.md
  ...
```

## meta.json

Minimal example:

```json
{
  "schemaVersion": 1,
  "id": "topology-theology",
  "title": "위상신학",
  "category": "philosophy",
  "description": "시리즈 설명",
  "language": "ko",
  "status": "ongoing",
  "lectures": [
    {"id":"01","file":"01.md","title":"첫 강의"},
    {"id":"02","file":"02.md","title":"두 번째 강의"}
  ]
}
```

`id`는 Library 안에서 안정적으로 유지하는 것을 권장한다. `category`는 categories.json의 slug를 사용한다. `lectures` 배열 순서가 공식 강의 순서다. 파일명 자체의 정렬 순서에 의존하지 않는다.

## library.json

GitHub Pages는 directory listing을 제공하지 않으므로 `web/library.json`이 현재 공개된 series의 작은 index 역할을 한다.

```json
{
  "version": 1,
  "series": [
    {"path":"content/philosophy/topology-theology","meta":"content/philosophy/topology-theology/meta.json"}
  ]
}
```

초기에는 수동으로 한 줄씩 추가한다. 시리즈가 많아지면 이 파일을 자동 생성하는 작은 build script를 추가할 수 있다.

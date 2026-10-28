# Nocturne Library Web — Reader Phase 1

Nocturne Core를 사용하는 첫 번째 정적 웹 Reader다.

## 현재 구현

- Nocturne Format 1.0 Core
- 12개 canonical category registry + constellation metadata
- 시리즈별 `meta.json`
- `library.json` 기반 정적 catalog
- NORMAL / FAST / FOCUS / STOP / SIDE Reader rendering
- `■` chapter opening
- section progress bar + 클릭 이동
- Prev / Next section
- 키보드 ← / → / Space
- 이전 / 다음 lecture
- lecture / series selector
- 마지막 읽던 section을 localStorage에 초경량 저장
- URL query로 series / lecture deep-link

CAST / QUIZ / CLOZE / DIALOGUE / character stage는 의도적으로 아직 렌더링하지 않는다. 해당 block이 있으면 phase 2 이후 지원 예정이라는 안내만 표시한다.

## 로컬 실행

repository root에서:

```bash
python -m http.server 8000
```

그 뒤:

```text
http://localhost:8000/web/
```

## 새 시리즈 추가

1. `web/content/<category>/<series-id>/` 폴더를 만든다.
2. `meta.json`과 `01.md`, `02.md` ... 를 넣는다.
3. `web/library.json`에 series path와 meta path를 한 줄 추가한다.

자세한 metadata 규칙은 `METADATA.md`, 문서 문법은 `FORMAT.md`를 본다.

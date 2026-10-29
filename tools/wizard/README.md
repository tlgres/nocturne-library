# Authoring Wizard v0.1

## 실행
Repository 루트에서 정적 서버를 실행합니다.

```bash
python -m http.server 8000
```

Chrome/Edge에서 다음 주소를 엽니다.

```text
http://localhost:8000/tools/wizard/
```

`Repository 폴더 선택`에서 현재 `nocturne-library` repository의 루트 폴더를 선택합니다. Wizard는 `web/library.json`과 `web/categories.json`을 확인한 뒤 Library tree를 구성합니다.

## v0.1 기능
- Repository 선택 및 최근 handle 재연결
- category/series/lecture tree
- 새 시리즈 생성
- 새 강의 추가 및 기존 강의 수정
- Nocturne Format 1.0 validation
- title, next lecture ID/file 자동 제안
- semantic preview
- DIALOGUE speaker name/thumbnail metadata 관리
- `.md` 저장
- `meta.json` 자동 갱신
- 새 series 생성 시 `library.json` 자동 갱신
- createdAt / updatedAt 자동 관리

Git commit/push는 자동화하지 않습니다.

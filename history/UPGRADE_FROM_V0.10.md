# Upgrade from v0.10

이번 버전은 Front/브랜딩 패스입니다. 기존 `web/content/`, `web/library.json`, 캐릭터 GIF는 그대로 보존하세요.

교체/추가할 파일:

- web/index.html
- web/front.css
- web/front.js
- web/study.html
- web/styles.css
- web/shelf.html
- web/shelf.css
- web/shelf.js
- web/auxiliary.html
- web/auxiliary.css
- web/auxiliary.js
- web/about.json

핵심 변경:

- 사이트 표시 이름을 `해체된 의미의 서재`로 변경
- Front 기본 폰트를 sans-serif로 변경
- 배경을 조금 더 밝은 청색 우주 톤으로 조정
- 12개 카테고리를 원형 노드로 변경하고 5개까지 노출
- 3D ring에 기울기와 orbit line 추가
- 별자리 영문명 UI 숨김
- 화면 우측에 관측소/유성 기록/궤도 문헌실 column 추가
- 세 공간은 Front에서 modal popup으로 열림
- 관측소에 블로그의 기존 소개문 추가
- Study의 Library 버튼을 `◁ Home`으로 변경
- 사용자-facing 버튼을 가능한 범위에서 한글화

로컬 테스트 후:

```bash
git status
git add web/index.html web/front.css web/front.js web/study.html web/styles.css web/shelf.html web/shelf.css web/shelf.js web/auxiliary.html web/auxiliary.css web/auxiliary.js web/about.json
git commit -m "Redesign front and rebrand library"
git push
```

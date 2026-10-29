# Upgrade from v0.11

이번 버전은 기존 Library/Study 기능을 거의 건드리지 않고 Authoring Wizard를 추가합니다.

기존 repository에 다음 폴더 전체를 추가하세요.

```text
tools/wizard/
```

그리고 pending visual polish를 함께 적용하려면 `web/front.css`, `web/styles.css`도 교체할 수 있습니다.

Git 예시:

```bash
git add tools/wizard web/front.css web/styles.css
git commit -m "Add authoring wizard"
git push
```

실행:

```bash
python -m http.server 8000
```

Chrome/Edge:

```text
http://localhost:8000/tools/wizard/
```

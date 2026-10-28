# Nocturne Core architecture

## Goal

Nocturne Format 1.0 문서를 ChatGPT Extension과 Web Library가 같은 의미 모델로 읽도록 한다.

```text
                Nocturne Format 1.0 (.md/text)
                           |
                        core.js
                           |
              Nocturne document / block model
                    /                 \
          ChatGPT Extension          Web Library
          HTML/math hydration        Markdown renderer
```

## Modules

### core.js — shared, platform-independent

DOM이나 Chrome API를 사용하지 않는다.

- Format 1.0 block parsing
- NORMAL / FAST / FOCUS / STOP / SIDE
- CAST parsing
- DIALOGUE parsing
- QUIZ parsing
- SERIES_END
- CLOZE token segmentation helper
- `\|` literal-pipe handling for field syntax
- long plain-text splitting
- lightweight validation

`globalThis.NocturneCore` 및 `globalThis.NocturneStudy.Core`로 노출된다.

### dialogue.js — presentation helper

Core의 dialogue parser를 재사용하고, renderer가 필요한 speaker ordering helper만 제공한다.

### character.js — extension presentation/runtime

Mute/Ed asset mapping과 GIF animator를 담당한다. Format 1.0의 일부가 아니다.

### content.js — ChatGPT adapter + extension UI

- ChatGPT DOM turn collection
- rendered math/HTML hydration
- Study overlay
- controls / progress / notes / next-lecture automation
- Core를 호출해 Format 1.0 semantic parsing

ChatGPT 전용 코드는 향후 `adapters/chatgpt.js`와 `extension-ui.js`로 더 분리할 수 있다.

### web/

Core가 ChatGPT 없이 `.md`를 읽는 최소 정적 웹 starter. 최종 Nocturne Library UI가 아니라 Core 검증용이다.

## Shared model shape

`Core.parseDocument(source)`는 대략 다음을 반환한다.

```js
{
  formatVersion: '1.0',
  title: '...',
  seriesEnded: false,
  blocks: [
    { type: 'normal', content: '...' },
    { type: 'focus', content: '...' },
    { type: 'cast', speaker: 'ED', expression: 'curious', content: '...' },
    { type: 'dialogue', dialogue: { entries: [...], speakers: [...] }, content: '...' },
    { type: 'quiz', quiz: {...}, content: '...' }
  ]
}
```

HTML, GIF, colors, thumbnail, progress UI는 이 모델에 포함하지 않는다.

## Compatibility rule

Format 1.x에서 1.0 문법의 의미는 변경하지 않는다. 새 기능은 새 token/optional field로 확장하고 구형 renderer는 fail-soft 해야 한다.

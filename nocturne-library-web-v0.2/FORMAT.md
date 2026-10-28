# Nocturne Format 1.0

Nocturne Format is a Markdown-based authoring format for interactive lectures rendered by Nocturne Study. It separates lecture content from presentation so that the same source can be rendered by a Chrome extension, a web reader, an archive view, or future compatible renderers.

Version: 1.0

## 1. Design principles

1. A Nocturne document is valid Markdown with a small set of `[[...]]` extensions.
2. Content semantics belong in the source; visual styling, animation, character assets, colors, and layout belong to the renderer.
3. The format is intentionally small. New semantics should be added in later format versions rather than changing the meaning of 1.0 constructs.
4. Renderers should fail softly. A malformed optional interaction must not make the whole lecture unreadable.
5. Most lecture prose should remain ordinary `NORMAL` content. Interactive constructs exist to improve pacing and recall, not to replace the lecture.

## 2. Document structure

The first non-empty line MUST be a Markdown H1 title.

```text
# Lecture title
```

After the title, lecture content SHOULD be written using Nocturne blocks. Blank lines between blocks are allowed.

Canonical keywords are uppercase ASCII.

## 3. Reading blocks

Nocturne Format 1.0 defines five reading blocks.

```text
[[NORMAL]]
Ordinary lecture prose.
[[END]]

[[FAST]]
Background, review, or material that may be read quickly.
[[END]]

[[FOCUS]]
A central concept, argument, distinction, or result requiring increased attention.
[[END]]

[[STOP]]
A point at which the reader should pause and think before continuing.
[[END]]

[[SIDE]]
Supplementary material or a useful digression outside the main line of argument.
[[END]]
```

Semantic meanings are fixed:

- `NORMAL`: default reading pace.
- `FAST`: reduced-attention reading is acceptable.
- `FOCUS`: increased attention is recommended.
- `STOP`: deliberate pause or reflection is requested.
- `SIDE`: supplementary or tangential information.

A renderer MAY visually distinguish these blocks but MUST NOT change their semantic meaning.

## 4. Chapter openings

A chapter or subsection opening is written as a line beginning with `■`.

```text
[[NORMAL]]
■ Darwin 이후에도 창세기를 읽을 수 있는가

본문...
[[END]]
```

Rules:

- The chapter heading SHOULD be the first non-empty line of a reading block.
- A reading block SHOULD contain at most one chapter heading.
- The source retains the literal `■` marker.
- Renderers MAY transform it into a richer chapter-opening component.
- Chapter openings are structural markers, not a sixth reading-block type.

## 5. Markdown inside blocks

Standard Markdown MAY be used inside reading blocks, including paragraphs, emphasis, lists, block quotes, code, and mathematical notation supported by the renderer.

Nocturne block markers MUST NOT be placed inside fenced code blocks or mathematical source where they are intended to be displayed literally.

## 6. CLOZE inline syntax

`CLOZE` is the only Nocturne 1.0 construct that may appear inline inside ordinary block content.

Without a hint:

```text
Atropa belladonna의 주요 alkaloid인 [[CLOZE|atropine]]은 muscarinic receptor를 차단한다.
```

With a hint:

```text
Atropa belladonna의 주요 alkaloid인 [[CLOZE|atropine|약물명]]은 muscarinic receptor를 차단한다.
```

Fields:

1. answer — required
2. hint — optional

Renderers SHOULD initially conceal the answer and reveal it on reader action. Fast/read-only renderers MAY reveal CLOZE answers automatically.

CLOZE SHOULD be used sparingly, normally 0–2 times per reading block.

## 7. Field separator and escaping

Several Nocturne constructs use the ASCII vertical bar `|` as a field separator.

A literal vertical bar inside a field MUST be escaped as:

```text
\|
```

Example:

```text
MUTE|explain|A \| B라는 표기는 여기서는 두 항의 구분을 뜻한다.
```

A parser MUST split fields only on unescaped `|` characters and MUST convert `\|` to a literal `|` after field splitting.

Backslashes that do not escape `|` MUST be preserved. This is important for LaTeX and other Markdown content. For example, `\frac`, `\partial`, and `\text` MUST remain unchanged.

Canonical records are one physical line per record. Authors SHOULD NOT place a line break inside a single field.

## 8. CAST

`CAST` represents comments or reactions by Nocturne companion characters who exist outside the lecture's internal narrative.

```text
[[CAST]]
ED|curious|그런데 이 경우에는 어떻게 되는 거야?
MUTE|thinking|조건을 하나 더 봐야겠군.
[[ENDCAST]]
```

Each record has exactly three fields:

```text
SPEAKER|MOTION|TEXT
```

The motion field MAY be empty:

```text
ED||그건 왜 그래?
```

Format 1.0 defines `MUTE` and `ED` as the canonical companion speaker identifiers used by the reference renderer. Other renderers MAY map these identifiers to different visual assets without changing the source.

CAST semantics:

- CAST is not the lecture's main prose.
- CAST SHOULD follow the content to which it reacts.
- CAST SHOULD favor questions, objections, brief confirmations, humor, or an additional angle.
- CAST SHOULD NOT merely repeat the preceding prose.
- A lecture SHOULD remain substantially intelligible if CAST is hidden.

## 9. DIALOGUE

`DIALOGUE` is used when dialogue among characters is itself part of the lecture content.

```text
[[DIALOGUE]]
A|과학은 승리했습니까?
B|자연사에 관해서는 많이 이겼습니다.
NARRATOR|버트런드는 잠시 창밖을 바라보았다.
A|그런데?
B|문제는 그 다음입니다.
[[ENDDIALOGUE]]
```

Ordinary dialogue records have two fields:

```text
SPEAKER|TEXT
```

`NARRATOR` is the only reserved narrator identifier in Format 1.0.

Therefore `N`, `Nadia`, `Newton`, `Niels`, and all other names beginning with N are ordinary speaker identifiers.

Speaker identifiers MAY be symbolic (`A`, `B`, `C`) or names (`Darwin`, `Bertrand`, `Patient`).

Semantic distinction:

- `DIALOGUE`: characters inside the lecture or narrative are speaking.
- `CAST`: Nocturne companion characters outside that narrative are reacting to it.

Renderers MAY offer multiple presentations of the same DIALOGUE source, including sequential Flow mode and full Transcript mode. Such presentation modes are not part of the source format.

## 10. QUIZ

`QUIZ` is a hidden interaction block. It is not ordinary lecture prose and MAY be presented by a renderer only when the reader reaches the associated point.

Format 1.0 defines exactly three quiz types: `OX`, `MCQ`, and `RECALL`.

### 10.1 OX

```text
[[QUIZ]]
TYPE|OX
Q|Atropine은 muscarinic receptor antagonist이다.
A|O
WHY|Atropine은 대표적인 competitive muscarinic antagonist이다.
[[ENDQUIZ]]
```

Required fields:

- `TYPE|OX`
- `Q|statement`
- `A|O` or `A|X`

Optional field:

- `WHY|explanation`

`O` and `X` are the canonical answer values.

### 10.2 MCQ

```text
[[QUIZ]]
TYPE|MCQ
Q|Atropine 투여 후 예상되는 변화는?
A|축동
B|산동
C|조절력 증가
D|분비 증가
ANSWER|B
WHY|Muscarinic blockade로 sphincter pupillae가 이완된다.
[[ENDQUIZ]]
```

Required fields:

- `TYPE|MCQ`
- `Q|question`
- `A|option`
- `B|option`
- `C|option`
- `D|option`
- `ANSWER|A`, `ANSWER|B`, `ANSWER|C`, or `ANSWER|D`

Optional field:

- `WHY|explanation`

Format 1.0 MCQ is single-answer only.

### 10.3 RECALL

```text
[[QUIZ]]
TYPE|RECALL
Q|Atropine이 산동을 만드는 기전을 설명해보자.
A|Muscarinic blockade로 sphincter pupillae가 이완된다.
[[ENDQUIZ]]
```

Required fields:

- `TYPE|RECALL`
- `Q|prompt`
- `A|reference answer`

RECALL is intended for self-assessment. Format 1.0 does not define automatic natural-language scoring.

## 11. SERIES_END

The final lecture of a series MAY end with:

```text
[[SERIES_END]]
```

Rules:

- It SHOULD appear at the end of the document.
- It has no closing marker.
- It is metadata and MUST NOT be rendered as lecture prose.
- A renderer MAY use it to disable or hide "next lecture" generation or navigation.

## 12. Nesting rules

Nocturne 1.0 block constructs MUST NOT be nested inside one another.

Invalid example:

```text
[[FOCUS]]
...
[[CAST]]
...
[[ENDCAST]]
[[END]]
```

The only allowed Nocturne syntax inside a reading block is inline `CLOZE`.

CAST, DIALOGUE, and QUIZ are sibling blocks placed between reading blocks.

## 13. Canonical closing markers

Reading blocks:

```text
[[END]]
```

CAST:

```text
[[ENDCAST]]
```

DIALOGUE:

```text
[[ENDDIALOGUE]]
```

QUIZ:

```text
[[ENDQUIZ]]
```

`SERIES_END` has no closing marker.

## 14. Whitespace and keyword rules

Canonical markers contain no internal padding:

```text
[[FOCUS]]
```

not:

```text
[[ FOCUS ]]
```

Canonical keywords are uppercase. A tolerant parser MAY accept lowercase variants, but authors and generators SHOULD emit the canonical uppercase form.

Blank lines around and inside blocks are allowed.

## 15. Recommended authoring conventions

These are recommendations, not parser requirements.

- A reading block SHOULD normally remain below approximately 800–1200 Korean characters when practical.
- Long lectures SHOULD use chapter openings to expose their structure.
- Most prose SHOULD be NORMAL.
- FAST, FOCUS, and STOP SHOULD be used only when a change in reading pace is meaningful.
- A typical lecture MAY contain roughly 2–5 QUIZ interactions, but fewer is acceptable.
- CLOZE SHOULD target information worth actively recalling rather than decorative vocabulary.
- CAST SHOULD remain shorter than the lecture prose it accompanies.
- DIALOGUE MAY carry the main intellectual content when the lecture is intentionally dialogue-driven.
- Excessive line breaks SHOULD be avoided in prose; paragraphs should remain natural reading units.

## 16. Parser behavior and error recovery

A conforming renderer SHOULD fail softly.

Recommended behavior:

1. Unknown block keyword: preserve or expose its textual content where possible and emit a non-fatal warning.
2. Missing closing marker: recover at the next recognized top-level block marker or end of document when possible.
3. Malformed CAST/DIALOGUE record: skip or display the malformed record without aborting the document.
4. Malformed QUIZ: suppress the interactive quiz and preserve the rest of the lecture.
5. Unknown speaker or motion: use a renderer-defined fallback.
6. Unsupported Markdown or math: preserve readable source text when possible.

A malformed optional interaction MUST NOT make the main lecture unreadable.

## 17. Presentation is not part of Format 1.0

The following are explicitly renderer concerns and are NOT encoded by Nocturne Format 1.0:

- fonts and typography
- colors and lighting
- character GIF or image paths
- character animation speed
- character placement
- dialogue thumbnails
- Flow versus Transcript default mode
- window, library, or stage artwork
- progress-bar appearance
- sound
- local reading progress
- quiz animation
- web or extension navigation

This separation allows one Nocturne source document to be rendered by different clients without rewriting the lecture.

## 18. Minimal complete example

```text
# 항콜린 약물과 눈

[[NORMAL]]
■ 산동은 어떻게 일어나는가

Atropine은 [[CLOZE|muscarinic receptor|수용체]]를 차단한다. 안구에서는 sphincter pupillae의 부교감성 수축이 억제되어 동공이 확장된다.
[[END]]

[[CAST]]
ED|curious|그러면 가까운 게 흐려지는 것도 같은 이유야?
MUTE|thinking|같은 수용체 차단이지만 이번에는 ciliary muscle을 봐야겠군.
[[ENDCAST]]

[[FOCUS]]
■ 산동과 조절마비는 따로 생기는 현상이 아니다

Ciliary muscle의 muscarinic action이 차단되면 accommodation이 저하된다. 따라서 atropine의 mydriasis와 cycloplegia는 서로 무관한 두 부작용이 아니라 같은 약리작용이 서로 다른 구조에서 나타난 결과다.
[[END]]

[[QUIZ]]
TYPE|MCQ
Q|Atropine 투여 후 가장 직접적으로 예상되는 안과적 변화는?
A|축동과 조절력 증가
B|산동과 조절마비
C|축동과 조절마비
D|산동과 조절력 증가
ANSWER|B
WHY|Muscarinic blockade는 sphincter pupillae와 ciliary muscle의 부교감성 작용을 모두 억제한다.
[[ENDQUIZ]]
```

## 19. Versioning policy

This document defines Nocturne Format 1.0.

The semantics of constructs defined here SHOULD NOT be changed incompatibly within the 1.x series. New optional constructs may be introduced in later minor versions if old 1.x documents remain valid. Incompatible syntax or semantic changes require a new major format version.

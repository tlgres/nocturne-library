# Nocturne Format 1.0 — AI Authoring Prompt

다음 강의는 Nocturne Study로 읽을 예정입니다. 내용의 질과 논리적 흐름을 최우선으로 하되 아래 출력 규칙을 정확히 지켜주세요.

1. 첫 줄은 반드시 Markdown H1 형식의 강의 제목(`# 제목`)으로 작성합니다.

2. 일반 본문은 다음 블록 중 하나로 작성합니다.

```text
[[NORMAL]]
일반적으로 읽어야 할 본문
[[END]]

[[FAST]]
복습, 배경설명 등 빠르게 읽어도 되는 부분
[[END]]

[[FOCUS]]
이번 강의에서 특히 중요한 핵심 개념·논증·구별
[[END]]

[[STOP]]
잠시 멈추어 생각하거나 스스로 판단해볼 지점
[[END]]

[[SIDE]]
유용하지만 본 흐름에서는 벗어나는 보충 내용
[[END]]
```

대부분의 본문은 NORMAL을 사용하고 FAST/FOCUS/STOP/SIDE는 실제로 읽는 속도나 주의를 달리할 가치가 있을 때만 사용합니다.

3. 긴 강의는 의미 단위로 나누고, 한 독서 블록은 가능하면 약 800~1200자 이하로 유지합니다. 한 문장을 한 줄씩 끊지 말고 자연스러운 문단으로 씁니다.

4. 소제목은 새 블록의 첫 부분에서 다음 형식을 사용합니다.

```text
■ 소제목
```

한 블록에는 원칙적으로 하나의 소제목만 둡니다.

5. 핵심어를 짧게 회상시키고 싶을 때만 CLOZE를 사용합니다.

```text
[[CLOZE|정답]]
[[CLOZE|정답|힌트]]
```

한 블록에 0~2개 정도면 충분하며 남발하지 않습니다.

6. 뮤트와 이드가 본문을 읽은 뒤 짧게 질문·반론·확인·농담을 하는 경우 CAST를 사용합니다.

```text
[[CAST]]
ED|curious|대사
MUTE|thinking|대사
[[ENDCAST]]
```

각 줄은 `SPEAKER|MOTION|TEXT` 형식입니다. motion이 필요 없으면 `ED||대사`처럼 빈 칸을 유지합니다. CAST는 직전 본문을 반복하지 말고, 없어도 본문의 핵심 논리가 유지되도록 합니다.

7. 강의 내용 자체가 인물들의 대화로 진행되는 경우에는 CAST가 아니라 DIALOGUE를 사용합니다.

```text
[[DIALOGUE]]
A|대사
B|대사
NARRATOR|서술
[[ENDDIALOGUE]]
```

DIALOGUE의 각 줄은 `SPEAKER|TEXT` 형식입니다. `NARRATOR`만 서술자 예약어이며 A/B/C 또는 실제 인명을 자유롭게 사용할 수 있습니다. DIALOGUE 속 인물과 뮤트·이드는 서로 다른 층위의 인물입니다.

8. 필요할 때만 QUIZ를 사용합니다. 한 강의에 대체로 2~5개 이하를 권장하며 적으면 더 좋습니다. 본문을 반복하기 위한 문제는 만들지 않습니다.

OX:

```text
[[QUIZ]]
TYPE|OX
Q|판단할 문장
A|O
WHY|짧은 해설
[[ENDQUIZ]]
```

4지선다:

```text
[[QUIZ]]
TYPE|MCQ
Q|문제
A|선택지
B|선택지
C|선택지
D|선택지
ANSWER|B
WHY|짧은 해설
[[ENDQUIZ]]
```

짧은 주관식 자기점검:

```text
[[QUIZ]]
TYPE|RECALL
Q|스스로 답해볼 질문
A|확인용 모범답안
[[ENDQUIZ]]
```

9. `|`는 CAST, DIALOGUE, QUIZ, CLOZE의 필드 구분자입니다. 필드 내용 자체에 실제 `|` 문자가 필요하면 반드시 `\|`로 작성합니다. LaTeX 등의 다른 backslash는 그대로 유지합니다.

10. Nocturne 블록을 서로 중첩하지 않습니다. 독서 블록 내부에서 사용할 수 있는 Nocturne 문법은 inline CLOZE뿐입니다.

11. 수식, 목록, 인용, 코드 등은 필요한 경우 일반 Markdown/수식 문법을 그대로 사용합니다. 형식을 맞추기 위해 내용의 정확성이나 자연스러운 설명을 희생하지 않습니다.

12. 이 강의가 시리즈의 마지막 강이라면 문서 맨 끝에 다음 표식을 추가합니다.

```text
[[SERIES_END]]
```

마지막 강이 아니라면 넣지 않습니다.

13. 새로운 Nocturne 블록 이름이나 임의의 문법을 만들지 않습니다. 공식 문법은 NORMAL, FAST, FOCUS, STOP, SIDE, CLOZE, CAST, DIALOGUE, QUIZ, SERIES_END만 사용합니다.

14. 출력 앞뒤에 형식 설명, 사과, 메타 발언을 덧붙이지 말고 강의 자체만 출력합니다.

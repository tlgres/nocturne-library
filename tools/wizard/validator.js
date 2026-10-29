(() => {
  const OPEN = new Set(['NORMAL','FAST','FOCUS','STOP','SIDE','CAST','QUIZ','DIALOGUE']);
  const CLOSE_FOR = { END:['NORMAL','FAST','FOCUS','STOP','SIDE'], ENDCAST:['CAST'], ENDQUIZ:['QUIZ'], ENDDIALOGUE:['DIALOGUE'] };

  function issue(level, code, message, extra = {}) { return { level, code, message, ...extra }; }

  function rawBlocks(source) {
    const re = /\[\[(NORMAL|FAST|FOCUS|STOP|SIDE|CAST|QUIZ|DIALOGUE|END|ENDCAST|ENDQUIZ|ENDDIALOGUE|SERIES_END)\]\]/gi;
    const tokens = [...String(source || '').matchAll(re)];
    const blocks = [];
    let active = null;
    let cursor = 0;
    for (const token of tokens) {
      const between = source.slice(cursor, token.index);
      if (active) active.content += between;
      const kind = token[1].toUpperCase();
      if (OPEN.has(kind)) {
        if (active) blocks.push({ ...active, malformed:'nested' });
        active = { type:kind, start:token.index, content:'' };
      } else if (kind !== 'SERIES_END') {
        if (active) { blocks.push(active); active = null; }
      }
      cursor = token.index + token[0].length;
    }
    if (active) blocks.push({ ...active, malformed:'unclosed' });
    return blocks;
  }

  function checkStructure(source, issues) {
    const tokenRe = /\[\[([A-Z_]+)\]\]/gi;
    const stack = [];
    const knownClose = new Set(Object.keys(CLOSE_FOR));
    let seriesEndAt = -1;
    for (const m of String(source || '').matchAll(tokenRe)) {
      const kind = m[1].toUpperCase();
      if (OPEN.has(kind)) {
        if (stack.length) issues.push(issue('error','nested-block',`블록 ${kind}가 ${stack.at(-1).kind} 내부에 중첩되어 있습니다.`));
        stack.push({ kind, index:m.index });
      } else if (knownClose.has(kind)) {
        const current = stack.pop();
        if (!current) { issues.push(issue('error','orphan-close',`${kind} 종료 표식에 대응하는 시작 블록이 없습니다.`)); continue; }
        if (!CLOSE_FOR[kind].includes(current.kind)) issues.push(issue('error','wrong-close',`${current.kind} 블록이 ${kind}로 닫혔습니다.`));
      } else if (kind === 'SERIES_END') {
        seriesEndAt = m.index;
      }
    }
    for (const item of stack) issues.push(issue('error','unclosed-block',`${item.kind} 블록이 닫히지 않았습니다.`));
    if (seriesEndAt >= 0 && String(source).slice(seriesEndAt + '[[SERIES_END]]'.length).trim()) issues.push(issue('warning','content-after-series-end','SERIES_END 뒤에 내용이 있습니다.'));
  }

  function parseFields(text) {
    const fields = {};
    for (const line of String(text || '').replace(/\r/g,'').split(/\n+/)) {
      const parts = globalThis.NocturneCore.splitEscapedPipes(line);
      if (parts.length < 2) continue;
      const key = String(parts.shift()).trim().toUpperCase();
      fields[key] = parts.join('|').trim();
    }
    return fields;
  }

  function validate(source, context = {}) {
    const text = String(source || '');
    const issues = [];
    if (!/^#\s+\S/m.test(text)) issues.push(issue('error','missing-title','첫 줄에 Markdown H1 제목(`# 제목`)이 필요합니다.'));
    checkStructure(text, issues);
    if (/\[\[\s+(?:NORMAL|FAST|FOCUS|STOP|SIDE|CAST|QUIZ|DIALOGUE)/i.test(text)) issues.push(issue('warning','spaced-token','블록 표식 내부에 공백이 있습니다.'));

    const blocks = rawBlocks(text);
    let quizCount = 0;
    const counts = { NORMAL:0, FAST:0, FOCUS:0, STOP:0, SIDE:0, CAST:0, QUIZ:0, DIALOGUE:0, CLOZE:0 };
    for (const block of blocks) {
      counts[block.type] = (counts[block.type] || 0) + 1;
      if (['NORMAL','FAST','FOCUS','STOP','SIDE'].includes(block.type)) {
        const len = block.content.trim().length;
        if (len > 1400) issues.push(issue('warning','long-block',`${block.type} 블록이 ${len.toLocaleString()}자로 깁니다.`, { blockType:block.type, length:len }));
        const clozes = [...block.content.matchAll(/\[\[CLOZE\|/gi)].length;
        counts.CLOZE += clozes;
        if (clozes > 2) issues.push(issue('warning','many-cloze',`${block.type} 블록에 CLOZE가 ${clozes}개 있습니다.`));
      }
      if (block.type === 'QUIZ') {
        quizCount += 1;
        const f = parseFields(block.content);
        const type = String(f.TYPE || '').toUpperCase();
        if (!['OX','MCQ','RECALL'].includes(type)) issues.push(issue('error','quiz-type',`QUIZ TYPE이 OX/MCQ/RECALL 중 하나가 아닙니다.`));
        if (!f.Q) issues.push(issue('error','quiz-question','QUIZ에 Q 필드가 없습니다.'));
        if (type === 'OX' && !(f.A || f.ANSWER)) issues.push(issue('error','quiz-answer','OX QUIZ에 A 또는 ANSWER가 없습니다.'));
        if (type === 'MCQ') {
          for (const k of ['A','B','C','D']) if (!f[k]) issues.push(issue('error','quiz-option',`MCQ에 ${k} 선택지가 없습니다.`));
          if (!f.ANSWER) issues.push(issue('error','quiz-answer','MCQ에 ANSWER가 없습니다.'));
        }
        if (type === 'RECALL' && !(f.A || f.ANSWER)) issues.push(issue('error','quiz-answer','RECALL에 A 또는 ANSWER가 없습니다.'));
      }
      if (block.type === 'CAST') {
        for (const line of block.content.replace(/\r/g,'').split(/\n+/).filter(Boolean)) {
          const p = globalThis.NocturneCore.splitEscapedPipes(line);
          if (p.length < 3) issues.push(issue('error','cast-line',`CAST 행 형식이 SPEAKER|MOTION|TEXT가 아닙니다: ${line.slice(0,80)}`));
          else if (!['MUTE','ED'].includes(String(p[0]).trim().toUpperCase())) issues.push(issue('warning','cast-speaker',`알 수 없는 CAST speaker: ${p[0]}`));
        }
      }
      if (block.type === 'DIALOGUE') {
        let speakers = new Set();
        for (const line of block.content.replace(/\r/g,'').split(/\n+/).filter(Boolean)) {
          const p = globalThis.NocturneCore.splitEscapedPipes(line);
          if (p.length < 2) issues.push(issue('error','dialogue-line',`DIALOGUE 행 형식이 SPEAKER|TEXT가 아닙니다: ${line.slice(0,80)}`));
          else if (String(p[0]).trim().toUpperCase() !== 'NARRATOR') speakers.add(String(p[0]).trim());
        }
        if (speakers.size < 2) issues.push(issue('warning','dialogue-speakers','DIALOGUE에 실제 화자가 2명 미만입니다.'));
      }
    }
    if (quizCount > 5) issues.push(issue('warning','many-quiz',`QUIZ가 ${quizCount}개입니다. 보통 2~5개를 권장합니다.`));
    if (context.duplicateLectureId) issues.push(issue('error','duplicate-id',`Lecture ID ${context.duplicateLectureId}가 이미 존재합니다.`));
    if (context.fileMismatch) issues.push(issue('warning','file-id-mismatch',`Lecture ID와 파일명(${context.fileMismatch})이 일치하지 않습니다.`));

    const parsed = globalThis.NocturneCore.parseDocument(text, { allowedSpeakers:['MUTE','ED'] });
    const dialogueSpeakers = [];
    for (const b of parsed.blocks) if (b.type === 'dialogue') for (const s of b.dialogue.speakers || []) if (!dialogueSpeakers.includes(s)) dialogueSpeakers.push(s);
    const stats = { ...counts, characters:text.length, blocks:parsed.blocks.length, dialogueSpeakers };
    const errors = issues.filter(x => x.level === 'error');
    return { valid:errors.length === 0, issues, stats, parsed };
  }

  globalThis.WizardValidator = { validate };
})();

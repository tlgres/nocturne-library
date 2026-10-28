(() => {
  const root = globalThis.NocturneStudy = globalThis.NocturneStudy || {};

  const FORMAT_VERSION = '1.0';
  const BLOCK_TYPES = new Set(['normal', 'fast', 'focus', 'stop', 'side']);
  const RESERVED = new Set(['NORMAL','FAST','FOCUS','STOP','SIDE','CAST','QUIZ','DIALOGUE','END','ENDCAST','ENDQUIZ','ENDDIALOGUE','SERIES_END']);
  const NARRATOR = 'NARRATOR';

  function unescapeField(value) {
    return String(value ?? '').replace(/\\\|/g, '|');
  }

  function splitEscapedPipes(line) {
    const out = [];
    let buf = '';
    const src = String(line ?? '');
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '\\' && src[i + 1] === '|') {
        buf += '|';
        i += 1;
        continue;
      }
      if (ch === '|') {
        out.push(buf);
        buf = '';
        continue;
      }
      buf += ch;
    }
    out.push(buf);
    return out;
  }

  function normalizeSpeakerId(value) {
    return String(value || '').trim().replace(/\s+/g, '_').toUpperCase();
  }

  function parseDialogueLines(text) {
    const source = String(text || '').replace(/\r/g, '').trim();
    const entries = [];
    if (!source) return { entries, speakers: [] };

    // Canonical Format 1.0 path: one SPEAKER|TEXT record per line.
    for (const line of source.split(/\n+/)) {
      const parts = splitEscapedPipes(line);
      if (parts.length < 2) continue;
      const rawSpeaker = parts.shift().trim();
      const content = parts.join('|').trim();
      if (!rawSpeaker || !content) continue;
      const speaker = normalizeSpeakerId(rawSpeaker);
      entries.push({ speaker, rawSpeaker, narrator: speaker === NARRATOR, content });
    }

    // ChatGPT occasionally collapses all line breaks. Recover common speaker
    // markers conservatively if the canonical path produced fewer than 2 lines.
    if (entries.length < 2 && !source.includes('\n')) {
      entries.length = 0;
      const marker = /(?:^|(?<=[.!?。！？…]))\s*([A-Za-z][A-Za-z0-9_.-]{0,31}|[가-힣]{1,16})\|/g;
      const marks = [...source.matchAll(marker)];
      for (let i = 0; i < marks.length; i += 1) {
        const m = marks[i];
        const rawSpeaker = (m[1] || '').trim();
        const start = m.index + m[0].length;
        const end = i + 1 < marks.length ? marks[i + 1].index : source.length;
        const content = unescapeField(source.slice(start, end).trim());
        if (!rawSpeaker || !content) continue;
        const speaker = normalizeSpeakerId(rawSpeaker);
        entries.push({ speaker, rawSpeaker, narrator: speaker === NARRATOR, content });
      }
    }

    const speakers = [];
    for (const entry of entries) {
      if (entry.narrator || speakers.includes(entry.speaker)) continue;
      speakers.push(entry.speaker);
    }
    return { entries, speakers };
  }

  function parseCastLines(text, options = {}) {
    const source = String(text || '').replace(/\r/g, '').trim();
    const allowed = new Set((options.allowedSpeakers || []).map(x => String(x).toUpperCase()));
    const items = [];
    if (!source) return items;

    for (const line of source.split(/\n+/)) {
      const parts = splitEscapedPipes(line);
      if (parts.length < 3) continue;
      const speaker = String(parts.shift() || '').trim().toUpperCase();
      const expression = String(parts.shift() || '').trim().toLowerCase() || 'normal';
      const content = parts.join('|').trim();
      if (!speaker || !content || (allowed.size && !allowed.has(speaker))) continue;
      items.push({ type:'cast', speaker, expression, content, html:'' });
    }

    if (items.length < 2 && !source.includes('\n')) {
      items.length = 0;
      const speakerPattern = allowed.size ? [...allowed].map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : '[A-Z][A-Z0-9_-]{0,31}';
      const marker = new RegExp(`\\b(${speakerPattern})\\|([^|\\r\\n]*)\\|`, 'gi');
      const marks = [...source.matchAll(marker)];
      for (let i = 0; i < marks.length; i += 1) {
        const m = marks[i];
        const speaker = (m[1] || '').trim().toUpperCase();
        const expression = (m[2] || '').trim().toLowerCase() || 'normal';
        const start = m.index + m[0].length;
        const end = i + 1 < marks.length ? marks[i + 1].index : source.length;
        const content = unescapeField(source.slice(start, end).trim());
        if (!content || (allowed.size && !allowed.has(speaker))) continue;
        items.push({ type:'cast', speaker, expression, content, html:'' });
      }
    }
    return items;
  }

  function parseQuizLines(text) {
    const source = String(text || '').replace(/\r/g, '').trim();
    if (!source) return null;
    const fields = {};

    // Canonical line-oriented parser; escaped pipes remain inside values.
    for (const line of source.split(/\n+/)) {
      const parts = splitEscapedPipes(line);
      if (parts.length < 2) continue;
      const key = String(parts.shift() || '').trim().toUpperCase();
      if (!['TYPE','Q','A','B','C','D','ANSWER','WHY'].includes(key)) continue;
      fields[key] = parts.join('|').trim();
    }

    // ChatGPT collapsed-line fallback.
    if (!fields.TYPE || !fields.Q) {
      const fieldRe = /(?:^|(?=(?:TYPE|Q|A|B|C|D|ANSWER|WHY)\|))(TYPE|Q|A|B|C|D|ANSWER|WHY)\|/g;
      const marks = [...source.matchAll(fieldRe)];
      for (let i = 0; i < marks.length; i += 1) {
        const key = (marks[i][1] || '').toUpperCase();
        const start = marks[i].index + marks[i][0].length;
        const end = i + 1 < marks.length ? marks[i + 1].index : source.length;
        fields[key] = unescapeField(source.slice(start, end).trim());
      }
    }

    const typeRaw = (fields.TYPE || '').toUpperCase();
    const type = typeRaw === 'OX' ? 'ox' : typeRaw === 'MCQ' ? 'mcq' : typeRaw === 'RECALL' ? 'recall' : '';
    if (!type || !fields.Q) return null;
    if (type === 'ox') {
      const answerRaw = String(fields.A || fields.ANSWER || '').trim().toUpperCase();
      const answer = /^(?:O|TRUE|T|맞음|참)$/.test(answerRaw) ? 'O' : /^(?:X|FALSE|F|틀림|거짓)$/.test(answerRaw) ? 'X' : '';
      if (!answer) return null;
      return { kind:'ox', question:fields.Q, answer, why:fields.WHY || '' };
    }
    if (type === 'mcq') {
      const options = ['A','B','C','D'].map(key => ({ key, text:fields[key] || '' }));
      const answer = String(fields.ANSWER || '').trim().toUpperCase();
      if (options.some(x => !x.text) || !['A','B','C','D'].includes(answer)) return null;
      return { kind:'mcq', question:fields.Q, options, answer, why:fields.WHY || '' };
    }
    const answer = fields.A || fields.ANSWER || '';
    if (!answer) return null;
    return { kind:'recall', question:fields.Q, answer, why:fields.WHY || '' };
  }

  function splitLongText(text, minChars = 800, maxChars = 1200) {
    const clean = String(text || '').trim();
    if (!clean) return [];
    if (clean.length <= maxChars) return [clean];
    const sentences = clean.match(/[^.!?。！？\n]+[.!?。！？]?|\n+/g) || [clean];
    const chunks = [];
    let buf = '';
    for (const part of sentences) {
      const piece = part.trim();
      if (!piece) continue;
      const candidate = buf ? `${buf} ${piece}` : piece;
      if (candidate.length > maxChars && buf) {
        chunks.push(buf.trim());
        buf = piece;
      } else buf = candidate;
    }
    if (buf.trim()) chunks.push(buf.trim());
    return chunks.filter(Boolean);
  }

  function hasSeriesEndMarker(text) {
    return /\[\[SERIES_END\]\]/i.test(String(text || ''));
  }

  function stripSeriesEndMarkers(text) {
    return String(text || '').replace(/\[\[SERIES_END\]\]/gi, '');
  }

  function deriveTextTitle(source) {
    const lines = String(source || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const h1 = lines.find(x => /^#\s+/.test(x));
    if (h1) return h1.replace(/^#\s+/, '').trim().slice(0, 180);
    const lecturePattern = /^(?:제\s*)?\d+\s*강(?:\.|\s|:|—|-)/;
    const explicit = lines.map(x => x.replace(/^#+\s*/, '')).find(x => lecturePattern.test(x));
    if (explicit) return explicit.slice(0, 180);
    return (lines[0] || 'Study Session').replace(/^#+\s*/, '').replace(/\[\[(?:NORMAL|FAST|FOCUS|STOP|SIDE|DIALOGUE|CAST|QUIZ)[^\]]*\]\].*$/i, '').trim().slice(0, 120) || 'Study Session';
  }

  function parseDocument(text, options = {}) {
    const original = String(text || '');
    const seriesEnded = hasSeriesEndMarker(original);
    const source = stripSeriesEndMarkers(original);
    const blocks = [];
    let title = deriveTextTitle(source);
    const tokenRe = /\[\[(NORMAL|FAST|FOCUS|STOP|SIDE|DIALOGUE|CAST|QUIZ|ENDDIALOGUE|ENDCAST|ENDQUIZ|END)\]\]/gi;
    const matches = [...source.matchAll(tokenRe)];
    const hasSyntax = matches.some(m => !/^END/i.test(m[1]));

    if (hasSyntax) {
      let current = null;
      let cursor = 0;
      let sawOpening = false;
      const push = () => {
        if (!current) return;
        const content = current.content.trim();
        if (content) {
          if (current.type === 'dialogue') {
            const dialogue = parseDialogueLines(content);
            if (dialogue.entries.length) blocks.push({ type:'dialogue', dialogue, content });
          } else if (current.type === 'cast') {
            blocks.push(...parseCastLines(content, options));
          } else if (current.type === 'quiz') {
            const quiz = parseQuizLines(content);
            if (quiz) blocks.push({ type:'quiz', quiz, content:quiz.question });
          } else {
            blocks.push({ type:current.type, content });
          }
        }
        current = null;
      };

      for (const m of matches) {
        const between = source.slice(cursor, m.index);
        if (current) current.content += between;
        else if (!sawOpening && between.trim()) {
          const prefix = between.trim();
          if (!/^#\s+/.test(prefix)) blocks.push({ type:'normal', content:prefix.replace(/^#+\s*/, '') });
        } else if (between.trim()) blocks.push({ type:'normal', content:between.trim() });

        const upper = m[1].toUpperCase();
        if (upper.startsWith('END')) push();
        else {
          push();
          sawOpening = true;
          current = { type:upper.toLowerCase(), content:'' };
        }
        cursor = m.index + m[0].length;
      }
      const tail = source.slice(cursor);
      if (current) { current.content += tail; push(); }
      else if (tail.trim()) blocks.push({ type:'normal', content:tail.trim() });
    } else {
      const clean = source.replace(/^#\s+[^\n]+\n?/, '').trim();
      splitLongText(clean, options.minChars || 800, options.maxChars || 1200).forEach(content => blocks.push({ type:'normal', content }));
    }

    return { formatVersion:FORMAT_VERSION, title, blocks, seriesEnded };
  }

  function parseClozeSegments(text) {
    const source = String(text || '');
    const re = /\[\[CLOZE\|([^\]|]+)(?:\|([^\]]+))?\]\]/gi;
    const out = [];
    let cursor = 0;
    let m;
    while ((m = re.exec(source))) {
      if (m.index > cursor) out.push({ type:'text', text:source.slice(cursor, m.index) });
      out.push({ type:'cloze', answer:m[1].trim(), hint:(m[2] || '').trim() });
      cursor = m.index + m[0].length;
    }
    if (cursor < source.length) out.push({ type:'text', text:source.slice(cursor) });
    return out;
  }

  function validateDocument(text) {
    const source = String(text || '');
    const warnings = [];
    if (!/^#\s+\S/m.test(source)) warnings.push({ code:'missing-title', message:'첫 Markdown H1 제목이 없습니다.' });
    const opens = [...source.matchAll(/\[\[(NORMAL|FAST|FOCUS|STOP|SIDE|CAST|QUIZ|DIALOGUE)\]\]/gi)].length;
    const ends = [...source.matchAll(/\[\[(END|ENDCAST|ENDQUIZ|ENDDIALOGUE)\]\]/gi)].length;
    if (opens && !ends) warnings.push({ code:'missing-end', message:'Nocturne block 종료 표식이 보이지 않습니다.' });
    if (/\[\[\s+(?:NORMAL|FAST|FOCUS|STOP|SIDE)/i.test(source)) warnings.push({ code:'spaced-token', message:'블록 표식 내부 공백은 Format 1.0 canonical syntax가 아닙니다.' });
    return { valid:warnings.length === 0, warnings };
  }

  const Core = {
    FORMAT_VERSION,
    BLOCK_TYPES,
    RESERVED,
    NARRATOR,
    unescapeField,
    splitEscapedPipes,
    normalizeSpeakerId,
    parseDialogueLines,
    parseCastLines,
    parseQuizLines,
    parseClozeSegments,
    splitLongText,
    hasSeriesEndMarker,
    stripSeriesEndMarkers,
    parseDocument,
    validateDocument
  };

  root.Core = Core;
  globalThis.NocturneCore = Core;
})();

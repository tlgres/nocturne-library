(() => {
  'use strict';
  const Core = globalThis.NocturneCore;
  if (!Core) throw new Error('NocturneCore is not loaded.');

  const $ = id => document.getElementById(id);
  const ui = {
    categoryName: $('category-name'), seriesName: $('series-name'), seriesSelect: $('series-select'), lectureSelect: $('lecture-select'),
    lectureIndex: $('lecture-index'), lectureTitle: $('lecture-title'), seriesDescription: $('series-description'),
    progress: $('progress'), progressLabel: $('progress-label'), blockState: $('block-state'), notice: $('notice'), reader: $('reader'),
    prevSection: $('prev-section'), nextSection: $('next-section'), sectionCount: $('section-count'),
    prevLecture: $('prev-lecture'), nextLecture: $('next-lecture'), status: $('status')
  };

  const READER_TYPES = new Set(['normal','fast','focus','stop','side','dialogue']);
  const state = {
    categories: [], catalog: [], seriesList: [], seriesPath: '', meta: null, lectureIndex: 0,
    doc: null, slides: [], sectionIndex: 0, interaction: new Map()
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function inlineMarkdown(text) {
    let s = esc(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return s;
  }

  function inlineWithCloze(text, keyPrefix) {
    const segments = Core.parseClozeSegments(String(text || ''));
    let clozeIndex = 0;
    return segments.map(seg => {
      if (seg.type === 'text') return inlineMarkdown(seg.text);
      const key = `${keyPrefix}:cloze:${clozeIndex++}`;
      const revealed = !!getInteraction(key);
      const label = revealed ? seg.answer : (seg.hint || '••••••');
      return `<button class="cloze ${revealed ? 'revealed' : ''}" type="button" data-cloze-key="${esc(key)}" aria-pressed="${revealed ? 'true' : 'false'}" title="${revealed ? '다시 가리기' : (seg.hint ? `힌트: ${esc(seg.hint)}` : '정답 보기')}">${inlineMarkdown(label)}</button>`;
    }).join('');
  }

  function contentHtml(raw, keyPrefix) {
    let text = String(raw || '').trim();
    let chapter = '';
    const m = text.match(/^■\s*([^\n]+)(?:\n+|$)/);
    if (m) { chapter = m[1].trim(); text = text.slice(m[0].length).trim(); }
    const paragraphs = text
      ? text.split(/\n{2,}/).map((p, i) => `<p>${inlineWithCloze(p, `${keyPrefix}:p${i}`).replace(/\n/g, '<br>')}</p>`).join('')
      : '';
    return `${chapter ? `<h2 class="chapter">${esc(chapter)}</h2>` : ''}<div class="section-body">${paragraphs}</div>`;
  }

  function buildSlides(blocks) {
    const slides = [];
    let current = null;
    for (const block of blocks) {
      if (READER_TYPES.has(block.type)) {
        current = { primary:block, extras:[] };
        slides.push(current);
        continue;
      }
      if (block.type === 'cast' || block.type === 'quiz') {
        if (!current) {
          current = { primary:{type:'normal', content:''}, extras:[] };
          slides.push(current);
        }
        current.extras.push(block);
      }
    }
    return slides;
  }


  function getInteraction(key) { return state.interaction.get(key); }
  function setInteraction(key, value) { state.interaction.set(key, value); }

  function quizHtml(block, slideIndex, extraIndex) {
    const quiz = block.quiz;
    const base = `s${slideIndex}:q${extraIndex}`;
    const result = getInteraction(`${base}:result`);
    const revealed = !!getInteraction(`${base}:revealed`);
    const why = quiz.why ? `<div class="quiz-why"><span>WHY</span>${inlineMarkdown(quiz.why)}</div>` : '';

    if (quiz.kind === 'ox') {
      const buttons = ['O','X'].map(choice => {
        const selected = result === choice;
        const correct = result && choice === quiz.answer;
        const wrong = selected && choice !== quiz.answer;
        return `<button type="button" class="quiz-choice quiz-ox ${selected ? 'selected' : ''} ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}" data-quiz-action="answer" data-key="${base}" data-value="${choice}">${choice}</button>`;
      }).join('');
      const feedback = result ? `<div class="quiz-feedback ${result === quiz.answer ? 'correct' : 'wrong'}">${result === quiz.answer ? '정답' : `정답은 ${esc(quiz.answer)}`}</div>${why}` : '';
      return `<section class="quiz-card" data-kind="ox"><div class="quiz-question">${inlineMarkdown(quiz.question)}</div><div class="quiz-options quiz-options-ox">${buttons}</div>${feedback}</section>`;
    }

    if (quiz.kind === 'mcq') {
      const buttons = quiz.options.map(opt => {
        const selected = result === opt.key;
        const correct = result && opt.key === quiz.answer;
        const wrong = selected && opt.key !== quiz.answer;
        return `<button type="button" class="quiz-choice ${selected ? 'selected' : ''} ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}" data-quiz-action="answer" data-key="${base}" data-value="${esc(opt.key)}"><span>${esc(opt.key)}</span>${inlineMarkdown(opt.text)}</button>`;
      }).join('');
      const feedback = result ? `<div class="quiz-feedback ${result === quiz.answer ? 'correct' : 'wrong'}">${result === quiz.answer ? '정답' : `정답은 ${esc(quiz.answer)}`}</div>${why}` : '';
      return `<section class="quiz-card" data-kind="mcq"><div class="quiz-question">${inlineMarkdown(quiz.question)}</div><div class="quiz-options">${buttons}</div>${feedback}</section>`;
    }

    const self = getInteraction(`${base}:self`);
    const answer = revealed ? `<div class="recall-answer">${inlineMarkdown(quiz.answer)}</div>${why}<div class="recall-self"><button data-quiz-action="self" data-key="${base}" data-value="known" class="${self === 'known' ? 'selected' : ''}">알았다</button><button data-quiz-action="self" data-key="${base}" data-value="maybe" class="${self === 'maybe' ? 'selected' : ''}">애매했다</button><button data-quiz-action="self" data-key="${base}" data-value="missed" class="${self === 'missed' ? 'selected' : ''}">몰랐다</button></div>` : `<button type="button" class="recall-reveal" data-quiz-action="reveal" data-key="${base}">정답 보기</button>`;
    return `<section class="quiz-card" data-kind="recall"><div class="quiz-question">${inlineMarkdown(quiz.question)}</div>${answer}</section>`;
  }

  function castHtml(items) {
    if (!items.length) return '';
    return `<aside class="cast-stack">${items.map(item => `<div class="cast-line" data-speaker="${esc(item.speaker)}"><div class="cast-speaker">${esc(item.speaker)}</div><div class="cast-content">${inlineMarkdown(item.content)}</div></div>`).join('')}</aside>`;
  }

  function extrasHtml(slide, slideIndex) {
    const chunks = [];
    let castBuffer = [];
    const flushCast = () => {
      if (!castBuffer.length) return;
      chunks.push(castHtml(castBuffer));
      castBuffer = [];
    };
    slide.extras.forEach((block, i) => {
      if (block.type === 'cast') castBuffer.push(block);
      else if (block.type === 'quiz') { flushCast(); chunks.push(quizHtml(block, slideIndex, i)); }
    });
    flushCast();
    return chunks.length ? `<div class="interactive-layer">${chunks.join('')}</div>` : '';
  }

  function dialogueProfileFor(speaker) {
    const lecture = state.meta?.lectures?.[state.lectureIndex] || {};
    const profiles = lecture.dialogueSpeakers || state.meta?.dialogueSpeakers || {};
    const direct = profiles[speaker] || profiles[String(speaker).toUpperCase()] || null;
    if (!direct) return { name:speaker, thumbnail:'' };
    if (typeof direct === 'string') return { name:direct, thumbnail:'' };
    return { name:direct.name || speaker, thumbnail:direct.thumbnail || '' };
  }

  function dialogueAvatar(speaker) {
    const profile = dialogueProfileFor(speaker);
    if (profile.thumbnail) return `<img class="dialogue-avatar-image" src="${esc(profile.thumbnail)}" alt="" loading="lazy">`;
    const glyph = String(profile.name || speaker || '?').trim().slice(0,1).toUpperCase();
    return `<span class="dialogue-avatar-fallback">${esc(glyph)}</span>`;
  }

  function dialogueEntryHtml(entry, speakers, index, activeIndex, transcript) {
    if (entry.narrator) return `<div class="dialogue-narrator ${!transcript && index !== activeIndex ? 'is-hidden' : ''}" data-dialogue-entry="${index}">${inlineMarkdown(entry.content)}</div>`;
    const order = speakers.indexOf(entry.speaker);
    const side = order === 1 ? 'right' : order > 1 ? 'minor' : 'left';
    const profile = dialogueProfileFor(entry.speaker);
    return `<article class="dialogue-line ${side} ${!transcript && index !== activeIndex ? 'is-hidden' : ''}" data-dialogue-entry="${index}" data-speaker="${esc(entry.speaker)}">
      <div class="dialogue-avatar">${dialogueAvatar(entry.speaker)}</div>
      <div class="dialogue-bubble"><div class="dialogue-speaker-name">${esc(profile.name)}</div><div class="dialogue-text">${inlineMarkdown(entry.content)}</div></div>
    </article>`;
  }

  function dialogueHtml(block, slideIndex) {
    const entries = block.dialogue?.entries || [];
    const speakers = block.dialogue?.speakers || [];
    const modeKey = `s${slideIndex}:dialogue:mode`;
    const stepKey = `s${slideIndex}:dialogue:step`;
    const mode = getInteraction(modeKey) || 'flow';
    let step = Number(getInteraction(stepKey) ?? 0);
    if (!Number.isInteger(step) || step < 0) step = 0;
    if (entries.length) step = Math.min(step, entries.length - 1);
    const transcript = mode === 'transcript';
    const rail = speakers.length > 2 ? `<div class="dialogue-speaker-rail">${speakers.slice(2).map(sp => { const p=dialogueProfileFor(sp); return `<span class="dialogue-rail-person">${dialogueAvatar(sp)}<span>${esc(p.name)}</span></span>`; }).join('')}</div>` : '';
    const body = entries.map((entry,i) => dialogueEntryHtml(entry, speakers, i, step, transcript)).join('');
    const controls = `<div class="dialogue-controls">
      <div class="dialogue-mode"><button type="button" data-dialogue-action="mode" data-key="${modeKey}" data-value="flow" class="${!transcript ? 'selected' : ''}">Flow</button><button type="button" data-dialogue-action="mode" data-key="${modeKey}" data-value="transcript" class="${transcript ? 'selected' : ''}">Transcript</button></div>
      ${transcript ? '' : `<div class="dialogue-step"><button type="button" data-dialogue-action="step" data-key="${stepKey}" data-value="prev" ${step <= 0 ? 'disabled' : ''}>←</button><span>${entries.length ? step+1 : 0} / ${entries.length}</span><button type="button" data-dialogue-action="step" data-key="${stepKey}" data-value="next" ${step >= entries.length-1 ? 'disabled' : ''}>→</button></div>`}
    </div>`;
    return `<div class="dialogue-scene" data-dialogue-mode="${mode}">${rail}<div class="dialogue-stage">${body || '<div class="dialogue-empty">Dialogue is empty.</div>'}</div>${controls}</div>`;
  }

  function categoryFor(slug) { return state.categories.find(x => x.slug === slug); }
  function positionKey() { return state.meta ? `nocturne:webpos:v1:${state.meta.category}:${state.meta.id}:${state.meta.lectures[state.lectureIndex]?.id || state.lectureIndex}` : ''; }
  function savePosition() { const key = positionKey(); if (key) localStorage.setItem(key, String(state.sectionIndex)); }
  function restorePosition() { const key = positionKey(); const raw = key ? localStorage.getItem(key) : null; const n = Number(raw); return Number.isInteger(n) && n >= 0 && n < state.slides.length ? n : 0; }

  async function fetchJson(url) { const res = await fetch(url, {cache:'no-store'}); if (!res.ok) throw new Error(`${url}: ${res.status}`); return res.json(); }
  async function fetchText(url) { const res = await fetch(url, {cache:'no-store'}); if (!res.ok) throw new Error(`${url}: ${res.status}`); return res.text(); }

  async function loadBootData() {
    const [cats, library] = await Promise.all([fetchJson('categories.json'), fetchJson('library.json')]);
    state.categories = cats.categories || [];
    state.catalog = library.series || [];
    state.seriesList = await Promise.all(state.catalog.map(async item => ({...item, data: await fetchJson(item.meta)})));
    ui.seriesSelect.innerHTML = state.seriesList.map((s,i) => `<option value="${i}">${esc(s.data.title)}</option>`).join('');
  }

  function routeSelection() {
    const params = new URLSearchParams(location.search);
    const seriesId = params.get('series');
    const lectureId = params.get('lecture');
    let seriesIdx = state.seriesList.findIndex(x => x.data.id === seriesId || x.path === seriesId);
    if (seriesIdx < 0) seriesIdx = 0;
    const meta = state.seriesList[seriesIdx]?.data;
    let lectureIdx = meta ? meta.lectures.findIndex(x => x.id === lectureId) : 0;
    if (lectureIdx < 0) lectureIdx = 0;
    return {seriesIdx, lectureIdx};
  }

  function updateUrl() {
    if (!state.meta) return;
    const lecture = state.meta.lectures[state.lectureIndex];
    const params = new URLSearchParams();
    params.set('series', state.meta.id);
    params.set('lecture', lecture.id);
    history.replaceState(null, '', `${location.pathname}?${params}`);
  }

  async function openSeries(seriesIdx, lectureIdx = 0) {
    const selected = state.seriesList[seriesIdx];
    if (!selected) return;
    state.seriesPath = selected.path;
    state.meta = selected.data;
    state.lectureIndex = Math.min(Math.max(lectureIdx,0), state.meta.lectures.length - 1);
    ui.seriesSelect.value = String(seriesIdx);
    ui.lectureSelect.innerHTML = state.meta.lectures.map((x,i) => `<option value="${i}">${String(i+1).padStart(2,'0')} · ${esc(x.title || x.id)}</option>`).join('');
    ui.seriesName.textContent = state.meta.title;
    ui.seriesDescription.textContent = state.meta.description || '';
    const cat = categoryFor(state.meta.category);
    ui.categoryName.textContent = cat ? cat.ko : state.meta.category;
    await openLecture(state.lectureIndex);
  }

  async function openLecture(index) {
    state.lectureIndex = Math.min(Math.max(index,0), state.meta.lectures.length - 1);
    state.interaction.clear();
    const lecture = state.meta.lectures[state.lectureIndex];
    ui.lectureSelect.value = String(state.lectureIndex);
    ui.status.textContent = 'Loading…';
    const source = await fetchText(`${state.seriesPath}/${lecture.file}`);
    const report = Core.validateDocument(source);
    state.doc = Core.parseDocument(source, {allowedSpeakers:['MUTE','ED']});
    state.slides = buildSlides(state.doc.blocks);
    const deferredDialogue = state.doc.blocks.filter(b => b.type === 'dialogue').length;
    ui.notice.hidden = deferredDialogue === 0;
    if (deferredDialogue) ui.notice.textContent = `이 문서에는 ${deferredDialogue}개의 DIALOGUE 블록이 있습니다. Dialogue renderer는 phase 3에서 지원됩니다.`;
    ui.lectureIndex.textContent = `Lecture ${String(state.lectureIndex + 1).padStart(2,'0')} · ${state.meta.lectures.length}`;
    ui.lectureTitle.textContent = state.doc.title || lecture.title || state.meta.title;
    state.sectionIndex = restorePosition();
    renderProgress(); renderSection(); renderLectureNav(); updateUrl();
    ui.status.textContent = `Nocturne Format ${state.doc.formatVersion}${report.warnings.length ? ` · ${report.warnings.length} warning` : ''}`;
  }

  function renderProgress() {
    ui.progress.innerHTML = state.slides.map((slide, i) => {
      const hasQuiz = slide.extras.some(x => x.type === 'quiz');
      const hasCast = slide.extras.some(x => x.type === 'cast');
      return `<button type="button" data-index="${i}" data-type="${esc(slide.primary.type)}" data-quiz="${hasQuiz ? '1' : '0'}" data-cast="${hasCast ? '1' : '0'}" aria-label="${i+1}번째 구간으로 이동"></button>`;
    }).join('');
    ui.progress.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => goSection(Number(btn.dataset.index))));
  }

  function renderSection() {
    const slide = state.slides[state.sectionIndex];
    if (!slide) {
      ui.reader.innerHTML = '<div class="section"><div class="section-body"><p>표시할 Reader block이 없습니다.</p></div></div>';
      return;
    }
    const primary = slide.primary;
    const keyPrefix = `${state.meta.id}:${state.meta.lectures[state.lectureIndex].id}:s${state.sectionIndex}`;
    const primaryHtml = primary.type === 'dialogue' ? dialogueHtml(primary, state.sectionIndex) : contentHtml(primary.content, keyPrefix);
    ui.reader.innerHTML = `<article class="section" data-type="${esc(primary.type)}">${primaryHtml}${extrasHtml(slide, state.sectionIndex)}</article>`;
    bindInteractiveEvents();
    ui.progress.querySelectorAll('button').forEach((b,i) => b.classList.toggle('active', i === state.sectionIndex));
    ui.progressLabel.textContent = `${state.sectionIndex + 1} / ${state.slides.length}`;
    ui.blockState.textContent = primary.type.toUpperCase();
    ui.sectionCount.textContent = `${state.sectionIndex + 1} / ${state.slides.length}`;
    ui.prevSection.disabled = state.sectionIndex <= 0;
    ui.nextSection.disabled = state.sectionIndex >= state.slides.length - 1;
    savePosition();
  }

  function bindInteractiveEvents() {
    ui.reader.querySelectorAll('[data-cloze-key]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const key = btn.dataset.clozeKey;
      setInteraction(key, !getInteraction(key));
      renderSection();
    }));
    ui.reader.querySelectorAll('[data-quiz-action]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const action = btn.dataset.quizAction;
      const key = btn.dataset.key;
      if (action === 'answer') setInteraction(`${key}:result`, btn.dataset.value);
      if (action === 'reveal') setInteraction(`${key}:revealed`, true);
      if (action === 'self') setInteraction(`${key}:self`, btn.dataset.value);
      renderSection();
    }));
    ui.reader.querySelectorAll('[data-dialogue-action]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const action = btn.dataset.dialogueAction;
      const key = btn.dataset.key;
      if (action === 'mode') setInteraction(key, btn.dataset.value);
      if (action === 'step') {
        const current = Number(getInteraction(key) ?? 0);
        setInteraction(key, Math.max(0, current + (btn.dataset.value === 'next' ? 1 : -1)));
      }
      renderSection();
    }));
  }

  function renderLectureNav() {
    ui.prevLecture.disabled = state.lectureIndex <= 0;
    ui.nextLecture.disabled = state.lectureIndex >= state.meta.lectures.length - 1;
  }

  function goSection(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.slides.length) return;
    state.sectionIndex = index;
    renderSection();
    window.scrollTo({top: Math.max(0, ui.reader.offsetTop - 120), behavior:'smooth'});
  }

  ui.prevSection.addEventListener('click', () => goSection(state.sectionIndex - 1));
  ui.nextSection.addEventListener('click', () => goSection(state.sectionIndex + 1));
  ui.prevLecture.addEventListener('click', () => openLecture(state.lectureIndex - 1));
  ui.nextLecture.addEventListener('click', () => openLecture(state.lectureIndex + 1));
  ui.lectureSelect.addEventListener('change', () => openLecture(Number(ui.lectureSelect.value)));
  ui.seriesSelect.addEventListener('change', () => openSeries(Number(ui.seriesSelect.value), 0));
  document.addEventListener('keydown', e => {
    if (e.target && /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
    const slide = state.slides[state.sectionIndex];
    if (slide?.primary?.type === 'dialogue' && (getInteraction(`s${state.sectionIndex}:dialogue:mode`) || 'flow') === 'flow') {
      const key = `s${state.sectionIndex}:dialogue:step`;
      const entries = slide.primary.dialogue?.entries || [];
      const step = Number(getInteraction(key) ?? 0);
      if ((e.key === 'ArrowRight' || e.key === ' ') && step < entries.length - 1) { e.preventDefault(); setInteraction(key, step + 1); renderSection(); return; }
      if (e.key === 'ArrowLeft' && step > 0) { e.preventDefault(); setInteraction(key, step - 1); renderSection(); return; }
    }
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (!ui.nextSection.disabled) goSection(state.sectionIndex + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (!ui.prevSection.disabled) goSection(state.sectionIndex - 1); }
  });

  (async () => {
    try {
      await loadBootData();
      const route = routeSelection();
      await openSeries(route.seriesIdx, route.lectureIdx);
    } catch (error) {
      ui.status.textContent = `Load failed · ${error.message}`;
      ui.reader.innerHTML = '<article class="section"><div class="section-body"><p>정적 서버에서 열어주세요. GitHub Pages 또는 python -m http.server 환경이 필요합니다.</p></div></article>';
    }
  })();
})();

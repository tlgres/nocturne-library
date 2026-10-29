(() => {
  'use strict';
  const Core = globalThis.NocturneCore;
  if (!Core) throw new Error('NocturneCore is not loaded.');

  const $ = id => document.getElementById(id);
  const ui = {
    categoryName: $('category-name'), seriesName: $('series-name'), categorySelect: $('category-select'), seriesSelect: $('series-select'), lectureSelect: $('lecture-select'),
    lectureIndex: $('lecture-index'), lectureTitle: $('lecture-title'), seriesDescription: $('series-description'),
    progress: $('progress'), progressLabel: $('progress-label'), blockState: $('block-state'), notice: $('notice'), reader: $('reader'),
    prevSection: $('prev-section'), nextSection: $('next-section'), sectionCount: $('section-count'),
    prevLecture: $('prev-lecture'), nextLecture: $('next-lecture'), status: $('status'),
    stage: $('character-stage'), stageStatus: $('stage-status'), quizMessage: $('quiz-message'),
    castMessage: $('cast-message'),
    muteLayer: $('char-mute'), edLayer: $('char-ed'), muteCanvas: $('char-mute-canvas'), edCanvas: $('char-ed-canvas'),
    immersiveToggle: $('immersive-toggle'), companionToggle: $('companion-toggle'), settingsToggle: $('reader-settings-toggle'), settingsPanel: $('reader-settings'),
    fontSelect: $('reader-font-select'), fontSize: $('reader-font-size'), fontSizeValue: $('reader-font-size-value'),
    lineHeight: $('reader-line-height'), lineHeightValue: $('reader-line-height-value'), settingsReset: $('reader-settings-reset')
  };

  const READER_TYPES = new Set(['normal','fast','focus','stop','side','dialogue']);
  const PREF_KEY = 'nocturne:webprefs:v1';
  const DIALOGUE_MODE_KEY = 'nocturne:dialogue-mode:v1';
  const DEFAULT_PREFS = { font:'sans', fontSize:16, lineHeight:1.80, immersive:false, companions:true };
  const state = {
    categories: [], catalog: [], seriesList: [], seriesPath: '', meta: null, lectureIndex: 0,
    doc: null, slides: [], sectionIndex: 0, interaction: new Map(), animators: {}, stageMotion: {MUTE:'normal', ED:'normal'},
    prefs: {...DEFAULT_PREFS}
  };

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      state.prefs = {...DEFAULT_PREFS, ...saved};
    } catch { state.prefs = {...DEFAULT_PREFS}; }
  }
  function savePrefs() { localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs)); }
  function applyPrefs() {
    const font = state.prefs.font === 'sans' ? 'sans-serif' : state.prefs.font === 'system' ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : 'serif';
    document.documentElement.style.setProperty('--reader-font', font);
    document.documentElement.style.setProperty('--reader-size', `${state.prefs.fontSize}px`);
    document.documentElement.style.setProperty('--reader-leading', String(state.prefs.lineHeight));
    document.body.classList.toggle('immersive', !!state.prefs.immersive);
    document.body.classList.toggle('companions-off', state.prefs.companions === false);
    if (ui.fontSelect) ui.fontSelect.value = state.prefs.font;
    if (ui.fontSize) ui.fontSize.value = String(state.prefs.fontSize);
    if (ui.fontSizeValue) ui.fontSizeValue.value = `${state.prefs.fontSize}px`;
    if (ui.lineHeight) ui.lineHeight.value = String(state.prefs.lineHeight);
    if (ui.lineHeightValue) ui.lineHeightValue.value = Number(state.prefs.lineHeight).toFixed(2);
    if (ui.immersiveToggle) {
      ui.immersiveToggle.setAttribute('aria-pressed', state.prefs.immersive ? 'true' : 'false');
      ui.immersiveToggle.classList.toggle('active', !!state.prefs.immersive);
      ui.immersiveToggle.textContent = state.prefs.immersive ? 'Exit Focus' : 'Focus';
    }
    if (ui.companionToggle) {
      const on = state.prefs.companions !== false;
      ui.companionToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      ui.companionToggle.classList.toggle('active', on);
      ui.companionToggle.textContent = on ? 'Companions' : 'Quiet';
      ui.companionToggle.title = on ? '뮤트·이드와 상호작용 사용' : '조용히 읽기 · CAST/QUIZ 생략';
    }
  }
  function updatePrefs(patch) { state.prefs = {...state.prefs, ...patch}; savePrefs(); applyPrefs(); }

  loadPrefs();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function inlineMarkdown(text) {
    let s = esc(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return s;
  }

  function renderMath(root) {
    if (!root || typeof globalThis.renderMathInElement !== 'function') return;
    try {
      globalThis.renderMathInElement(root, {
        delimiters: [
          {left:'\\[', right:'\\]', display:true},
          {left:'$$', right:'$$', display:true},
          {left:'\\(', right:'\\)', display:false},
        ],
        throwOnError: false,
        strict: false,
        ignoredTags: ['script','noscript','style','textarea','pre','code']
      });
    } catch (error) {
      console.warn('Math rendering failed:', error);
    }
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

    // Display math must be protected before paragraph splitting. Otherwise a source such as
    //   \[
    //   ...
    //   \]
    // can become three separate <p> elements, leaving KaTeX without a matching delimiter pair.
    const displayMath = [];
    const protectedText = text.replace(/\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$/g, match => {
      const token = `@@NOCTURNE_DISPLAY_MATH_${displayMath.length}@@`;
      displayMath.push(match);
      return `\n\n${token}\n\n`;
    });

    let paragraphIndex = 0;
    const body = protectedText
      ? protectedText.split(/\n{2,}/).filter(Boolean).map(part => {
          const trimmed = part.trim();
          const tokenMatch = trimmed.match(/^@@NOCTURNE_DISPLAY_MATH_(\d+)@@$/);
          if (tokenMatch) {
            const math = displayMath[Number(tokenMatch[1])] || '';
            return `<div class="math-display">${esc(math)}</div>`;
          }
          return `<p>${inlineWithCloze(trimmed, `${keyPrefix}:p${paragraphIndex++}`).replace(/\n/g, '<br>')}</p>`;
        }).join('')
      : '';
    return `${chapter ? `<h2 class="chapter">${esc(chapter)}</h2>` : ''}<div class="section-body">${body}</div>`;
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
    const label = speaker => speaker === 'MUTE' ? '뮤트' : speaker === 'ED' ? '이드' : speaker;
    return `<aside class="cast-stack">${items.map(item => `<div class="cast-line" data-speaker="${esc(item.speaker)}"><div class="cast-speaker">${esc(label(item.speaker))}</div><div class="cast-content">${inlineMarkdown(item.content)}</div></div>`).join('')}</aside>`;
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

  function resolveSeriesAsset(path) {
    const value = String(path || '').trim().replace(/\\/g, '/');
    if (!value) return '';
    try {
      if (/^(?:https?:|data:|blob:)/i.test(value)) return value;
      if (value.startsWith('/')) return new URL(value, location.origin).href;
      const webBase = new URL('./', location.href);
      if (value.startsWith('content/')) return new URL(value, webBase).href;
      const seriesBase = new URL(`${state.seriesPath.replace(/\/$/, '')}/`, webBase);
      return new URL(value, seriesBase).href;
    } catch {
      return value;
    }
  }

  function dialogueProfileFor(speaker) {
    const lecture = state.meta?.lectures?.[state.lectureIndex] || {};
    const profiles = lecture.dialogueSpeakers || state.meta?.dialogueSpeakers || {};
    const direct = profiles[speaker] || profiles[String(speaker).toUpperCase()] || null;
    if (!direct) return { name:speaker, thumbnail:'' };
    if (typeof direct === 'string') return { name:direct, thumbnail:'' };
    return { name:direct.name || speaker, thumbnail:resolveSeriesAsset(direct.thumbnail || '') };
  }

  function dialogueAvatar(speaker) {
    const profile = dialogueProfileFor(speaker);
    const glyph = String(profile.name || speaker || '?').trim().slice(0,1).toUpperCase();
    if (profile.thumbnail) return `<img class="dialogue-avatar-image" src="${esc(profile.thumbnail)}" alt="" loading="lazy"><span class="dialogue-avatar-fallback avatar-fallback-hidden">${esc(glyph)}</span>`;
    return `<span class="dialogue-avatar-fallback">${esc(glyph)}</span>`;
  }

  function bindDialogueAvatarFallbacks() {
    ui.reader?.querySelectorAll('.dialogue-avatar-image').forEach(img => {
      const fallback = img.nextElementSibling;
      const fail = () => { img.hidden = true; fallback?.classList.remove('avatar-fallback-hidden'); };
      img.addEventListener('error', fail, {once:true});
      if (img.complete && img.naturalWidth === 0) fail();
    });
  }

  function dialogueEntryHtml(entry, speakers, index, activeIndex, transcript) {
    if (entry.narrator) return `<div class="dialogue-narrator ${!transcript && index !== activeIndex ? 'is-hidden' : ''}" data-dialogue-entry="${index}">${inlineMarkdown(entry.content)}</div>`;
    const order = speakers.indexOf(entry.speaker);
    const side = order === 1 ? 'right' : order > 1 ? 'minor' : 'left';
    const profile = dialogueProfileFor(entry.speaker);
    return `<article class="dialogue-line ${side} ${!transcript && index !== activeIndex ? 'is-hidden' : ''}" data-dialogue-entry="${index}" data-speaker="${esc(entry.speaker)}">
      <div class="dialogue-avatar-wrap"><div class="dialogue-avatar">${dialogueAvatar(entry.speaker)}</div><div class="dialogue-avatar-name">${esc(profile.name)}</div></div>
      <div class="dialogue-bubble"><div class="dialogue-text">${inlineMarkdown(entry.content)}</div></div>
    </article>`;
  }

  function dialogueHtml(block, slideIndex) {
    const entries = block.dialogue?.entries || [];
    const speakers = block.dialogue?.speakers || [];
    const modeKey = `s${slideIndex}:dialogue:mode`;
    const stepKey = `s${slideIndex}:dialogue:step`;
    const mode = getInteraction(modeKey) || localStorage.getItem(DIALOGUE_MODE_KEY) || 'flow';
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

  function initCharacters() {
    const Animator = globalThis.NocturneWeb?.CharacterAnimator;
    if (!Animator || !ui.muteCanvas || !ui.edCanvas) return;
    state.animators.MUTE = new Animator(ui.muteCanvas, 'MUTE');
    state.animators.ED = new Animator(ui.edCanvas, 'ED');
  }

  function quizReactionFor(slide) {
    const quizItems = slide.extras.filter(x => x.type === 'quiz');
    if (!quizItems.length) return null;
    const quiz = quizItems[0];
    const quizIndex = slide.extras.indexOf(quiz);
    const base = `s${state.sectionIndex}:q${quizIndex}`;
    if (quiz.quiz.kind === 'recall') {
      const self = getInteraction(`${base}:self`);
      const revealed = !!getInteraction(`${base}:revealed`);
      if (self === 'known') return {active:'ED', MUTE:'normal', ED:'smug'};
      if (self === 'maybe') return {active:'ED', MUTE:'normal', ED:'skeptical'};
      if (self === 'missed') return {active:'ED', MUTE:'normal', ED:'surprised'};
      if (revealed) return {active:'ED', MUTE:'normal', ED:'ask'};
      return {active:'ED', MUTE:'normal', ED:'curious'};
    }
    const result = getInteraction(`${base}:result`);
    if (!result) return {active:'ED', MUTE:'normal', ED:'curious'};
    return result === quiz.quiz.answer
      ? {active:'ED', MUTE:'normal', ED:'smug'}
      : {active:'ED', MUTE:'normal', ED:'surprised'};
  }

  function castItemsFor(slide) {
    return slide.extras.filter(x => x.type === 'cast' && (x.speaker === 'MUTE' || x.speaker === 'ED'));
  }

  function currentCastFor(slide) {
    const items = castItemsFor(slide);
    if (!items.length) return {items, index:-1, item:null, key:`s${state.sectionIndex}:cast:step`};
    const key = `s${state.sectionIndex}:cast:step`;
    let index = Number(getInteraction(key) ?? -1);
    if (!Number.isInteger(index)) index = -1;
    index = Math.max(-1, Math.min(index, items.length - 1));
    return {items, index, item:index >= 0 ? items[index] : null, key};
  }

  function stageMotionFor(slide) {
    if (state.prefs.companions === false) return {active:'', MUTE:'normal', ED:'normal'};
    const castState = currentCastFor(slide);
    const cast = castState.item;
    if (cast) {
      const active = cast.speaker;
      return {active, MUTE: active === 'MUTE' ? (cast.expression || 'normal') : 'normal', ED: active === 'ED' ? (cast.expression || 'normal') : 'normal'};
    }
    const quiz = quizReactionFor(slide);
    if (quiz) return quiz;
    return {active:'', MUTE:'normal', ED:'normal'};
  }

  function castSequenceHtml(slide) {
    const current = currentCastFor(slide);
    if (!current.item) return '';
    const item = current.item;
    const label = item.speaker === 'MUTE' ? '뮤트' : '이드';
    const prevDisabled = current.index <= 0 ? 'disabled' : '';
    const nextDisabled = current.index >= current.items.length - 1 ? 'disabled' : '';
    const controls = current.items.length > 1 ? `<div class="cast-sequence-controls"><button type="button" data-cast-action="step" data-key="${current.key}" data-value="prev" ${prevDisabled}>←</button><span>${current.index + 1} / ${current.items.length}</span><button type="button" data-cast-action="step" data-key="${current.key}" data-value="next" ${nextDisabled}>→</button></div>` : '';
    return `<div class="cast-bubble cast-bubble-full" data-speaker="${esc(item.speaker)}"><div class="cast-bubble-head"><span class="cast-bubble-speaker">${esc(label)}</span>${controls}</div><div class="cast-bubble-line">${inlineMarkdown(item.content)}</div></div>`;
  }

  function quizStackHtml(slide, slideIndex) {
    return slide.extras.map((block, i) => block.type === 'quiz' ? quizHtml(block, slideIndex, i) : '').filter(Boolean).join('');
  }

  function renderStage(slide) {
    if (!ui.stage) return;
    const primaryType = slide?.primary?.type || 'normal';
    const extras = slide?.extras || [];
    const companionsOn = state.prefs.companions !== false;
    if (!companionsOn) {
      if (ui.quizMessage) { ui.quizMessage.innerHTML = ''; ui.quizMessage.hidden = true; }
      if (ui.castMessage) { ui.castMessage.innerHTML = ''; ui.castMessage.hidden = true; }
      state.animators.MUTE?.stop();
      state.animators.ED?.stop();
      return;
    }
    const castState = currentCastFor(slide);
    const castVisible = !!castState.item;
    const hasQuiz = !castVisible && extras.some(x => x.type === 'quiz');
    const hasCast = castVisible;
    ui.stage.dataset.blockType = hasQuiz ? 'quiz' : hasCast ? 'cast' : primaryType;
    ui.stage.classList.toggle('is-dialogue-observer', primaryType === 'dialogue');
    ui.stage.classList.toggle('has-quiz', hasQuiz);
    ui.stage.classList.toggle('has-cast', hasCast);
    ui.stageStatus.textContent = (hasQuiz ? 'QUIZ' : hasCast ? 'CAST' : primaryType).toUpperCase();

    const quizMarkup = hasQuiz ? quizStackHtml(slide, state.sectionIndex) : '';
    if (ui.quizMessage) {
      ui.quizMessage.innerHTML = quizMarkup;
      ui.quizMessage.hidden = !quizMarkup;
    }
    const castMarkup = hasCast ? castSequenceHtml(slide) : '';
    if (ui.castMessage) {
      ui.castMessage.innerHTML = castMarkup;
      ui.castMessage.hidden = !castMarkup;
    }

    const motion = stageMotionFor(slide);
    ui.muteLayer.classList.toggle('is-active-speaker', motion.active === 'MUTE');
    ui.edLayer.classList.toggle('is-active-speaker', motion.active === 'ED');
    ui.muteLayer.classList.toggle('is-listener', motion.active !== 'MUTE');
    ui.edLayer.classList.toggle('is-listener', motion.active !== 'ED');
    state.stageMotion.MUTE = motion.MUTE;
    state.stageMotion.ED = motion.ED;

    if (!document.hidden) {
      state.animators.MUTE?.show(motion.MUTE, true);
      state.animators.ED?.show(motion.ED, true);
    }
  }

  function categoryFor(slug) { return state.categories.find(x => x.slug === slug); }
  function positionKey() { return state.meta ? `nocturne:webpos:v1:${state.meta.category}:${state.meta.id}:${state.meta.lectures[state.lectureIndex]?.id || state.lectureIndex}` : ''; }
  function savePosition() { const key = positionKey(); if (key) localStorage.setItem(key, String(state.sectionIndex)); }
  function restorePosition() { const key = positionKey(); const raw = key ? localStorage.getItem(key) : null; const n = Number(raw); return Number.isInteger(n) && n >= 0 && n < state.slides.length ? n : 0; }

  async function fetchJson(url) { const res = await fetch(url, {cache:'no-store'}); if (!res.ok) throw new Error(`${url}: ${res.status}`); return res.json(); }
  async function fetchText(url) { const res = await fetch(url, {cache:'no-store'}); if (!res.ok) throw new Error(`${url}: ${res.status}`); return res.text(); }

  function seriesIndicesForCategory(slug) {
    return state.seriesList.map((series, index) => ({series, index})).filter(x => x.series.data.category === slug);
  }

  function populateSeriesSelect(categorySlug, selectedGlobalIndex = null) {
    const matches = seriesIndicesForCategory(categorySlug);
    ui.seriesSelect.innerHTML = matches.map(({series,index}) => `<option value="${index}">${esc(series.data.title)}</option>`).join('');
    ui.seriesSelect.disabled = matches.length === 0;
    if (selectedGlobalIndex != null && matches.some(x => x.index === selectedGlobalIndex)) ui.seriesSelect.value = String(selectedGlobalIndex);
    else if (matches.length) ui.seriesSelect.value = String(matches[0].index);
    return matches;
  }

  async function loadBootData() {
    const [cats, library] = await Promise.all([fetchJson('categories.json'), fetchJson('library.json')]);
    state.categories = cats.categories || [];
    state.catalog = library.series || [];
    state.seriesList = await Promise.all(state.catalog.map(async item => ({...item, data: await fetchJson(item.meta)})));
    const populated = new Set(state.seriesList.map(x => x.data.category));
    ui.categorySelect.innerHTML = state.categories.filter(cat => populated.has(cat.slug)).map(cat => `<option value="${esc(cat.slug)}">${esc(cat.ko)}</option>`).join('');
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
    if (ui.categorySelect) ui.categorySelect.value = state.meta.category;
    populateSeriesSelect(state.meta.category, seriesIdx);
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
    ui.notice.hidden = true;
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
      const hasChapter = slide.primary.type !== 'dialogue' && /^\s*■\s*/.test(String(slide.primary.content || ''));
      return `<button type="button" data-index="${i}" data-type="${esc(slide.primary.type)}" data-quiz="${hasQuiz ? '1' : '0'}" data-cast="${hasCast ? '1' : '0'}" data-chapter="${hasChapter ? '1' : '0'}" aria-label="${i+1}번째 구간으로 이동"></button>`;
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
    ui.reader.innerHTML = `<article class="section" data-type="${esc(primary.type)}">${primaryHtml}</article>`;
    renderMath(ui.reader);
    bindDialogueAvatarFallbacks();
    renderStage(slide);
    bindInteractiveEvents();
    ui.progress.querySelectorAll('button').forEach((b,i) => b.classList.toggle('active', i === state.sectionIndex));
    const progressPct = state.slides.length <= 1 ? 100 : (state.sectionIndex / (state.slides.length - 1)) * 100;
    ui.progress.style.setProperty('--progress-pct', `${progressPct}%`);
    document.body.dataset.activeType = primary.type;
    ui.progressLabel.textContent = `${state.sectionIndex + 1} / ${state.slides.length}`;
    ui.blockState.textContent = primary.type.toUpperCase();
    ui.sectionCount.textContent = `${state.sectionIndex + 1} / ${state.slides.length}`;
    const castState = state.prefs.companions === false ? {items:[], index:-1} : currentCastFor(slide);
    const atFirstSection = state.sectionIndex <= 0 && castState.index < 0;
    const atLastSection = state.sectionIndex >= state.slides.length - 1;
    const castRemaining = castState.items.length && castState.index < castState.items.length - 1;
    const hasPrevLecture = state.lectureIndex > 0;
    const hasNextLecture = state.lectureIndex < state.meta.lectures.length - 1;
    ui.prevSection.disabled = atFirstSection && !hasPrevLecture;
    ui.nextSection.disabled = atLastSection && !castRemaining && !hasNextLecture;
    ui.prevSection.textContent = atFirstSection && hasPrevLecture ? '← Previous lecture' : '← Prev';
    ui.nextSection.textContent = atLastSection && !castRemaining && hasNextLecture ? 'Next lecture →' : atLastSection && !castRemaining ? 'Series complete' : 'Next →';
    savePosition();
  }

  function bindStageEvents() {
    renderMath(ui.quizMessage);
    renderMath(ui.castMessage);
    const roots = [ui.quizMessage, ui.castMessage].filter(Boolean);
    const all = selector => roots.flatMap(root => [...root.querySelectorAll(selector)]);
    all('[data-quiz-action]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const readerTop = ui.reader?.scrollTop || 0;
      const quizTop = ui.quizMessage?.scrollTop || 0;
      const action = btn.dataset.quizAction;
      const key = btn.dataset.key;
      if (action === 'answer') setInteraction(`${key}:result`, btn.dataset.value);
      if (action === 'reveal') setInteraction(`${key}:revealed`, true);
      if (action === 'self') setInteraction(`${key}:self`, btn.dataset.value);
      renderStage(state.slides[state.sectionIndex]);
      bindStageEvents();
      requestAnimationFrame(() => {
        if (ui.reader) ui.reader.scrollTop = readerTop;
        if (ui.quizMessage) ui.quizMessage.scrollTop = quizTop;
      });
    }));
    all('[data-cast-action]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const key = btn.dataset.key;
      const current = Number(getInteraction(key) ?? 0);
      setInteraction(key, Math.max(0, current + (btn.dataset.value === 'next' ? 1 : -1)));
      renderStage(state.slides[state.sectionIndex]);
      bindStageEvents();
    }));
  }

  function bindInteractiveEvents() {
    ui.reader.querySelectorAll('[data-cloze-key]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const key = btn.dataset.clozeKey;
      setInteraction(key, !getInteraction(key));
      renderSection();
    }));
    ui.reader.querySelectorAll('[data-dialogue-action]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const action = btn.dataset.dialogueAction;
      const key = btn.dataset.key;
      if (action === 'mode') {
        setInteraction(key, btn.dataset.value);
        localStorage.setItem(DIALOGUE_MODE_KEY, btn.dataset.value);
      }
      if (action === 'step') {
        const current = Number(getInteraction(key) ?? 0);
        setInteraction(key, Math.max(0, current + (btn.dataset.value === 'next' ? 1 : -1)));
      }
      renderSection();
    }));
    bindStageEvents();
  }

  function stepCast(delta) {
    if (state.prefs.companions === false) return false;
    const slide = state.slides[state.sectionIndex];
    if (!slide) return false;
    const cast = currentCastFor(slide);
    if (!cast.items.length) return false;
    const next = Math.max(-1, Math.min(cast.items.length - 1, cast.index + delta));
    if (next === cast.index) return false;
    setInteraction(cast.key, next);
    renderStage(slide);
    bindStageEvents();
    return true;
  }

  function nextReaderStep() {
    const slide = state.slides[state.sectionIndex];
    if (state.prefs.companions !== false && slide) {
      const cast = currentCastFor(slide);
      if (cast.items.length && cast.index < cast.items.length - 1) { stepCast(1); return; }
    }
    if (state.sectionIndex < state.slides.length - 1) { goSection(state.sectionIndex + 1); return; }
    if (state.lectureIndex < state.meta.lectures.length - 1) openLecture(state.lectureIndex + 1);
  }

  function prevReaderStep() {
    const slide = state.slides[state.sectionIndex];
    if (state.prefs.companions !== false && slide) {
      const cast = currentCastFor(slide);
      if (cast.items.length && cast.index >= 0) { stepCast(-1); return; }
    }
    if (state.sectionIndex > 0) { goSection(state.sectionIndex - 1); return; }
    if (state.lectureIndex > 0) {
      openLecture(state.lectureIndex - 1).then(() => goSection(Math.max(0, state.slides.length - 1)));
    }
  }

  function renderLectureNav() {
    ui.prevLecture.disabled = state.lectureIndex <= 0;
    ui.nextLecture.disabled = state.lectureIndex >= state.meta.lectures.length - 1;
  }

  function goSection(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.slides.length) return;
    state.sectionIndex = index;
    renderSection();
    ui.reader?.scrollTo({top:0, behavior:'smooth'});
  }

  ui.prevSection.addEventListener('click', prevReaderStep);
  ui.nextSection.addEventListener('click', nextReaderStep);
  ui.prevLecture.addEventListener('click', () => openLecture(state.lectureIndex - 1));
  ui.nextLecture.addEventListener('click', () => openLecture(state.lectureIndex + 1));
  ui.lectureSelect.addEventListener('change', () => openLecture(Number(ui.lectureSelect.value)));
  ui.seriesSelect.addEventListener('change', () => openSeries(Number(ui.seriesSelect.value), 0));
  ui.categorySelect?.addEventListener('change', () => {
    const matches = populateSeriesSelect(ui.categorySelect.value);
    if (matches.length) openSeries(matches[0].index, 0);
  });

  ui.immersiveToggle?.addEventListener('click', () => updatePrefs({immersive: !state.prefs.immersive}));
  ui.companionToggle?.addEventListener('click', () => { updatePrefs({companions: state.prefs.companions === false}); renderStage(state.slides[state.sectionIndex]); bindStageEvents(); });
  ui.settingsToggle?.addEventListener('click', () => {
    const nextHidden = !ui.settingsPanel.hidden;
    ui.settingsPanel.hidden = nextHidden;
    ui.settingsToggle.setAttribute('aria-expanded', nextHidden ? 'false' : 'true');
  });
  ui.fontSelect?.addEventListener('change', () => updatePrefs({font: ui.fontSelect.value}));
  ui.fontSize?.addEventListener('input', () => updatePrefs({fontSize: Number(ui.fontSize.value)}));
  ui.lineHeight?.addEventListener('input', () => updatePrefs({lineHeight: Number(ui.lineHeight.value)}));
  ui.settingsReset?.addEventListener('click', () => { state.prefs = {...DEFAULT_PREFS}; savePrefs(); applyPrefs(); });
  document.addEventListener('pointerdown', e => {
    if (!ui.settingsPanel || ui.settingsPanel.hidden) return;
    if (ui.settingsPanel.contains(e.target) || ui.settingsToggle?.contains(e.target)) return;
    ui.settingsPanel.hidden = true;
    ui.settingsToggle?.setAttribute('aria-expanded','false');
  });

  applyPrefs();

  document.addEventListener('keydown', e => {
    if (e.target && /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
    const slide = state.slides[state.sectionIndex];
    if (slide?.primary?.type === 'dialogue' && (getInteraction(`s${state.sectionIndex}:dialogue:mode`) || localStorage.getItem(DIALOGUE_MODE_KEY) || 'flow') === 'flow') {
      const key = `s${state.sectionIndex}:dialogue:step`;
      const entries = slide.primary.dialogue?.entries || [];
      const step = Number(getInteraction(key) ?? 0);
      if ((e.key === 'ArrowRight' || e.key === ' ') && step < entries.length - 1) { e.preventDefault(); setInteraction(key, step + 1); renderSection(); return; }
      if (e.key === 'ArrowLeft' && step > 0) { e.preventDefault(); setInteraction(key, step - 1); renderSection(); return; }
    }
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (!ui.nextSection.disabled || currentCastFor(slide || {extras:[]}).items.length) nextReaderStep(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (!ui.prevSection.disabled || currentCastFor(slide || {extras:[]}).index >= 0) prevReaderStep(); }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.animators.MUTE?.stop();
      state.animators.ED?.stop();
    } else if (state.slides[state.sectionIndex]) {
      renderStage(state.slides[state.sectionIndex]);
      bindInteractiveEvents();
    }
  });

  (async () => {
    try {
      initCharacters();
      await loadBootData();
      const route = routeSelection();
      await openSeries(route.seriesIdx, route.lectureIdx);
    } catch (error) {
      ui.status.textContent = `Load failed · ${error.message}`;
      ui.reader.innerHTML = '<article class="section"><div class="section-body"><p>정적 서버에서 열어주세요. GitHub Pages 또는 python -m http.server 환경이 필요합니다.</p></div></article>';
    }
  })();
})();

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
    searchToggle: $('study-search-toggle'), immersiveToggle: $('immersive-toggle'), companionToggle: $('companion-toggle'), settingsToggle: $('reader-settings-toggle'), settingsPanel: $('reader-settings'),
    fontSelect: $('reader-font-select'), customFontWrap: $('reader-custom-font-wrap'), customFont: $('reader-custom-font'), fontSize: $('reader-font-size'), fontSizeValue: $('reader-font-size-value'),
    lineHeight: $('reader-line-height'), lineHeightValue: $('reader-line-height-value'), alignSelect: $('reader-align-select'), widthSelect: $('reader-width-select'), paragraphSelect: $('reader-paragraph-select'), linkMode: $('reader-link-mode'), settingsReset: $('reader-settings-reset'),
    messageDock:$('message-dock'), messageDockStatus:$('message-dock-status'), messageQuiz:$('message-quiz'), messageCast:$('message-cast'),
    searchDialog:$('study-search-dialog'), searchClose:$('study-search-close'), searchInput:$('study-search-input'), searchScope:$('study-search-scope'), searchSummary:$('study-search-summary'), searchResults:$('study-search-results'), searchPager:$('study-search-pager'),
    lightbox:$('media-lightbox'), lightboxClose:$('media-lightbox-close'), lightboxImage:$('media-lightbox-image'), lightboxCaption:$('media-lightbox-caption')
  };

  const READER_TYPES = new Set(['normal','fast','focus','stop','side','dialogue']);
  const PREF_KEY = 'nocturne:webprefs:v1';
  const DIALOGUE_MODE_KEY = 'nocturne:dialogue-mode:v1';
  const DEFAULT_PREFS = { font:'sans', customFont:'', fontSize:16, lineHeight:1.80, align:'left', readerWidth:'default', paragraphSpacing:'default', immersive:false, interactionMode:'companions', showLinks:true };
  const state = {
    categories: [], catalog: [], seriesList: [], seriesPath: '', meta: null, lectureIndex: 0,
    doc: null, slides: [], sectionIndex: 0, interaction: new Map(), animators: {}, stageMotion: {MUTE:'normal', ED:'normal'},
    prefs: {...DEFAULT_PREFS}, dialogueSideMap: new Map(), reopenedCompleted:false, currentSource:'', searchCache:new Map(), searchState:{results:[],page:0,query:'',scope:'lecture'}
  };

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      state.prefs = {...DEFAULT_PREFS, ...saved};
      if (!saved.interactionMode && saved.companions === false) state.prefs.interactionMode = 'quiet';
      else if (!saved.interactionMode && saved.companions === true) state.prefs.interactionMode = 'companions';
    } catch { state.prefs = {...DEFAULT_PREFS}; }
  }
  function savePrefs() { localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs)); }
  function applyPrefs() {
    const fontStacks = {
      sans: 'Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif',
      gothic: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", Dotum, sans-serif',
      serif: 'Georgia, "Times New Roman", "Noto Serif KR", Batang, serif',
      myeongjo: '"Noto Serif KR", "Nanum Myeongjo", Batang, "Times New Roman", serif',
      system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
    };
    const cleanCustomFont = String(state.prefs.customFont || '').replace(/[{};]/g, '').trim();
    const font = state.prefs.font === 'custom' && cleanCustomFont ? cleanCustomFont : (fontStacks[state.prefs.font] || fontStacks.sans);
    const widths = {narrow:'680px', default:'780px', wide:'940px'};
    const paragraphGaps = {compact:'.72em', default:'1.05em', wide:'1.45em'};
    const align = state.prefs.align === 'justify' ? 'justify' : 'left';
    document.documentElement.style.setProperty('--reader-font', font);
    document.documentElement.style.setProperty('--reader-size', `${state.prefs.fontSize}px`);
    document.documentElement.style.setProperty('--reader-leading', String(state.prefs.lineHeight));
    document.documentElement.style.setProperty('--reader-align', align);
    document.documentElement.style.setProperty('--reader-width', widths[state.prefs.readerWidth] || widths.default);
    document.documentElement.style.setProperty('--reader-paragraph-gap', paragraphGaps[state.prefs.paragraphSpacing] || paragraphGaps.default);
    document.body.classList.toggle('immersive', !!state.prefs.immersive);
    const interactionMode = ['companions','messages','quiet'].includes(state.prefs.interactionMode) ? state.prefs.interactionMode : 'companions';
    state.prefs.interactionMode = interactionMode;
    document.body.classList.toggle('companions-off', interactionMode !== 'companions');
    document.body.classList.toggle('messages-mode', interactionMode === 'messages');
    document.body.classList.toggle('quiet-mode', interactionMode === 'quiet');
    if (ui.fontSelect) ui.fontSelect.value = state.prefs.font;
    if (ui.customFont) ui.customFont.value = state.prefs.customFont || '';
    if (ui.customFontWrap) ui.customFontWrap.hidden = state.prefs.font !== 'custom';
    if (ui.fontSize) ui.fontSize.value = String(state.prefs.fontSize);
    if (ui.fontSizeValue) ui.fontSizeValue.value = `${state.prefs.fontSize}px`;
    if (ui.lineHeight) ui.lineHeight.value = String(state.prefs.lineHeight);
    if (ui.lineHeightValue) ui.lineHeightValue.value = Number(state.prefs.lineHeight).toFixed(2);
    if (ui.alignSelect) ui.alignSelect.value = state.prefs.align || 'left';
    if (ui.widthSelect) ui.widthSelect.value = state.prefs.readerWidth || 'default';
    if (ui.paragraphSelect) ui.paragraphSelect.value = state.prefs.paragraphSpacing || 'default';
    if (ui.linkMode) ui.linkMode.value = state.prefs.showLinks === false ? 'text' : 'show';
    if (ui.immersiveToggle) {
      ui.immersiveToggle.setAttribute('aria-pressed', state.prefs.immersive ? 'true' : 'false');
      ui.immersiveToggle.classList.toggle('active', !!state.prefs.immersive);
      ui.immersiveToggle.textContent = state.prefs.immersive ? 'Exit Focus' : 'Focus';
    }
    if (ui.companionToggle) {
      const labels = {companions:'Companions', messages:'Messages', quiet:'Quiet'};
      const titles = {companions:'캐릭터 + CAST/QUIZ', messages:'캐릭터 없이 CAST/QUIZ 팝업', quiet:'본문만 읽기'};
      ui.companionToggle.setAttribute('aria-pressed', interactionMode === 'quiet' ? 'false' : 'true');
      ui.companionToggle.classList.toggle('active', interactionMode !== 'quiet');
      ui.companionToggle.textContent = labels[interactionMode];
      ui.companionToggle.title = titles[interactionMode];
    }
  }
  function updatePrefs(patch) { state.prefs = {...state.prefs, ...patch}; savePrefs(); applyPrefs(); }

  loadPrefs();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function inlineMarkdown(text) {
    let s = esc(text);
    // Basic Markdown links. Only http/https targets are linkified; everything else stays text.
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_m, label, href) => {
      return state.prefs.showLinks === false ? label : `<a class="md-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
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
      return `<button class="cloze ${revealed ? 'revealed' : ''}" type="button" data-cloze-key="${esc(key)}" data-cloze-answer="${esc(seg.answer)}" data-cloze-hint="${esc(seg.hint || '')}" aria-pressed="${revealed ? 'true' : 'false'}" title="${revealed ? '다시 가리기' : (seg.hint ? `힌트: ${esc(seg.hint)}` : '정답 보기')}">${inlineMarkdown(label)}</button>`;
    }).join('');
  }

  function safeImageSrc(raw) {
    const value = String(raw || '').trim().replace(/\\/g, '/');
    if (!value) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value)) return '';
    return resolveSeriesAsset(value);
  }

  function standaloneImageHtml(text) {
    const m = String(text || '').trim().match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)$/);
    if (!m) return '';
    const src = safeImageSrc(m[2]);
    if (!src) return '';
    const alt = m[1].replace(/\\\]/g, ']');
    return `<figure class="md-figure"><button type="button" class="md-image-open" data-image-src="${esc(src)}" data-image-alt="${esc(alt)}"><img class="md-image" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"></button>${alt ? `<figcaption>${inlineMarkdown(alt)}</figcaption>` : ''}</figure>`;
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
          const image = standaloneImageHtml(trimmed);
          if (image) { paragraphIndex++; return image; }
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
    if (!direct) return { name:speaker, thumbnail:'', side:'' };
    if (typeof direct === 'string') return { name:direct, thumbnail:'', side:'' };
    return { name:direct.name || speaker, thumbnail:resolveSeriesAsset(direct.thumbnail || ''), side:['left','right','minor'].includes(direct.side) ? direct.side : '' };
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

  function dialogueSideFor(speaker, speakers = []) {
    const id = String(speaker || '').trim();
    const upper = id.toUpperCase();
    if (upper === 'A') return 'left';
    if (upper === 'B') return 'right';
    const profile = dialogueProfileFor(id);
    if (profile.side) return profile.side;
    if (state.dialogueSideMap.has(id)) return state.dialogueSideMap.get(id);
    const known = [...state.dialogueSideMap.values()];
    const side = !known.includes('left') ? 'left' : !known.includes('right') ? 'right' : 'minor';
    state.dialogueSideMap.set(id, side);
    return side;
  }

  function dialogueEntryHtml(entry, speakers, index, flowState, transcript) {
    let visibility = '';
    let hiddenAttr = '';
    if (!transcript) {
      if (flowState.showAll || flowState.active.has(index)) visibility = 'is-flow-active';
      else if (flowState.context.has(index)) visibility = 'is-flow-context';
      else { visibility = 'is-hidden'; hiddenAttr = ' hidden'; }
    }
    if (entry.narrator) return `<div class="dialogue-narrator ${visibility}" data-dialogue-entry="${index}"${hiddenAttr}>${inlineMarkdown(entry.content)}</div>`;
    const side = dialogueSideFor(entry.speaker, speakers);
    const profile = dialogueProfileFor(entry.speaker);
    return `<article class="dialogue-line ${side} ${visibility}" data-dialogue-entry="${index}" data-speaker="${esc(entry.speaker)}"${hiddenAttr}>
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
    const transcript = mode === 'transcript';
    const showAll = entries.length <= 4;
    const maxStep = Math.max(0, entries.length - 2);
    let step = Number(getInteraction(stepKey) ?? 0);
    if (!Number.isInteger(step) || step < 0) step = 0;
    step = Math.min(step, maxStep);
    const active = new Set(showAll ? entries.map((_,i)=>i) : [step, step + 1].filter(i => i < entries.length));
    const context = new Set(showAll ? [] : [step - 1, step + 2].filter(i => i >= 0 && i < entries.length));
    const flowState = {showAll, active, context};
    const rail = speakers.length > 2 ? `<div class="dialogue-speaker-rail">${speakers.slice(2).map(sp => { const p=dialogueProfileFor(sp); return `<span class="dialogue-rail-person">${dialogueAvatar(sp)}<span>${esc(p.name)}</span></span>`; }).join('')}</div>` : '';
    const body = entries.map((entry,i) => dialogueEntryHtml(entry, speakers, i, flowState, transcript)).join('');
    const rangeLabel = showAll ? `${entries.length} / ${entries.length}` : `${entries.length ? step+1 : 0}–${Math.min(step+2, entries.length)} / ${entries.length}`;
    const controls = `<div class="dialogue-controls">
      <div class="dialogue-mode"><button type="button" data-dialogue-action="mode" data-key="${modeKey}" data-value="flow" class="${!transcript ? 'selected' : ''}">Flow</button><button type="button" data-dialogue-action="mode" data-key="${modeKey}" data-value="transcript" class="${transcript ? 'selected' : ''}">Transcript</button></div>
      ${transcript || showAll ? '' : `<div class="dialogue-step"><button type="button" data-dialogue-action="step" data-key="${stepKey}" data-value="prev" ${step <= 0 ? 'disabled' : ''}>←</button><span>${rangeLabel}</span><button type="button" data-dialogue-action="step" data-key="${stepKey}" data-value="next" ${step >= maxStep ? 'disabled' : ''}>→</button></div>`}
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
    const current = currentQuizFor(slide);
    if (!current.item) return null;
    const quiz = current.item.block;
    const quizIndex = current.item.extraIndex;
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
    if (state.prefs.interactionMode !== 'companions') return {active:'', MUTE:'normal', ED:'normal'};
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

  function quizItemsFor(slide) {
    return (slide?.extras || []).map((block, extraIndex) => ({block, extraIndex})).filter(x => x.block.type === 'quiz');
  }

  function currentQuizFor(slide) {
    const items = quizItemsFor(slide);
    const key = `s${state.sectionIndex}:quiz:step`;
    let index = Number(getInteraction(key) ?? 0);
    if (!Number.isInteger(index)) index = 0;
    index = Math.max(0, Math.min(index, Math.max(0, items.length - 1)));
    return {items, index, item:items[index] || null, key};
  }

  function quizQueueHtml(slide, slideIndex) {
    const current = currentQuizFor(slide);
    if (!current.item) return '';
    const card = quizHtml(current.item.block, slideIndex, current.item.extraIndex);
    if (current.items.length <= 1) return card;
    const controls = `<div class="quiz-sequence-controls"><button type="button" data-quiz-nav="prev" data-key="${current.key}" ${current.index <= 0 ? 'disabled' : ''}>←</button><span>문제 ${current.index + 1} / ${current.items.length}</span><button type="button" data-quiz-nav="next" data-key="${current.key}" ${current.index >= current.items.length - 1 ? 'disabled' : ''}>→</button></div>`;
    return `<div class="quiz-sequence" data-quiz-count="${current.items.length}" data-quiz-index="${current.index}">${card}${controls}</div>`;
  }

  function clearInteractionSurfaces() {
    [ui.quizMessage,ui.castMessage,ui.messageQuiz,ui.messageCast].forEach(el => { if(el){el.innerHTML='';el.hidden=true;} });
    if (ui.messageDock) ui.messageDock.hidden = true;
  }

  function renderStage(slide) {
    if (!ui.stage) return;
    const mode = state.prefs.interactionMode || 'companions';
    const primaryType = slide?.primary?.type || 'normal';
    if (mode === 'quiet') {
      clearInteractionSurfaces();
      state.animators.MUTE?.stop(); state.animators.ED?.stop();
      return;
    }
    const extras = slide?.extras || [];
    const castState = currentCastFor(slide);
    const castVisible = !!castState.item;
    const hasQuiz = !castVisible && extras.some(x => x.type === 'quiz');
    const hasCast = castVisible;
    const quizMarkup = hasQuiz ? quizQueueHtml(slide, state.sectionIndex) : '';
    const castMarkup = hasCast ? castSequenceHtml(slide) : '';

    if (mode === 'messages') {
      if (ui.quizMessage) { ui.quizMessage.innerHTML=''; ui.quizMessage.hidden=true; }
      if (ui.castMessage) { ui.castMessage.innerHTML=''; ui.castMessage.hidden=true; }
      if (ui.messageQuiz) { ui.messageQuiz.innerHTML=quizMarkup; ui.messageQuiz.hidden=!quizMarkup; }
      if (ui.messageCast) { ui.messageCast.innerHTML=castMarkup; ui.messageCast.hidden=!castMarkup; }
      if (ui.messageDockStatus) ui.messageDockStatus.textContent = hasQuiz ? 'QUICK CHECK' : hasCast ? 'MESSAGE' : '';
      if (ui.messageDock) ui.messageDock.hidden = !(quizMarkup || castMarkup);
      state.animators.MUTE?.stop(); state.animators.ED?.stop();
      return;
    }

    if (ui.messageDock) ui.messageDock.hidden=true;
    if (ui.messageQuiz) {ui.messageQuiz.innerHTML='';ui.messageQuiz.hidden=true;}
    if (ui.messageCast) {ui.messageCast.innerHTML='';ui.messageCast.hidden=true;}
    ui.stage.dataset.blockType = hasQuiz ? 'quiz' : hasCast ? 'cast' : primaryType;
    ui.stage.classList.toggle('is-dialogue-observer', primaryType === 'dialogue');
    ui.stage.classList.toggle('has-quiz', hasQuiz);
    ui.stage.classList.toggle('has-cast', hasCast);
    ui.stageStatus.textContent = (hasQuiz ? 'QUIZ' : hasCast ? 'CAST' : primaryType).toUpperCase();
    if (ui.quizMessage) { ui.quizMessage.innerHTML=quizMarkup; ui.quizMessage.hidden=!quizMarkup; }
    if (ui.castMessage) { ui.castMessage.innerHTML=castMarkup; ui.castMessage.hidden=!castMarkup; }
    const motion = stageMotionFor(slide);
    ui.muteLayer.classList.toggle('is-active-speaker', motion.active === 'MUTE');
    ui.edLayer.classList.toggle('is-active-speaker', motion.active === 'ED');
    ui.muteLayer.classList.toggle('is-listener', motion.active !== 'MUTE');
    ui.edLayer.classList.toggle('is-listener', motion.active !== 'ED');
    state.stageMotion.MUTE=motion.MUTE; state.stageMotion.ED=motion.ED;
    if (!document.hidden) { state.animators.MUTE?.show(motion.MUTE,true); state.animators.ED?.show(motion.ED,true); }
  }

  function categoryFor(slug) { return state.categories.find(x => x.slug === slug); }
  function seriesGroup(meta) { return meta?.kind === 'diary' ? '__diary' : meta?.kind === 'journal' ? '__journal' : meta?.category || ''; }
  function groupLabel(group) { return group === '__diary' ? '유성 기록' : group === '__journal' ? '궤도 문헌실' : (categoryFor(group)?.ko || group); }
  function positionKey() { return state.meta ? `nocturne:webpos:v1:${seriesGroup(state.meta)}:${state.meta.id}:${state.meta.lectures[state.lectureIndex]?.id || state.lectureIndex}` : ''; }
  function completionKey() { return state.meta ? `nocturne:webcomplete:v1:${seriesGroup(state.meta)}:${state.meta.id}:${state.meta.lectures[state.lectureIndex]?.id || state.lectureIndex}` : ''; }
  function isLectureCompleted() { const key = completionKey(); return !!key && localStorage.getItem(key) === '1'; }
  function markLectureCompleted() { const key = completionKey(); if (key) localStorage.setItem(key, '1'); state.reopenedCompleted = false; }
  function clearLectureCompleted() { const key = completionKey(); if (key) localStorage.removeItem(key); state.reopenedCompleted = false; }
  function savePosition() { const key = positionKey(); if (key) localStorage.setItem(key, String(state.sectionIndex)); }
  function restorePosition() {
    if (isLectureCompleted()) { state.reopenedCompleted = true; return 0; }
    state.reopenedCompleted = false;
    const key = positionKey(); const raw = key ? localStorage.getItem(key) : null; const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n < state.slides.length ? n : 0;
  }

  async function fetchJson(url) { const res = await fetch(url, {cache:'no-store'}); if (!res.ok) throw new Error(`${url}: ${res.status}`); return res.json(); }
  async function fetchText(url) { const res = await fetch(url, {cache:'no-store'}); if (!res.ok) throw new Error(`${url}: ${res.status}`); return res.text(); }

  function seriesIndicesForCategory(slug) {
    return state.seriesList.map((series, index) => ({series, index})).filter(x => seriesGroup(x.series.data) === slug);
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
    const populated = new Set(state.seriesList.map(x => seriesGroup(x.data)));
    const categoryOptions = state.categories.filter(cat => populated.has(cat.slug)).map(cat => `<option value="${esc(cat.slug)}">${esc(cat.ko)}</option>`);
    if (populated.has('__diary')) categoryOptions.push('<option value="__diary">유성 기록</option>');
    if (populated.has('__journal')) categoryOptions.push('<option value="__journal">궤도 문헌실</option>');
    ui.categorySelect.innerHTML = categoryOptions.join('');
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
    state.searchCache.clear();
    state.searchState = {results:[],page:0,query:'',scope:'lecture'};
    state.lectureIndex = Math.min(Math.max(lectureIdx,0), state.meta.lectures.length - 1);
    const group = seriesGroup(state.meta);
    if (ui.categorySelect) ui.categorySelect.value = group;
    populateSeriesSelect(group, seriesIdx);
    ui.lectureSelect.innerHTML = state.meta.lectures.map((x,i) => `<option value="${i}">${String(i+1).padStart(2,'0')} · ${esc(x.title || x.id)}</option>`).join('');
    ui.seriesName.textContent = state.meta.title; ui.seriesName.dataset.seriesId = state.meta.id; ui.seriesName.href = `book.html?series=${encodeURIComponent(state.meta.id)}`;
    ui.seriesDescription.textContent = state.meta.description || '';
    ui.categoryName.textContent = groupLabel(group);
    await openLecture(state.lectureIndex);
  }

  async function openLecture(index) {
    state.lectureIndex = Math.min(Math.max(index,0), state.meta.lectures.length - 1);
    state.interaction.clear();
    const lecture = state.meta.lectures[state.lectureIndex];
    localStorage.setItem(`deconstructed:lastlecture:v1:${state.meta.id}`, lecture.id);
    ui.lectureSelect.value = String(state.lectureIndex);
    ui.status.textContent = 'Loading…';
    const source = await fetchText(`${state.seriesPath}/${lecture.file}`);
    state.currentSource = source;
    state.searchCache.set(lecture.id, {source, slides:null});
    const report = Core.validateDocument(source);
    state.doc = Core.parseDocument(source, {allowedSpeakers:['MUTE','ED']});
    state.dialogueSideMap = new Map();
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
    const castState = state.prefs.interactionMode === 'quiet' ? {items:[], index:-1} : currentCastFor(slide);
    const atFirstSection = state.sectionIndex <= 0 && castState.index < 0;
    const atLastSection = state.sectionIndex >= state.slides.length - 1;
    const castRemaining = castState.items.length && castState.index < castState.items.length - 1;
    const hasPrevLecture = state.lectureIndex > 0;
    const hasNextLecture = state.lectureIndex < state.meta.lectures.length - 1;
    ui.prevSection.disabled = atFirstSection && !hasPrevLecture;
    const completed = isLectureCompleted();
    ui.nextSection.disabled = atLastSection && !castRemaining && !hasNextLecture && completed;
    ui.prevSection.textContent = atFirstSection && hasPrevLecture ? '← Previous lecture' : '← Prev';
    ui.nextSection.textContent = atLastSection && !castRemaining && hasNextLecture ? 'Next lecture →' : atLastSection && !castRemaining ? (completed ? 'Completed ✓' : 'Complete ✓') : 'Next →';
    savePosition();
  }

  function bindStageEvents() {
    [ui.quizMessage,ui.castMessage,ui.messageQuiz,ui.messageCast].forEach(renderMath);
    const roots = [ui.quizMessage,ui.castMessage,ui.messageQuiz,ui.messageCast].filter(Boolean);
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

    all('[data-quiz-nav]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const key = btn.dataset.key;
      const current = Number(getInteraction(key) ?? 0);
      const slide = state.slides[state.sectionIndex];
      const count = quizItemsFor(slide).length;
      const next = Math.max(0, Math.min(Math.max(0, count - 1), current + (btn.dataset.quizNav === 'next' ? 1 : -1)));
      setInteraction(key, next);
      renderStage(slide);
      bindStageEvents();
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
      const revealed = !getInteraction(key);
      setInteraction(key, revealed);
      const answer = btn.dataset.clozeAnswer || '';
      const hint = btn.dataset.clozeHint || '';
      btn.classList.toggle('revealed', revealed);
      btn.setAttribute('aria-pressed', revealed ? 'true' : 'false');
      btn.title = revealed ? '다시 가리기' : (hint ? `힌트: ${hint}` : '정답 보기');
      btn.innerHTML = inlineMarkdown(revealed ? answer : (hint || '••••••'));
      renderMath(btn);
    }));
    ui.reader.querySelectorAll('[data-image-src]').forEach(btn => btn.addEventListener('click', () => {
      if (!ui.lightbox || !ui.lightboxImage) return;
      ui.lightboxImage.src = btn.dataset.imageSrc || '';
      ui.lightboxImage.alt = btn.dataset.imageAlt || '';
      if (ui.lightboxCaption) ui.lightboxCaption.textContent = btn.dataset.imageAlt || '';
      ui.lightbox.showModal();
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
    if (state.prefs.interactionMode === 'quiet') return false;
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
    if (state.prefs.interactionMode !== 'quiet' && slide) {
      const cast = currentCastFor(slide);
      if (cast.items.length && cast.index < cast.items.length - 1) { stepCast(1); return; }
    }
    if (state.sectionIndex < state.slides.length - 1) { goSection(state.sectionIndex + 1); return; }
    markLectureCompleted();
    if (state.lectureIndex < state.meta.lectures.length - 1) { openLecture(state.lectureIndex + 1); return; }
    renderSection();
  }

  function prevReaderStep() {
    const slide = state.slides[state.sectionIndex];
    if (state.prefs.interactionMode !== 'quiet' && slide) {
      const cast = currentCastFor(slide);
      if (cast.items.length && cast.index >= 0) { stepCast(-1); return; }
    }
    if (state.sectionIndex > 0) { goSection(state.sectionIndex - 1); return; }
    if (state.lectureIndex > 0) {
      openLecture(state.lectureIndex - 1).then(() => goSection(Math.max(0, state.slides.length - 1), {preserveCompletion:true}));
    }
  }

  function stripForSearch(text) {
    return String(text || '').replace(/\[\[CLOZE\|([^\]|]+)(?:\|[^\]]*)?\]\]/g,'$1').replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[`*_>#]/g,' ').replace(/\s+/g,' ').trim();
  }
  function slideSearchText(slide) {
    if (!slide?.primary) return '';
    if (slide.primary.type === 'dialogue') return stripForSearch((slide.primary.dialogue?.entries || []).map(x=>x.content||'').join(' '));
    return stripForSearch(slide.primary.content || '');
  }
  function makeSnippet(text, query) {
    const clean=stripForSearch(text); const low=clean.toLowerCase(); const at=low.indexOf(query.toLowerCase());
    if(at<0) return clean.slice(0,150); const start=Math.max(0,at-55), end=Math.min(clean.length,at+query.length+90); return `${start?'…':''}${clean.slice(start,end)}${end<clean.length?'…':''}`;
  }
  async function searchLectureSource(lectureIndex, query) {
    const lec=state.meta.lectures[lectureIndex]; if(!lec) return [];
    let cached=state.searchCache.get(lec.id);
    if(!cached){ const source=await fetchText(`${state.seriesPath}/${lec.file}`); cached={source,slides:null}; state.searchCache.set(lec.id,cached); }
    if(!cached.slides){ const doc=Core.parseDocument(cached.source,{allowedSpeakers:['MUTE','ED']}); cached.slides=buildSlides(doc.blocks); }
    const q=query.toLowerCase(); const out=[];
    cached.slides.forEach((slide,sectionIndex)=>{const text=slideSearchText(slide); if(text.toLowerCase().includes(q)) out.push({lectureIndex,sectionIndex,lecture:lec,title: lec.title||lec.id,snippet:makeSnippet(text,query)});});
    return out;
  }
  function renderSearchPager() {
    const total=state.searchState.results.length, pages=Math.ceil(total/10); const page=state.searchState.page;
    if(!ui.searchPager) return; if(pages<=1){ui.searchPager.hidden=true;ui.searchPager.innerHTML='';return;}
    ui.searchPager.hidden=false; ui.searchPager.innerHTML=`<button type="button" data-page="${page-1}" ${page<=0?'disabled':''}>←</button><span>${page+1} / ${pages}</span><button type="button" data-page="${page+1}" ${page>=pages-1?'disabled':''}>→</button>`;
    ui.searchPager.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{state.searchState.page=Number(b.dataset.page);renderStudySearchResults();}));
  }
  function renderStudySearchResults() {
    const all=state.searchState.results, start=state.searchState.page*10, page=all.slice(start,start+10);
    ui.searchSummary.textContent=state.searchState.query ? `${all.length}건 · ${state.searchState.scope==='series'?'현재 시리즈':'현재 강의'}` : '검색어를 입력하세요.';
    ui.searchResults.innerHTML=page.length?page.map(r=>`<button type="button" class="study-search-result" data-lecture="${r.lectureIndex}" data-section="${r.sectionIndex}"><span>${esc(r.lecture.id)} · ${esc(r.title)}</span><strong>${esc(r.snippet)}</strong></button>`).join(''):(state.searchState.query?'<div class="search-empty">검색 결과가 없습니다.</div>':'');
    ui.searchResults.querySelectorAll('[data-lecture]').forEach(btn=>btn.addEventListener('click',async()=>{const li=Number(btn.dataset.lecture),si=Number(btn.dataset.section),q=state.searchState.query; if(li!==state.lectureIndex) await openLecture(li); goSection(si,{preserveCompletion:true}); ui.searchDialog.close(); requestAnimationFrame(()=>highlightSearchTerm(q));}));
    renderSearchPager();
  }
  async function runStudySearch() {
    const query=ui.searchInput.value.trim(); const scope=ui.searchScope.value; state.searchState={results:[],page:0,query,scope};
    if(!query){renderStudySearchResults();return;}
    ui.searchSummary.textContent='검색 중…';
    try{ let results=[]; if(scope==='lecture') results=await searchLectureSource(state.lectureIndex,query); else { const groups=await Promise.all(state.meta.lectures.map((_,i)=>searchLectureSource(i,query))); results=groups.flat(); } state.searchState.results=results; renderStudySearchResults(); }catch(err){ui.searchSummary.textContent=`검색 실패 · ${err.message}`;}
  }
  function highlightSearchTerm(query) {
    if(!query||!ui.reader) return; ui.reader.querySelectorAll('mark.search-hit').forEach(m=>m.replaceWith(document.createTextNode(m.textContent)));
    const walker=document.createTreeWalker(ui.reader,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('script,style,button,code')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}); const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
    const q=query.toLowerCase(); let first=null;
    nodes.forEach(node=>{const text=node.nodeValue,at=text.toLowerCase().indexOf(q);if(at<0)return;const frag=document.createDocumentFragment();frag.append(text.slice(0,at));const mark=document.createElement('mark');mark.className='search-hit';mark.textContent=text.slice(at,at+query.length);frag.append(mark,text.slice(at+query.length));node.replaceWith(frag);if(!first)first=mark;});
    first?.scrollIntoView({block:'center',behavior:'smooth'});
  }

  function renderLectureNav() {
    ui.prevLecture.disabled = state.lectureIndex <= 0;
    ui.nextLecture.disabled = state.lectureIndex >= state.meta.lectures.length - 1;
  }

  function goSection(index, options = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= state.slides.length) return;
    if (!options.preserveCompletion && state.reopenedCompleted && index > 0) clearLectureCompleted();
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

  let searchTimer;
  ui.searchToggle?.addEventListener('click',()=>{ui.searchDialog.showModal();ui.searchInput.focus();});
  ui.searchClose?.addEventListener('click',()=>ui.searchDialog.close());
  ui.searchInput?.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runStudySearch,180);});
  ui.searchScope?.addEventListener('change',runStudySearch);
  ui.lightboxClose?.addEventListener('click',()=>ui.lightbox.close());
  ui.lightbox?.addEventListener('click',e=>{if(e.target===ui.lightbox)ui.lightbox.close();});
  ui.immersiveToggle?.addEventListener('click', () => updatePrefs({immersive: !state.prefs.immersive}));
  ui.companionToggle?.addEventListener('click', () => { const order=['companions','messages','quiet']; const current=order.indexOf(state.prefs.interactionMode); const next=order[(current+1)%order.length]; updatePrefs({interactionMode:next}); renderStage(state.slides[state.sectionIndex]); bindStageEvents(); });
  ui.settingsToggle?.addEventListener('click', () => {
    const nextHidden = !ui.settingsPanel.hidden;
    ui.settingsPanel.hidden = nextHidden;
    ui.settingsToggle.setAttribute('aria-expanded', nextHidden ? 'false' : 'true');
  });
  ui.fontSelect?.addEventListener('change', () => updatePrefs({font: ui.fontSelect.value}));
  let customFontTimer;
  ui.customFont?.addEventListener('input', () => { clearTimeout(customFontTimer); customFontTimer=setTimeout(() => updatePrefs({customFont: ui.customFont.value}), 180); });
  ui.fontSize?.addEventListener('input', () => updatePrefs({fontSize: Number(ui.fontSize.value)}));
  ui.lineHeight?.addEventListener('input', () => updatePrefs({lineHeight: Number(ui.lineHeight.value)}));
  ui.alignSelect?.addEventListener('change', () => updatePrefs({align: ui.alignSelect.value}));
  ui.widthSelect?.addEventListener('change', () => updatePrefs({readerWidth: ui.widthSelect.value}));
  ui.paragraphSelect?.addEventListener('change', () => updatePrefs({paragraphSpacing: ui.paragraphSelect.value}));
  ui.linkMode?.addEventListener('change', () => { updatePrefs({showLinks: ui.linkMode.value !== 'text'}); renderSection(); });
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
      const maxStep = Math.max(0, entries.length - 2);
      if ((e.key === 'ArrowRight' || e.key === ' ') && entries.length > 4 && step < maxStep) { e.preventDefault(); setInteraction(key, step + 1); renderSection(); return; }
      if (e.key === 'ArrowLeft' && entries.length > 4 && step > 0) { e.preventDefault(); setInteraction(key, step - 1); renderSection(); return; }
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

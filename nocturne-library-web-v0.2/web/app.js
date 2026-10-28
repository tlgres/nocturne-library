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

  const state = { categories: [], catalog: [], seriesList: [], seriesPath: '', meta: null, lectureIndex: 0, doc: null, sections: [], sectionIndex: 0 };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function inlineMarkdown(text) {
    let s = esc(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return s;
  }

  function contentHtml(raw) {
    let text = String(raw || '').trim();
    let chapter = '';
    const m = text.match(/^■\s*([^\n]+)(?:\n+|$)/);
    if (m) { chapter = m[1].trim(); text = text.slice(m[0].length).trim(); }
    const paragraphs = text ? text.split(/\n{2,}/).map(p => `<p>${inlineMarkdown(p).replace(/\n/g, '<br>')}</p>`).join('') : '';
    return `${chapter ? `<h2 class="chapter">${esc(chapter)}</h2>` : ''}<div class="section-body">${paragraphs}</div>`;
  }

  function categoryFor(slug) { return state.categories.find(x => x.slug === slug); }
  function positionKey() { return state.meta ? `nocturne:webpos:v1:${state.meta.category}:${state.meta.id}:${state.meta.lectures[state.lectureIndex]?.id || state.lectureIndex}` : ''; }
  function savePosition() { const key = positionKey(); if (key) localStorage.setItem(key, String(state.sectionIndex)); }
  function restorePosition() { const key = positionKey(); const raw = key ? localStorage.getItem(key) : null; const n = Number(raw); return Number.isInteger(n) && n >= 0 && n < state.sections.length ? n : 0; }

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
    let seriesIdx = Math.max(0, state.seriesList.findIndex(x => x.data.id === seriesId || x.path === seriesId));
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
    const lecture = state.meta.lectures[state.lectureIndex];
    ui.lectureSelect.value = String(state.lectureIndex);
    ui.status.textContent = 'Loading…';
    const source = await fetchText(`${state.seriesPath}/${lecture.file}`);
    const report = Core.validateDocument(source);
    state.doc = Core.parseDocument(source, {allowedSpeakers:['MUTE','ED']});
    state.sections = state.doc.blocks.filter(b => ['normal','fast','focus','stop','side'].includes(b.type));
    const deferred = state.doc.blocks.length - state.sections.length;
    ui.notice.hidden = deferred === 0;
    if (deferred) ui.notice.textContent = `이 문서에는 ${deferred}개의 상호작용 블록이 있습니다. CAST · QUIZ · DIALOGUE는 Web Renderer phase 2 이후 표시됩니다.`;
    ui.lectureIndex.textContent = `Lecture ${String(state.lectureIndex + 1).padStart(2,'0')} · ${state.meta.lectures.length}`;
    ui.lectureTitle.textContent = state.doc.title || lecture.title || state.meta.title;
    state.sectionIndex = restorePosition();
    renderProgress(); renderSection(); renderLectureNav(); updateUrl();
    ui.status.textContent = `Nocturne Format ${state.doc.formatVersion}${report.warnings.length ? ` · ${report.warnings.length} warning` : ''}`;
  }

  function renderProgress() {
    ui.progress.innerHTML = state.sections.map((section, i) => `<button type="button" data-index="${i}" data-type="${esc(section.type)}" aria-label="${i+1}번째 구간으로 이동"></button>`).join('');
    ui.progress.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => goSection(Number(btn.dataset.index))));
  }

  function renderSection() {
    const section = state.sections[state.sectionIndex];
    if (!section) { ui.reader.innerHTML = '<div class="section"><div class="section-body"><p>표시할 Reader block이 없습니다.</p></div></div>'; return; }
    ui.reader.innerHTML = `<article class="section" data-type="${esc(section.type)}">${contentHtml(section.content)}</article>`;
    ui.progress.querySelectorAll('button').forEach((b,i) => b.classList.toggle('active', i === state.sectionIndex));
    ui.progressLabel.textContent = `${state.sectionIndex + 1} / ${state.sections.length}`;
    ui.blockState.textContent = section.type.toUpperCase();
    ui.sectionCount.textContent = `${state.sectionIndex + 1} / ${state.sections.length}`;
    ui.prevSection.disabled = state.sectionIndex <= 0;
    ui.nextSection.disabled = state.sectionIndex >= state.sections.length - 1;
    savePosition();
  }

  function renderLectureNav() {
    ui.prevLecture.disabled = state.lectureIndex <= 0;
    ui.nextLecture.disabled = state.lectureIndex >= state.meta.lectures.length - 1;
  }

  function goSection(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.sections.length) return;
    state.sectionIndex = index; renderSection(); window.scrollTo({top: Math.max(0, ui.reader.offsetTop - 120), behavior:'smooth'});
  }

  ui.prevSection.addEventListener('click', () => goSection(state.sectionIndex - 1));
  ui.nextSection.addEventListener('click', () => goSection(state.sectionIndex + 1));
  ui.prevLecture.addEventListener('click', () => openLecture(state.lectureIndex - 1));
  ui.nextLecture.addEventListener('click', () => openLecture(state.lectureIndex + 1));
  ui.lectureSelect.addEventListener('change', () => openLecture(Number(ui.lectureSelect.value)));
  ui.seriesSelect.addEventListener('change', () => openSeries(Number(ui.seriesSelect.value), 0));
  document.addEventListener('keydown', e => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
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

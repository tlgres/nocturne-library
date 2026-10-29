(() => {
  const repo = new WizardRepository.Repository();
  const $ = id => document.getElementById(id);
  const state = { series:null, existingLecture:null, validation:null, speakerDrafts:{}, dirty:false };
  const el = {};
  const ids = ['repoState','reconnectBtn','chooseRepoBtn','newSeriesBtn','libraryTree','categorySelect','seriesSelect','newLectureBtn','modeBanner','lectureTitle','lectureId','lectureFile','sourceInput','analyzeBtn','clearBtn','speakerPanel','speakerList','validationSummary','stats','issues','preview','saveMessage','saveBtn','seriesDialog','seriesForm','newSeriesCategory','newSeriesId','newSeriesTitle','newSeriesDescription','newSeriesKind','createSeriesBtn'];

  function initEls() { ids.forEach(id => el[id] = $(id)); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function setMessage(text, tone='') { el.saveMessage.textContent = text; el.saveMessage.dataset.tone = tone; }

  function populateCategorySelects() {
    const html = repo.categories.map(c => `<option value="${esc(c.slug)}">${esc(c.ko)} · ${esc(c.en)}</option>`).join('');
    el.categorySelect.innerHTML = html;
    el.newSeriesCategory.innerHTML = html;
  }

  function populateSeriesSelect(preferredId = null) {
    const cat = el.categorySelect.value;
    const candidates = repo.series.filter(s => s.meta?.category === cat);
    el.seriesSelect.innerHTML = candidates.map(s => `<option value="${esc(s.meta.id)}">${esc(s.meta.title)}</option>`).join('');
    if (preferredId && candidates.some(s => s.meta.id === preferredId)) el.seriesSelect.value = preferredId;
    state.series = repo.getSeriesById(el.seriesSelect.value);
    el.newLectureBtn.disabled = !state.series;
  }

  function renderTree() {
    if (!repo.root) return;
    const groups = repo.categories.map(cat => {
      const series = repo.series.filter(s => s.meta?.category === cat.slug);
      if (!series.length) return `<div class="tree-category empty-cat"><button data-cat="${cat.slug}"><span>${esc(cat.ko)}</span><small>0</small></button></div>`;
      return `<div class="tree-category"><button data-cat="${cat.slug}"><span>${esc(cat.ko)}</span><small>${series.length}</small></button>${series.map(s => `<div class="tree-series"><button data-series="${esc(s.meta.id)}">${esc(s.meta.title)}</button><div class="tree-lectures">${(s.meta.lectures||[]).map(l => `<button data-series="${esc(s.meta.id)}" data-lecture="${esc(l.id)}"><span>${esc(l.id)}</span>${esc(l.title)}</button>`).join('')}</div></div>`).join('')}</div>`;
    }).join('');
    el.libraryTree.innerHTML = groups;
    el.libraryTree.querySelectorAll('[data-cat]').forEach(btn => btn.addEventListener('click', () => {
      el.categorySelect.value = btn.dataset.cat; populateSeriesSelect(); if (state.series) beginNewLecture(false);
    }));
    el.libraryTree.querySelectorAll('[data-series]:not([data-lecture])').forEach(btn => btn.addEventListener('click', () => selectSeries(btn.dataset.series)));
    el.libraryTree.querySelectorAll('[data-lecture]').forEach(btn => btn.addEventListener('click', () => loadExistingLecture(btn.dataset.series, btn.dataset.lecture)));
  }

  function selectSeries(id) {
    const series = repo.getSeriesById(id); if (!series) return;
    el.categorySelect.value = series.meta.category; populateSeriesSelect(id); beginNewLecture(false);
  }

  function suggestLecture() {
    if (!state.series) return;
    const next = repo.suggestNextLecture(state.series);
    el.lectureId.value = next.id; el.lectureFile.value = next.file;
  }

  function beginNewLecture(clearSource = true) {
    state.existingLecture = null;
    state.speakerDrafts = {};
    el.modeBanner.textContent = '새 강의'; el.modeBanner.dataset.mode = 'new';
    el.lectureTitle.value = ''; suggestLecture();
    if (clearSource) el.sourceInput.value = '';
    analyze();
  }

  async function loadExistingLecture(seriesId, lectureId) {
    const series = repo.getSeriesById(seriesId); if (!series) return;
    const lecture = series.meta.lectures.find(x => x.id === lectureId); if (!lecture) return;
    el.categorySelect.value = series.meta.category; populateSeriesSelect(seriesId); state.series = series;
    const text = await repo.loadLecture(series, lecture);
    state.existingLecture = { ...lecture };
    el.modeBanner.textContent = `기존 강의 수정 · ${lecture.id}`; el.modeBanner.dataset.mode = 'edit';
    el.lectureTitle.value = lecture.title || '';
    el.lectureId.value = lecture.id; el.lectureFile.value = lecture.file;
    el.sourceInput.value = text;
    state.speakerDrafts = structuredClone(series.meta.dialogueSpeakers || {});
    analyze();
  }

  function deriveTitle() {
    const src = el.sourceInput.value;
    if (!src.trim()) return;
    const title = NocturneCore.parseDocument(src).title;
    if (!state.existingLecture || !el.lectureTitle.value.trim()) el.lectureTitle.value = title;
  }

  function validateContext() {
    if (!state.series) return {};
    const id = el.lectureId.value.trim(); const file = el.lectureFile.value.trim();
    const duplicate = state.series.meta.lectures.find(x => x.id === id && x.id !== state.existingLecture?.id);
    const base = file.replace(/\.md$/i,'');
    return { duplicateLectureId: duplicate ? id : '', fileMismatch: id && base !== id ? file : '' };
  }

  function renderValidation(result) {
    const errors = result.issues.filter(x => x.level === 'error').length;
    const warnings = result.issues.filter(x => x.level === 'warning').length;
    el.validationSummary.textContent = errors ? `${errors} 오류` : warnings ? `${warnings} 경고` : '통과';
    el.validationSummary.dataset.tone = errors ? 'error' : warnings ? 'warning' : 'ok';
    const s = result.stats;
    const items = [['문자',s.characters.toLocaleString()],['블록',s.blocks],['FOCUS',s.FOCUS||0],['STOP',s.STOP||0],['QUIZ',s.QUIZ||0],['CAST',s.CAST||0],['DIALOGUE',s.DIALOGUE||0],['CLOZE',s.CLOZE||0]];
    el.stats.innerHTML = items.map(([k,v]) => `<span><b>${esc(v)}</b>${esc(k)}</span>`).join('');
    el.issues.innerHTML = result.issues.length ? result.issues.map(x => `<div class="issue ${x.level}"><b>${x.level.toUpperCase()}</b><span>${esc(x.message)}</span></div>`).join('') : '<div class="issue ok"><b>OK</b><span>Format 1.0 검사에서 문제를 찾지 못했습니다.</span></div>';
    el.saveBtn.disabled = !repo.root || !state.series || !el.sourceInput.value.trim() || !result.valid;
  }

  function renderSpeakers(result) {
    const ids = result.stats.dialogueSpeakers || [];
    if (!ids.length) { el.speakerPanel.classList.add('hidden'); el.speakerList.innerHTML = ''; return; }
    el.speakerPanel.classList.remove('hidden');
    for (const id of ids) if (!state.speakerDrafts[id]) state.speakerDrafts[id] = structuredClone(state.series?.meta?.dialogueSpeakers?.[id] || { name:id, thumbnail:'' });
    el.speakerList.innerHTML = ids.map(id => {
      const p = state.speakerDrafts[id] || {};
      return `<div class="speaker-row" data-speaker="${esc(id)}"><div class="speaker-badge">${esc(id)}</div><div class="field"><label>표시 이름</label><input data-name value="${esc(p.name || id)}"></div><div class="speaker-thumb"><span>${p.thumbnail ? esc(p.thumbnail) : 'thumbnail 없음'}</span><button class="ghost" data-pick>파일 선택</button></div></div>`;
    }).join('');
    el.speakerList.querySelectorAll('.speaker-row').forEach(row => {
      const id = row.dataset.speaker;
      row.querySelector('[data-name]').addEventListener('input', e => state.speakerDrafts[id].name = e.target.value);
      row.querySelector('[data-pick]').addEventListener('click', async () => {
        try {
          const [handle] = await showOpenFilePicker({ multiple:false, types:[{ description:'Image', accept:{ 'image/*':['.png','.jpg','.jpeg','.webp','.gif'] } }] });
          const file = await handle.getFile();
          const path = await repo.saveSpeakerAsset(state.series, id, file);
          state.speakerDrafts[id].thumbnail = path;
          renderSpeakers(state.validation);
          setMessage(`${id} thumbnail 저장: ${path}`, 'ok');
        } catch (err) { if (err.name !== 'AbortError') setMessage(err.message, 'error'); }
      });
    });
  }

  function analyze() {
    deriveTitle();
    const result = WizardValidator.validate(el.sourceInput.value, validateContext());
    state.validation = result;
    renderValidation(result); renderSpeakers(result); WizardPreview.render(el.preview, result);
  }

  async function connect(choice) {
    try {
      el.repoState.textContent = '연결 중…';
      const ok = choice === 'reconnect' ? await repo.reconnect() : !!(await repo.chooseRoot());
      if (!ok) { el.repoState.textContent = 'Repository 미선택'; return; }
      el.repoState.textContent = `연결됨 · ${repo.root.name}`;
      populateCategorySelects(); renderTree();
      const firstSeries = repo.series.find(x => x.meta);
      if (firstSeries) { el.categorySelect.value = firstSeries.meta.category; populateSeriesSelect(firstSeries.meta.id); beginNewLecture(false); }
      setMessage('Repository를 읽었습니다.', 'ok');
    } catch (err) { el.repoState.textContent = '연결 실패'; setMessage(err.message, 'error'); }
  }

  async function save() {
    try {
      analyze(); if (!state.validation?.valid) throw new Error('ERROR를 먼저 수정하세요.');
      const seriesBefore = state.series;
      const result = await repo.saveLecture({ series:seriesBefore, id:el.lectureId.value, file:el.lectureFile.value, title:el.lectureTitle.value || state.validation.parsed.title, source:el.sourceInput.value, dialogueSpeakers:state.speakerDrafts, existingId:state.existingLecture?.id || null });
      state.series = result;
      state.existingLecture = result.meta.lectures.find(x => x.id === el.lectureId.value) || null;
      el.modeBanner.textContent = `저장됨 · ${el.lectureId.value}`; el.modeBanner.dataset.mode = 'saved';
      renderTree(); populateSeriesSelect(result.meta.id);
      setMessage(`${el.lectureFile.value} 저장 · meta.json 갱신 완료`, 'ok');
    } catch (err) { setMessage(err.message, 'error'); }
  }

  async function createSeries(event) {
    event.preventDefault();
    try {
      const series = await repo.createSeries({ category:el.newSeriesCategory.value, id:el.newSeriesId.value, title:el.newSeriesTitle.value, description:el.newSeriesDescription.value, kind:el.newSeriesKind.value });
      el.seriesDialog.close(); populateCategorySelects(); renderTree();
      el.categorySelect.value = series.meta.category; populateSeriesSelect(series.meta.id); state.series = series; beginNewLecture(true);
      setMessage(`새 시리즈 생성: ${series.meta.title}`, 'ok');
    } catch (err) { setMessage(err.message, 'error'); }
  }

  function wire() {
    el.chooseRepoBtn.addEventListener('click', () => connect('choose'));
    el.reconnectBtn.addEventListener('click', () => connect('reconnect'));
    el.categorySelect.addEventListener('change', () => { populateSeriesSelect(); beginNewLecture(true); });
    el.seriesSelect.addEventListener('change', () => { state.series = repo.getSeriesById(el.seriesSelect.value); beginNewLecture(true); });
    el.newLectureBtn.addEventListener('click', () => beginNewLecture(true));
    el.newSeriesBtn.addEventListener('click', () => { if (!repo.root) return setMessage('먼저 Repository를 선택하세요.', 'error'); el.newSeriesCategory.value = el.categorySelect.value || repo.categories[0]?.slug; el.seriesDialog.showModal(); });
    el.createSeriesBtn.addEventListener('click', createSeries);
    el.analyzeBtn.addEventListener('click', analyze);
    el.clearBtn.addEventListener('click', () => { if (el.sourceInput.value && !confirm('붙여넣은 강의를 비울까요?')) return; el.sourceInput.value=''; el.lectureTitle.value=''; analyze(); });
    let timer; el.sourceInput.addEventListener('input', () => { clearTimeout(timer); timer=setTimeout(analyze,220); });
    [el.lectureId, el.lectureFile].forEach(x => x.addEventListener('input', analyze));
    el.saveBtn.addEventListener('click', save);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initEls(); wire(); analyze();
    if (!window.showDirectoryPicker) setMessage('Chrome/Edge의 localhost 환경에서 열어주세요. File System Access API가 필요합니다.', 'error');
  });
})();

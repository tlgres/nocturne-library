(() => {
  const repo = new WizardRepository.Repository();
  const $ = id => document.getElementById(id);
  const state = { series:null, existingLecture:null, validation:null, speakerDrafts:{}, dirty:false, pendingCoverFile:null, coverCleared:false, expandedCats:new Set(), expandedSeries:new Set() };
  const el = {};
  const ids = ['repoState','reconnectBtn','chooseRepoBtn','newSeriesBtn','libraryTree','categorySelect','seriesSelect','newPrologueBtn','newLectureBtn','modeBanner','lectureTitle','lectureId','lectureFile','lectureVideoUrl','sourceInput','analyzeBtn','clearBtn','speakerPanel','speakerList','validationSummary','stats','issues','preview','saveMessage','saveBtn','seriesDialog','seriesForm','newSeriesCategory','newSeriesId','newSeriesTitle','newSeriesDescription','newSeriesKind','newSeriesCategoryField','createSeriesBtn','editSeriesBtn','seriesEditDialog','seriesEditForm','editSeriesTitle','editSeriesDescription','editSeriesPrologue','prologueCount','coverPreview','coverPath','pickCoverBtn','clearCoverBtn','saveSeriesMetaBtn','insertImageBtn','replaceToolBtn','stripLinksBtn','stripBoldBtn','deleteLectureBtn','replaceDialog','replaceFind','replaceWith','replaceCount','replaceAllBtn'];

  function initEls() { ids.forEach(id => el[id] = $(id)); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function setMessage(text, tone='') { el.saveMessage.textContent = text; el.saveMessage.dataset.tone = tone; }

  function populateCategorySelects() {
    const html = repo.categories.map(c => `<option value="${esc(c.slug)}">${esc(c.ko)} · ${esc(c.en)}</option>`).join('');
    const special = `${repo.series.some(s=>s.meta?.kind==='diary')?'<option value="__diary">유성 기록</option>':''}${repo.series.some(s=>s.meta?.kind==='journal')?'<option value="__journal">궤도 문헌실</option>':''}`;
    el.categorySelect.innerHTML = html + special;
    el.newSeriesCategory.innerHTML = html;
  }

  function populateSeriesSelect(preferredId = null) {
    const cat = el.categorySelect.value;
    const candidates = repo.series.filter(s => cat === '__diary' ? s.meta?.kind === 'diary' : cat === '__journal' ? s.meta?.kind === 'journal' : s.meta?.category === cat && !['diary','journal'].includes(s.meta?.kind));
    el.seriesSelect.innerHTML = candidates.map(s => `<option value="${esc(s.meta.id)}">${esc(s.meta.title)}</option>`).join('');
    if (preferredId && candidates.some(s => s.meta.id === preferredId)) el.seriesSelect.value = preferredId;
    state.series = repo.getSeriesById(el.seriesSelect.value);
    el.newLectureBtn.disabled = !state.series;
    if (el.newPrologueBtn) el.newPrologueBtn.disabled = !state.series || !!state.series?.meta?.lectures?.some(x => String(x.id) === '00');
    if (el.deleteLectureBtn) el.deleteLectureBtn.disabled = !state.existingLecture;
  }

  function renderTree() {
    if (!repo.root) return;
    const groups = [
      ...repo.categories.map(cat => ({key:cat.slug,label:cat.ko,items:repo.series.filter(s=>s.meta?.category===cat.slug&&!['diary','journal'].includes(s.meta?.kind))})),
      {key:'__diary',label:'유성 기록',items:repo.series.filter(s=>s.meta?.kind==='diary')},
      {key:'__journal',label:'궤도 문헌실',items:repo.series.filter(s=>s.meta?.kind==='journal')}
    ];
    el.libraryTree.innerHTML = groups.map(group => {
      const catOpen = state.expandedCats.has(group.key);
      const catHead = `<button class="tree-toggle" data-cat="${group.key}"><span class="tree-chevron">${catOpen?'▾':'▸'}</span><span>${esc(group.label)}</span><small>${group.items.length}</small></button>`;
      if (!group.items.length) return `<div class="tree-category empty-cat">${catHead}</div>`;
      const seriesHtml = catOpen ? group.items.map(item => {
        const seriesOpen = state.expandedSeries.has(item.meta.id);
        const lectures = seriesOpen ? `<div class="tree-lectures">${(item.meta.lectures||[]).map(l=>`<button data-series="${esc(item.meta.id)}" data-lecture="${esc(l.id)}"><span>${esc(l.id)}</span>${esc(l.title)}</button>`).join('')}</div>` : '';
        return `<div class="tree-series"><button data-series="${esc(item.meta.id)}"><span class="tree-chevron">${seriesOpen?'▾':'▸'}</span>${esc(item.meta.title)}</button>${lectures}</div>`;
      }).join('') : '';
      return `<div class="tree-category ${catOpen?'open':''}">${catHead}${seriesHtml}</div>`;
    }).join('');
    el.libraryTree.querySelectorAll('[data-cat]').forEach(btn=>btn.addEventListener('click',()=>{const cat=btn.dataset.cat;if(state.expandedCats.has(cat))state.expandedCats.delete(cat);else state.expandedCats.add(cat);el.categorySelect.value=cat;populateSeriesSelect();renderTree();}));
    el.libraryTree.querySelectorAll('[data-series]:not([data-lecture])').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.series,series=repo.getSeriesById(id);if(series)state.expandedCats.add(series.meta.kind==='diary'?'__diary':series.meta.kind==='journal'?'__journal':series.meta.category);if(state.expandedSeries.has(id))state.expandedSeries.delete(id);else state.expandedSeries.add(id);selectSeries(id);renderTree();}));
    el.libraryTree.querySelectorAll('[data-lecture]').forEach(btn=>btn.addEventListener('click',()=>{const series=repo.getSeriesById(btn.dataset.series);if(series){state.expandedCats.add(series.meta.kind==='diary'?'__diary':series.meta.kind==='journal'?'__journal':series.meta.category);state.expandedSeries.add(series.meta.id);}loadExistingLecture(btn.dataset.series,btn.dataset.lecture);}));
  }

  function selectSeries(id) {
    const series = repo.getSeriesById(id); if (!series) return;
    el.categorySelect.value = series.meta.kind==='diary'?'__diary':series.meta.kind==='journal'?'__journal':series.meta.category; populateSeriesSelect(id); beginNewLecture(false);
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
    if (el.lectureVideoUrl) el.lectureVideoUrl.value = '';
    if (clearSource) el.sourceInput.value = '';
    if (el.deleteLectureBtn) el.deleteLectureBtn.disabled = true;
    analyze();
  }

  function beginPrologue() {
    if (!state.series) return;
    if (state.series.meta.lectures?.some(x => String(x.id) === '00')) {
      setMessage('이 시리즈에는 이미 00 프롤로그가 있습니다.', 'error');
      return;
    }
    state.existingLecture = null;
    state.speakerDrafts = {};
    if (el.deleteLectureBtn) el.deleteLectureBtn.disabled = true;
    el.modeBanner.textContent = '새 프롤로그 · 00'; el.modeBanner.dataset.mode = 'new';
    el.lectureTitle.value = '프롤로그';
    el.lectureId.value = '00';
    el.lectureFile.value = '00.md';
    if (el.lectureVideoUrl) el.lectureVideoUrl.value = '';
    el.sourceInput.value = `# 프롤로그\n\n[[NORMAL]]\n\n[[END]]\n`;
    analyze();
    el.sourceInput.focus();
  }

  async function loadExistingLecture(seriesId, lectureId) {
    const series = repo.getSeriesById(seriesId); if (!series) return;
    const lecture = series.meta.lectures.find(x => x.id === lectureId); if (!lecture) return;
    el.categorySelect.value = series.meta.kind==='diary'?'__diary':series.meta.kind==='journal'?'__journal':series.meta.category; populateSeriesSelect(seriesId); state.series = series;
    const text = await repo.loadLecture(series, lecture);
    state.existingLecture = { ...lecture };
    state.expandedCats.add(series.meta.kind==='diary'?'__diary':series.meta.kind==='journal'?'__journal':series.meta.category); state.expandedSeries.add(series.meta.id); renderTree();
    el.modeBanner.textContent = `기존 강의 수정 · ${lecture.id}`; el.modeBanner.dataset.mode = 'edit';
    el.lectureTitle.value = lecture.title || '';
    el.lectureId.value = lecture.id; el.lectureFile.value = lecture.file;
    if (el.lectureVideoUrl) el.lectureVideoUrl.value = typeof lecture.video === 'string' ? lecture.video : (lecture.video?.url || '');
    el.sourceInput.value = text;
    state.speakerDrafts = structuredClone(series.meta.dialogueSpeakers || {});
    if (el.deleteLectureBtn) el.deleteLectureBtn.disabled = false;
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
    for (const id of ids) if (!state.speakerDrafts[id]) state.speakerDrafts[id] = structuredClone(state.series?.meta?.dialogueSpeakers?.[id] || { name:id, thumbnail:'', side:(String(id).toUpperCase()==='A'?'left':String(id).toUpperCase()==='B'?'right':'') });
    el.speakerList.innerHTML = ids.map(id => {
      const p = state.speakerDrafts[id] || {};
      return `<div class="speaker-row" data-speaker="${esc(id)}"><div class="speaker-badge">${esc(id)}</div><div class="field"><label>표시 이름</label><input data-name value="${esc(p.name || id)}"></div><div class="field speaker-side-field"><label>위치</label><select data-side><option value="" ${!p.side?'selected':''}>자동</option><option value="left" ${p.side==='left'?'selected':''}>왼쪽</option><option value="right" ${p.side==='right'?'selected':''}>오른쪽</option><option value="minor" ${p.side==='minor'?'selected':''}>보조</option></select></div><div class="speaker-thumb"><span>${p.thumbnail ? esc(p.thumbnail) : 'thumbnail 없음'}</span><button class="ghost" data-pick>파일 선택</button></div></div>`;
    }).join('');
    el.speakerList.querySelectorAll('.speaker-row').forEach(row => {
      const id = row.dataset.speaker;
      row.querySelector('[data-name]').addEventListener('input', e => state.speakerDrafts[id].name = e.target.value);
      row.querySelector('[data-side]').addEventListener('change', e => state.speakerDrafts[id].side = e.target.value);
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
      if (firstSeries) { el.categorySelect.value = firstSeries.meta.kind==='diary'?'__diary':firstSeries.meta.kind==='journal'?'__journal':firstSeries.meta.category; populateSeriesSelect(firstSeries.meta.id); beginNewLecture(false); }
      setMessage('Repository를 읽었습니다.', 'ok');
    } catch (err) { el.repoState.textContent = '연결 실패'; setMessage(err.message, 'error'); }
  }

  async function save() {
    try {
      analyze(); if (!state.validation?.valid) throw new Error('ERROR를 먼저 수정하세요.');
      const seriesBefore = state.series;
      const result = await repo.saveLecture({ series:seriesBefore, id:el.lectureId.value, file:el.lectureFile.value, title:el.lectureTitle.value || state.validation.parsed.title, source:el.sourceInput.value, dialogueSpeakers:state.speakerDrafts, videoUrl:el.lectureVideoUrl?.value || '', existingId:state.existingLecture?.id || null });
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
      el.categorySelect.value = series.meta.kind==='diary'?'__diary':series.meta.kind==='journal'?'__journal':series.meta.category; populateSeriesSelect(series.meta.id); state.series = series; beginNewLecture(true);
      setMessage(`새 시리즈 생성: ${series.meta.title}`, 'ok');
    } catch (err) { setMessage(err.message, 'error'); }
  }


  function renderCoverPreview(series, pendingFile = null) {
    const meta = series?.meta || {};
    el.coverPreview.innerHTML = '';
    if (pendingFile) {
      const img = document.createElement('img'); img.alt = '선택한 표지'; img.src = URL.createObjectURL(pendingFile); el.coverPreview.appendChild(img);
      el.coverPath.textContent = pendingFile.name;
    } else if (meta.cover && !state.coverCleared) {
      el.coverPreview.innerHTML = `<div class="cover-existing"><strong>${esc(meta.title)}</strong><small>${esc(meta.cover)}</small></div>`;
      el.coverPath.textContent = meta.cover;
    } else {
      el.coverPreview.innerHTML = `<div class="cover-existing"><strong>${esc(meta.title || '제목형 표지')}</strong><small>typographic cover</small></div>`;
      el.coverPath.textContent = '이미지 없음 · 제목형 표지를 사용합니다.';
    }
  }

  function openSeriesEditor() {
    if (!state.series) return setMessage('시리즈를 먼저 선택하세요.', 'error');
    state.pendingCoverFile = null; state.coverCleared = false;
    el.editSeriesTitle.value = state.series.meta.title || '';
    el.editSeriesDescription.value = state.series.meta.description || '';
    el.editSeriesPrologue.value = state.series.meta.prologue || '';
    el.prologueCount.textContent = `${el.editSeriesPrologue.value.length} / 500`;
    renderCoverPreview(state.series);
    el.seriesEditDialog.showModal();
  }

  async function saveSeriesMetadata(event) {
    event.preventDefault();
    try {
      let cover;
      if (state.pendingCoverFile) cover = await repo.saveCoverAsset(state.series, state.pendingCoverFile);
      else if (state.coverCleared) cover = null;
      else cover = state.series.meta.cover || '';
      const updated = await repo.updateSeriesMetadata(state.series, { title:el.editSeriesTitle.value, description:el.editSeriesDescription.value, prologue:el.editSeriesPrologue.value, cover });
      state.series = updated;
      el.seriesEditDialog.close();
      renderTree(); populateSeriesSelect(updated.meta.id);
      setMessage('책 정보와 표지를 저장했습니다.', 'ok');
    } catch (err) { setMessage(err.message, 'error'); }
  }

  function wire() {
    el.chooseRepoBtn.addEventListener('click', () => connect('choose'));
    el.reconnectBtn.addEventListener('click', () => connect('reconnect'));
    el.categorySelect.addEventListener('change', () => { populateSeriesSelect(); beginNewLecture(true); });
    el.seriesSelect.addEventListener('change', () => { state.series = repo.getSeriesById(el.seriesSelect.value); beginNewLecture(true); });
    el.editSeriesBtn.addEventListener('click', openSeriesEditor);
    el.newLectureBtn.addEventListener('click', () => beginNewLecture(true));
    el.newPrologueBtn.addEventListener('click', beginPrologue);
    el.newSeriesBtn.addEventListener('click', () => { if (!repo.root) return setMessage('먼저 Repository를 선택하세요.', 'error'); el.newSeriesKind.value='lecture'; const desired=repo.categories.some(c=>c.slug===el.categorySelect.value)?el.categorySelect.value:repo.categories[0]?.slug; el.newSeriesCategory.value=desired||''; el.newSeriesCategory.disabled=false; el.newSeriesCategoryField?.classList.remove('is-disabled'); el.seriesDialog.showModal(); });
    el.createSeriesBtn.addEventListener('click', createSeries);
    el.insertImageBtn.addEventListener('click', async () => {
      if (!state.series) return setMessage('시리즈를 먼저 선택하세요.', 'error');
      try {
        const [handle] = await showOpenFilePicker({ multiple:false, types:[{ description:'Lecture image', accept:{ 'image/*':['.png','.jpg','.jpeg','.webp','.gif','.avif'] } }] });
        const file = await handle.getFile();
        const path = await repo.saveLectureImageAsset(state.series, file);
        const altDefault = String(file.name || 'image').replace(/\.[^.]+$/, '');
        const alt = prompt('이미지 설명/캡션을 입력하세요.', altDefault);
        if (alt === null) return;
        const snippet = `\n\n![${String(alt).replace(/\]/g, '\\]')}](${path})\n\n`;
        const start = el.sourceInput.selectionStart ?? el.sourceInput.value.length;
        const end = el.sourceInput.selectionEnd ?? start;
        el.sourceInput.setRangeText(snippet, start, end, 'end');
        analyze();
        el.sourceInput.focus();
        setMessage(`이미지 저장 및 Markdown 삽입: ${path}`, 'ok');
      } catch (err) { if (err.name !== 'AbortError') setMessage(err.message, 'error'); }
    });
    el.analyzeBtn.addEventListener('click', analyze);
    el.clearBtn.addEventListener('click', () => { if (el.sourceInput.value && !confirm('붙여넣은 강의를 비울까요?')) return; el.sourceInput.value=''; el.lectureTitle.value=''; analyze(); });
    el.stripLinksBtn.addEventListener('click', () => {
      let count=0;
      el.sourceInput.value = el.sourceInput.value.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_m,label)=>{count++;return label;});
      if(!count)return setMessage('Markdown 링크가 없습니다.');
      analyze(); setMessage(`링크 ${count}개 제거 · 표시문자는 유지`, 'ok');
    });
    el.stripBoldBtn.addEventListener('click', () => {
      const count = (el.sourceInput.value.match(/\*\*/g) || []).length;
      if (!count) return setMessage('** 문자열이 없습니다.');
      el.sourceInput.value = el.sourceInput.value.split('**').join(''); analyze(); setMessage(`** ${count}개 제거`, 'ok');
    });
    const updateReplaceCount = () => { const f=el.replaceFind.value; const n=f ? el.sourceInput.value.split(f).length-1 : 0; el.replaceCount.textContent=`${n}개 발견`; };
    el.replaceToolBtn.addEventListener('click', () => { el.replaceFind.value=''; el.replaceWith.value=''; updateReplaceCount(); el.replaceDialog.showModal(); setTimeout(()=>el.replaceFind.focus(),0); });
    el.replaceFind.addEventListener('input', updateReplaceCount);
    el.replaceAllBtn.addEventListener('click', () => { const f=el.replaceFind.value; if(!f) return; const n=el.sourceInput.value.split(f).length-1; if(!n) return updateReplaceCount(); el.sourceInput.value=el.sourceInput.value.split(f).join(el.replaceWith.value); el.replaceDialog.close(); analyze(); setMessage(`${n}개 문자열 변경 완료`, 'ok'); });
    let timer; el.sourceInput.addEventListener('input', () => { clearTimeout(timer); timer=setTimeout(analyze,220); });
    [el.lectureId, el.lectureFile].forEach(x => x.addEventListener('input', analyze));
    el.pickCoverBtn.addEventListener('click', async () => { try { const [handle] = await showOpenFilePicker({multiple:false,types:[{description:'Cover image',accept:{'image/*':['.png','.jpg','.jpeg','.webp']}}]}); state.pendingCoverFile = await handle.getFile(); state.coverCleared = false; renderCoverPreview(state.series, state.pendingCoverFile); } catch(err) { if(err.name !== 'AbortError') setMessage(err.message,'error'); } });
    el.clearCoverBtn.addEventListener('click', () => { state.pendingCoverFile = null; state.coverCleared = true; renderCoverPreview(state.series); });
    el.editSeriesPrologue.addEventListener('input', () => el.prologueCount.textContent = `${el.editSeriesPrologue.value.length} / 500`);
    el.saveSeriesMetaBtn.addEventListener('click', saveSeriesMetadata);

    el.deleteLectureBtn.addEventListener('click', async () => {
      if(!state.series || !state.existingLecture) return;
      const lec={...state.existingLecture};
      if(!confirm(`강의 ${lec.id} · ${lec.title || lec.file}

${lec.file} 파일과 목차 항목을 삭제합니다. 계속할까요?`)) return;
      try{
        const updated=await repo.deleteLecture(state.series,lec.id);
        state.series=updated; state.existingLecture=null; state.speakerDrafts={};
        populateCategorySelects(); el.categorySelect.value=updated.meta.kind==='diary'?'__diary':updated.meta.kind==='journal'?'__journal':updated.meta.category; populateSeriesSelect(updated.meta.id); renderTree(); beginNewLecture(true);
        setMessage(`${lec.file} 삭제 · meta.json 갱신 완료`,'ok');
      }catch(err){setMessage(err.message,'error');}
    });
    const syncSeriesKind = () => {
      const special=['diary','journal'].includes(el.newSeriesKind.value);
      el.newSeriesCategory.disabled=special;
      el.newSeriesCategoryField?.classList.toggle('is-disabled',special);
    };
    el.newSeriesKind.addEventListener('change',syncSeriesKind); syncSeriesKind();

    el.saveBtn.addEventListener('click', save);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initEls(); wire(); analyze();
    if (!window.showDirectoryPicker) setMessage('Chrome/Edge의 localhost 환경에서 열어주세요. File System Access API가 필요합니다.', 'error');
  });
})();

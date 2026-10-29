(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ui = {
    ring:$('ring'), scene:$('ring-scene'), dots:$('ring-dots'), prev:$('ring-prev'), next:$('ring-next'),
    symbol:$('category-symbol'), title:$('category-title'), en:$('category-en'), description:$('category-description'), stats:$('category-stats'),
    enter:$('enter-shelf'), allInShelf:$('all-in-shelf'), categorySeries:$('category-series'),
    panel:$('nav-panel'), panelTitle:$('nav-panel-title'), panelKicker:$('nav-panel-kicker'), searchView:$('panel-search'), recentView:$('panel-recent'), allView:$('panel-all'),
    search:$('library-search'), searchResults:$('search-results'), recentResults:$('recent-results'), allCategories:$('all-categories'), starCanvas:$('star-canvas'),
    portal:$('portal-panel'), portalSymbol:$('portal-panel-symbol'), portalLabel:$('portal-panel-label'), portalTitle:$('portal-panel-title'), portalContent:$('portal-panel-content'), portalMore:$('portal-panel-more')
  };
  const state = { categories:[], series:[], index:6, angle:0, dragging:false, dragStartX:0, dragStartAngle:0, lastWheel:0 };
  const descriptions = {
    'basic-med':'인체의 구조와 기능, 병태생리와 기초 의생명과학을 다루는 서가.',
    'clin-med':'환자와 질병, 진단과 치료를 중심으로 임상의학을 읽는 서가.',
    'science':'물질과 생명, 자연의 법칙을 따라가는 과학 강의의 서가.',
    'math-cs':'수학적 구조와 계산, 알고리즘과 컴퓨터의 언어를 다루는 서가.',
    'language':'언어의 구조와 사용, 외국어와 언어학을 함께 탐색하는 서가.',
    'history':'시간과 장소, 문명과 지리의 층위를 따라가는 서가.',
    'philosophy':'개념과 논증, 사상과 세계관을 길게 사유하는 서가.',
    'religion':'종교와 신화, 신비주의와 초월의 언어를 다루는 서가.',
    'law':'법과 규칙, 제도와 권리의 구조를 읽는 서가.',
    'pol-econ':'권력과 시장, 국가와 경제의 움직임을 살피는 서가.',
    'soc-edu':'사회와 집단, 교육과 제도의 작동 방식을 다루는 서가.',
    'culture':'교양과 취향, 생활의 기술과 처세를 가볍고 넓게 다루는 서가.'
  };
  const categoryColors = ['#91a9c7','#8ca3bf','#829caf','#9a91bb','#a38fb5','#8fa7a0','#9b91c7','#8ea6c8','#a498bd','#b09a9d','#879fae','#a18da8'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fetchJson = async url => { const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); };
  const cyclicDistance = (a,b,n) => { const d=Math.abs(a-b); return Math.min(d,n-d); };
  const normalizedIndex = i => ((i % state.categories.length)+state.categories.length)%state.categories.length;

  async function boot() {
    const [cats, library] = await Promise.all([fetchJson('categories.json'), fetchJson('library.json')]);
    state.categories = cats.categories || [];
    state.series = await Promise.all((library.series || []).map(async item => ({...item, data:await fetchJson(item.meta)})));
    const saved = localStorage.getItem('nocturne:front-category:v1');
    const fromSaved = state.categories.findIndex(x => x.slug === saved);
    state.index = fromSaved >= 0 ? fromSaved : Math.max(0,state.categories.findIndex(x => x.slug === 'philosophy'));
    buildRing(); bind(); select(state.index, false); renderAllCategories(); renderRecentPanel(); setupStars();
  }

  function buildRing() {
    const n=state.categories.length;
    ui.ring.innerHTML=state.categories.map((cat,i)=>`<button class="ring-item" type="button" data-index="${i}" style="--accent:${categoryColors[i % categoryColors.length]};transform:rotateY(${i*360/n}deg) translateZ(var(--ring-radius))">
      <span class="ring-copy"><strong>${esc(cat.ko)}</strong><em>${esc(cat.en)}</em></span></button>`).join('');
    ui.dots.innerHTML=state.categories.map((cat,i)=>`<button class="ring-dot" type="button" data-index="${i}" aria-label="${esc(cat.ko)}"></button>`).join('');
  }

  function closestTargetAngle(index) {
    const n=state.categories.length;
    const canonical = -index * 360/n;
    const candidates=[canonical-360,canonical,canonical+360,canonical+720,canonical-720];
    return candidates.reduce((best,x)=>Math.abs(x-state.angle)<Math.abs(best-state.angle)?x:best,candidates[0]);
  }

  function select(index, animate=true) {
    if (!state.categories.length) return;
    state.index=normalizedIndex(index);
    state.angle=closestTargetAngle(state.index);
    ui.ring.classList.toggle('no-animate',!animate);
    ui.ring.style.transform=`rotateY(${state.angle}deg)`;
    requestAnimationFrame(()=>ui.ring.classList.remove('no-animate'));
    updateVisibility(); updateFocus();
    localStorage.setItem('nocturne:front-category:v1',state.categories[state.index].slug);
  }

  function updateVisibility() {
    const n=state.categories.length;
    ui.ring.querySelectorAll('.ring-item').forEach((el,i)=>{
      const d=cyclicDistance(i,state.index,n);
      el.classList.toggle('is-focus',d===0);
      el.classList.toggle('is-adjacent',d===1);
      el.classList.toggle('is-near',d===2);
      el.classList.toggle('is-far',d>2);
      el.tabIndex=d<=2?0:-1;
    });
    ui.dots.querySelectorAll('.ring-dot').forEach((el,i)=>el.classList.toggle('active',i===state.index));
  }

  function seriesForCategory(slug) { return state.series.filter(s=>s.data.category===slug); }
  function stampOf(s) {
    const raw=s.data.updatedAt || s.data.createdAt || s.data.publishedAt || '';
    const t=raw?Date.parse(raw):NaN;
    return Number.isFinite(t)?t:0;
  }
  function sortedRecent(items) { return [...items].sort((a,b)=>stampOf(b)-stampOf(a) || state.series.indexOf(b)-state.series.indexOf(a)); }

  function updateFocus() {
    const cat=state.categories[state.index]; if(!cat) return;
    const items=seriesForCategory(cat.slug);
    const lectures=items.reduce((sum,s)=>sum+(s.data.lectures?.length||0),0);
    ui.symbol.textContent='✦';
    ui.title.textContent=cat.ko; ui.en.textContent=cat.en;
    ui.description.textContent=cat.description || descriptions[cat.slug] || '';
    ui.stats.textContent=`시리즈 ${items.length} · 강의 ${lectures}`;
    const shelf=`shelf.html?category=${encodeURIComponent(cat.slug)}`;
    ui.enter.href=shelf; ui.allInShelf.href=shelf;
    const recent=sortedRecent(items).slice(0,3);
    ui.categorySeries.innerHTML=recent.length?recent.map(seriesCard).join(''):`<div class="empty-series">아직 이 서가에 공개된 시리즈가 없습니다.</div>`;
  }

  function seriesCard(s) {
    const cat=state.categories.find(c=>c.slug===s.data.category);
    const count=s.data.lectures?.length||0;
    return `<a class="series-card" href="shelf.html?category=${encodeURIComponent(s.data.category)}&series=${encodeURIComponent(s.data.id)}">
      <small>${count}강</small><div><strong>${esc(s.data.title)}</strong><p>${esc(s.data.description||'')}</p></div></a>`;
  }

  function bind() {
    ui.prev.addEventListener('click',()=>select(state.index-1)); ui.next.addEventListener('click',()=>select(state.index+1));
    ui.ring.addEventListener('click',e=>{ const item=e.target.closest('.ring-item'); if(item) select(Number(item.dataset.index)); });
    ui.dots.addEventListener('click',e=>{ const dot=e.target.closest('.ring-dot'); if(dot) select(Number(dot.dataset.index)); });
    ui.scene.addEventListener('keydown',e=>{ if(e.key==='ArrowLeft'){e.preventDefault();select(state.index-1);} if(e.key==='ArrowRight'){e.preventDefault();select(state.index+1);} if(e.key==='Enter'){location.href=ui.enter.href;} });
    ui.scene.addEventListener('wheel',e=>{
      if(Math.abs(e.deltaY)<5 && Math.abs(e.deltaX)<5) return;
      e.preventDefault(); const now=performance.now(); if(now-state.lastWheel<180) return; state.lastWheel=now;
      const delta=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX; select(state.index+(delta>0?1:-1));
    },{passive:false});
    ui.scene.addEventListener('pointerdown',e=>{ state.dragging=true; state.dragStartX=e.clientX; state.dragStartAngle=state.angle; ui.ring.classList.add('is-dragging'); ui.scene.setPointerCapture(e.pointerId); });
    ui.scene.addEventListener('pointermove',e=>{ if(!state.dragging)return; const dx=e.clientX-state.dragStartX; state.angle=state.dragStartAngle+dx*.18; ui.ring.style.transform=`rotateY(${state.angle}deg)`; });
    const endDrag=e=>{ if(!state.dragging)return; state.dragging=false; ui.ring.classList.remove('is-dragging'); const step=360/state.categories.length; const nearest=normalizedIndex(Math.round(-state.angle/step)); select(nearest); try{ui.scene.releasePointerCapture(e.pointerId);}catch{} };
    ui.scene.addEventListener('pointerup',endDrag); ui.scene.addEventListener('pointercancel',endDrag);
    document.querySelectorAll('[data-open-panel]').forEach(b=>b.addEventListener('click',()=>openPanel(b.dataset.openPanel)));
    document.querySelectorAll('[data-open-portal]').forEach(b=>b.addEventListener('click',()=>openPortal(b.dataset.openPortal)));
    document.querySelectorAll('[data-close-portal]').forEach(b=>b.addEventListener('click',closePortal));
    document.querySelectorAll('[data-close-panel]').forEach(b=>b.addEventListener('click',closePanel));
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(!ui.panel.hidden)closePanel(); if(ui.portal && !ui.portal.hidden)closePortal(); } });
    ui.search.addEventListener('input',renderSearch);
  }

  function openPanel(view) {
    ui.panel.hidden=false; [ui.searchView,ui.recentView,ui.allView].forEach(x=>x.hidden=true);
    if(view==='search'){ui.searchView.hidden=false;ui.panelTitle.textContent='검색';ui.panelKicker.textContent='서재에서 찾기';setTimeout(()=>ui.search.focus(),0);renderSearch();}
    if(view==='recent'){ui.recentView.hidden=false;ui.panelTitle.textContent='최근 강의';ui.panelKicker.textContent='최근 등록';}
    if(view==='all'){ui.allView.hidden=false;ui.panelTitle.textContent='전체 서가';ui.panelKicker.textContent='12개 카테고리';}
  }
  function closePanel(){ui.panel.hidden=true;}

  async function openPortal(view) {
    const cfg={
      about:{symbol:'◐',label:'관측소',title:'관측소',more:'auxiliary.html?view=about'},
      diary:{symbol:'☄',label:'유성 기록',title:'유성 기록',more:'auxiliary.html?view=diary'},
      journal:{symbol:'◉',label:'궤도 문헌실',title:'궤도 문헌실',more:'auxiliary.html?view=journal'}
    }[view];
    if(!cfg || !ui.portal) return;
    ui.portal.hidden=false; ui.portalSymbol.textContent=cfg.symbol; ui.portalLabel.textContent=cfg.label; ui.portalTitle.textContent=cfg.title; ui.portalMore.href=cfg.more;
    if(view==='about'){
      try{
        const data=await fetchJson('about.json');
        const manifesto=(data.manifesto||[]).map(line=>line?`<p>${esc(line)}</p>`:'<div class="manifesto-gap"></div>').join('');
        ui.portalContent.innerHTML=`<div class="manifesto">${manifesto}</div><div class="portal-about-meta"><strong>${esc(data.author||'저자')}</strong><span>${esc(data.bio||'')}</span></div>`;
      }catch(e){ui.portalContent.textContent=e.message;}
      return;
    }
    const rows=state.series.filter(s => (s.data.kind||s.data.section)===view);
    ui.portalContent.innerHTML=rows.length?rows.slice(0,6).map(s=>`<a class="portal-series" href="shelf.html?category=${encodeURIComponent(s.data.category)}&series=${encodeURIComponent(s.data.id)}"><strong>${esc(s.data.title)}</strong><span>${esc(s.data.description||'')}</span></a>`).join(''):`<div class="empty-series">아직 공개된 ${view==='diary'?'기록':'문헌 노트'}가 없습니다.</div>`;
  }
  function closePortal(){ if(ui.portal) ui.portal.hidden=true; }

  function renderSearch() {
    const q=ui.search.value.trim().toLowerCase();
    if(!q){ui.searchResults.innerHTML='<div class="empty-series">시리즈·강의 제목이나 카테고리를 입력하세요.</div>';return;}
    const results=[];
    state.series.forEach(s=>{
      const cat=state.categories.find(c=>c.slug===s.data.category);
      if([s.data.title,s.data.description,cat?.ko,cat?.en].some(x=>String(x||'').toLowerCase().includes(q))) results.push({type:'series',s,cat});
      (s.data.lectures||[]).forEach((lec,i)=>{ if(String(lec.title||'').toLowerCase().includes(q)) results.push({type:'lecture',s,cat,lec,i}); });
    });
    ui.searchResults.innerHTML=results.slice(0,30).map(r=> r.type==='series'
      ? `<a class="result-row" href="shelf.html?category=${encodeURIComponent(r.s.data.category)}&series=${encodeURIComponent(r.s.data.id)}"><small>${esc(r.cat?.ko||'')}</small><strong>${esc(r.s.data.title)}</strong><span>시리즈 →</span></a>`
      : `<a class="result-row" href="study.html?series=${encodeURIComponent(r.s.data.id)}&lecture=${encodeURIComponent(r.lec.id)}"><small>${esc(r.s.data.title)}</small><strong>${esc(r.lec.title||r.lec.id)}</strong><span>강의 →</span></a>`).join('') || '<div class="empty-series">검색 결과가 없습니다.</div>';
  }

  function renderRecentPanel() {
    const recent=sortedRecent(state.series).slice(0,12);
    ui.recentResults.innerHTML=recent.map(s=>{const c=state.categories.find(x=>x.slug===s.data.category);return `<a class="result-row" href="shelf.html?category=${encodeURIComponent(s.data.category)}&series=${encodeURIComponent(s.data.id)}"><small>${esc(c?.ko||'')}</small><strong>${esc(s.data.title)}</strong><span>${s.data.lectures?.length||0}강</span></a>`}).join('') || '<div class="empty-series">아직 등록된 시리즈가 없습니다.</div>';
  }
  function renderAllCategories() {
    ui.allCategories.innerHTML=state.categories.map((c,i)=>`<a class="category-mini" href="shelf.html?category=${encodeURIComponent(c.slug)}"><small>${String(i+1).padStart(2,'0')}</small><strong>${esc(c.ko)}</strong></a>`).join('');
  }

  function setupStars() {
    const canvas=ui.starCanvas, ctx=canvas.getContext('2d'); if(!ctx)return;
    let stars=[]; const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize=()=>{const d=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*d;canvas.height=innerHeight*d;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(d,0,0,d,0,0);stars=Array.from({length:Math.min(130,Math.floor(innerWidth*innerHeight/11000))},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:.35+Math.random()*1.15,a:.15+Math.random()*.55,p:Math.random()*Math.PI*2,s:.002+Math.random()*.006}));};
    const draw=t=>{ctx.clearRect(0,0,innerWidth,innerHeight);for(const s of stars){const a=reduce?s.a:s.a*(.72+.28*Math.sin(t*s.s+s.p));ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle=`rgba(210,215,235,${a})`;ctx.fill();}requestAnimationFrame(draw);};
    addEventListener('resize',resize);resize();requestAnimationFrame(draw);
  }
  boot().catch(err=>{console.error(err);document.body.insertAdjacentHTML('beforeend',`<pre style="position:fixed;left:20px;bottom:20px;color:#e8a7b4">${esc(err.message)}</pre>`);});
})();

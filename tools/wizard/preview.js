(() => {
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function inline(text) {
    return esc(text).replace(/\[\[CLOZE\|([^\]|]+)(?:\|([^\]]+))?\]\]/gi, (_, answer, hint) => `<span class="pv-cloze" title="${esc(hint || 'CLOZE')}">${esc(hint || '••••••')}</span>`).replace(/\n/g,'<br>');
  }
  function render(target, result) {
    if (!target) return;
    const parsed = result?.parsed;
    if (!parsed) { target.innerHTML = '<p class="empty">붙여넣은 강의를 분석하면 미리보기가 나타납니다.</p>'; return; }
    const blocks = parsed.blocks.map((b, i) => {
      if (['normal','fast','focus','stop','side'].includes(b.type)) return `<section class="pv-block pv-${b.type}"><small>${b.type.toUpperCase()}</small><div>${inline(b.content)}</div></section>`;
      if (b.type === 'cast') return `<section class="pv-interaction"><small>CAST · ${esc(b.speaker)} · ${esc(b.expression)}</small><div>${inline(b.content)}</div></section>`;
      if (b.type === 'quiz') return `<section class="pv-interaction"><small>QUIZ · ${esc(b.quiz.kind.toUpperCase())}</small><div>${inline(b.quiz.question)}</div></section>`;
      if (b.type === 'dialogue') return `<section class="pv-dialogue"><small>DIALOGUE</small>${b.dialogue.entries.slice(0,6).map(e => `<div><b>${esc(e.narrator ? 'NARRATOR' : e.rawSpeaker)}</b> ${inline(e.content)}</div>`).join('')}${b.dialogue.entries.length > 6 ? '<div>…</div>' : ''}</section>`;
      return '';
    }).join('');
    target.innerHTML = `<h2>${esc(parsed.title)}</h2>${blocks || '<p class="empty">표시할 블록이 없습니다.</p>'}`;
  }
  globalThis.WizardPreview = { render };
})();

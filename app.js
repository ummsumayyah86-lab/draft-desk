/* draft-desk lite — textarea editors */
(function () {
  'use strict';
  var STORAGE_KEY = 'draftDesk.marks.v1';
  var FIELDS = ['fallacies', 'political', 'testable', 'conflict', 'sowhat'];
  var PLACE = {
    fallacies: 'Blank. Name the move, then a line from the piece.',
    political: 'Blank. Who benefits, what is framed, what is left out.',
    testable: 'Blank. Claims you could check, and what would falsify them.',
    conflict: 'Blank. Where values, interests, or facts collide.',
    sowhat: 'One or two lines.'
  };
  var editors = {};
  var lastEditor = null;
  var saveDebounce = null;
  var state = { currentId: null, drafts: {} };

  function el(id) { return document.getElementById(id); }
  function uid() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nowIso() { return new Date().toISOString(); }
  function blankField() { return { text: '', fontSize: '16pt', lineHeight: '1.5' }; }
  function blankPrompts() {
    return { claim: false, evidence: false, steelman: false, incentive: false, assumption: false, hypocrisy: false };
  }
  function newDraft(name) {
    var d = { id: uid(), name: name || 'Untitled draft', created: nowIso(), updated: nowIso(),
      pieceTitle: '', sourceUrl: '', articleText: '', fields: {}, prompts: blankPrompts() };
    FIELDS.forEach(function (k) { d.fields[k] = blankField(); });
    return d;
  }
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeStore() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  function current() { return state.drafts[state.currentId]; }
  function setStatus(kind, text) {
    var n = el('saveStatus');
    if (!n) return;
    n.className = 'save-status' + (kind ? ' ' + kind : '');
    n.textContent = text;
  }
  function formatWhen(iso) {
    try {
      return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) { return iso || ''; }
  }
  function htmlToText(html) {
    var box = document.createElement('div');
    box.innerHTML = String(html || '');
    return (box.innerText || '').replace(/\u00a0/g, ' ').trim();
  }
  function normalizeField(raw) {
    if (!raw) return blankField();
    if (typeof raw.text === 'string') return { text: raw.text, fontSize: raw.fontSize || '16pt', lineHeight: raw.lineHeight || '1.5' };
    return { text: htmlToText(raw.html || ''), fontSize: raw.fontSize || '16pt', lineHeight: raw.lineHeight || '1.5' };
  }
  function collectInto(d) {
    if (!d) return;
    d.name = (el('draftName') && el('draftName').value || '').trim() || 'Untitled draft';
    d.pieceTitle = el('pieceTitle') ? el('pieceTitle').value : '';
    d.sourceUrl = el('sourceUrl') ? el('sourceUrl').value : '';
    d.articleText = el('articleText') ? el('articleText').value : '';
    FIELDS.forEach(function (k) {
      var ed = editors[k];
      if (!ed) return;
      d.fields[k] = { text: ed.value || '', fontSize: ed.style.fontSize || '16pt', lineHeight: ed.style.lineHeight || '1.5' };
    });
    document.querySelectorAll('[data-prompt]').forEach(function (box) {
      d.prompts[box.getAttribute('data-prompt')] = !!box.checked;
    });
    d.updated = nowIso();
  }
  function paintDraft(d) {
    if (el('draftName')) el('draftName').value = d.name || '';
    if (el('pieceTitle')) el('pieceTitle').value = d.pieceTitle || '';
    if (el('sourceUrl')) el('sourceUrl').value = d.sourceUrl || '';
    if (el('articleText')) el('articleText').value = d.articleText || '';
    FIELDS.forEach(function (k) {
      var f = normalizeField(d.fields && d.fields[k]);
      var ed = editors[k];
      if (!ed) return;
      ed.value = f.text || '';
      ed.style.fontSize = f.fontSize;
      ed.style.lineHeight = f.lineHeight;
      var wrap = ed.parentNode;
      var sizeSel = wrap.querySelector('[data-cmd="fontSize"]');
      var spSel = wrap.querySelector('[data-cmd="lineHeight"]');
      if (sizeSel) sizeSel.value = f.fontSize;
      if (spSel) spSel.value = f.lineHeight;
    });
    document.querySelectorAll('[data-prompt]').forEach(function (box) {
      var k = box.getAttribute('data-prompt');
      box.checked = !!(d.prompts && d.prompts[k]);
    });
  }
  function saveNow() {
    var d = current();
    if (!d) return;
    collectInto(d);
    if (writeStore()) setStatus('ok', 'Saved · ' + formatWhen(d.updated));
    else setStatus('err', 'Could not save on this device');
  }
  function scheduleSave() {
    setStatus('busy', 'Saving…');
    clearTimeout(saveDebounce);
    saveDebounce = setTimeout(saveNow, 400);
  }
  function buildEditor(wrap) {
    var field = wrap.getAttribute('data-field');
    var short = wrap.getAttribute('data-short') === '1';
    var tb = document.createElement('div');
    tb.className = 'toolbar';
    tb.innerHTML = '<label class="tb-field">Size<select data-cmd="fontSize">' +
      '<option value="14pt">14 pt</option><option value="16pt" selected>16 pt</option>' +
      '<option value="18pt">18 pt</option><option value="20pt">20 pt</option><option value="22pt">22 pt</option>' +
      '</select></label><label class="tb-field">Spacing<select data-cmd="lineHeight">' +
      '<option value="1.25">Tight</option><option value="1.5" selected>Normal</option>' +
      '<option value="1.75">Loose</option><option value="2">Double</option></select></label>';
    var ed = document.createElement('textarea');
    ed.className = 'editor' + (short ? ' short' : '');
    ed.setAttribute('spellcheck', 'true');
    ed.setAttribute('inputmode', 'text');
    ed.setAttribute('enterkeyhint', 'enter');
    ed.setAttribute('aria-label', field);
    ed.placeholder = PLACE[field] || '';
    ed.rows = short ? 4 : 8;
    wrap.appendChild(tb);
    wrap.appendChild(ed);
    editors[field] = ed;
    tb.addEventListener('change', function (e) {
      var sel = e.target.closest('select[data-cmd]');
      if (!sel) return;
      if (sel.getAttribute('data-cmd') === 'fontSize') ed.style.fontSize = sel.value;
      if (sel.getAttribute('data-cmd') === 'lineHeight') ed.style.lineHeight = sel.value;
      scheduleSave();
    });
    ed.addEventListener('focus', function () { lastEditor = ed; });
    ed.addEventListener('input', scheduleSave);
  }
  function downloadText(filename, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportMd() {
    var d = current();
    collectInto(d);
    var lines = ['# ' + (d.pieceTitle || d.name || 'Article marks'), '', 'Draft: ' + (d.name || ''), 'Source: ' + (d.sourceUrl || '—'), ''];
    lines.push('## Article', '', d.articleText || '', '');
    FIELDS.forEach(function (k) {
      lines.push('## ' + k, '', (d.fields[k] && d.fields[k].text) || '', '');
    });
    lines.push('_Prefer hypocrite / hypocrisy._', '', '_Save to OneDrive Portfolio/Practice/Drafts/_');
    downloadText('draft-' + (d.id || 'marks') + '.md', lines.join('\n'));
  }
  function boot() {
    document.querySelectorAll('.editor-wrap').forEach(buildEditor);
    ['draftName', 'pieceTitle', 'sourceUrl', 'articleText'].forEach(function (id) {
      var n = el(id);
      if (n) n.addEventListener('input', scheduleSave);
    });
    document.querySelectorAll('[data-prompt]').forEach(function (box) {
      box.addEventListener('change', scheduleSave);
    });
    var chip = el('hypocrisyChip');
    if (chip) chip.addEventListener('click', function () {
      var t = lastEditor;
      if (!t) { alert('Tap a marks field first.'); return; }
      var start = t.selectionStart || t.value.length;
      var end = t.selectionEnd || start;
      t.value = t.value.slice(0, start) + 'hypocrisy' + t.value.slice(end);
      t.focus();
      scheduleSave();
    });
    var stored = loadStore();
    if (stored && stored.drafts && stored.currentId && stored.drafts[stored.currentId]) state = stored;
    if (!state.currentId || !state.drafts[state.currentId]) {
      var d = newDraft();
      state.drafts = {}; state.drafts[d.id] = d; state.currentId = d.id; writeStore();
    }
    paintDraft(current());
    setStatus('ok', 'Saved · ' + formatWhen(current().updated));
    var expand = el('btnExpand');
    if (expand) expand.addEventListener('click', function () { document.querySelectorAll('details.lens').forEach(function (d) { d.open = true; }); });
    var collapse = el('btnCollapse');
    if (collapse) collapse.addEventListener('click', function () { document.querySelectorAll('details.lens').forEach(function (d) { d.open = false; }); });
    var btnNew = el('btnNew');
    if (btnNew) btnNew.addEventListener('click', function () {
      saveNow();
      var name = prompt('Name for the new draft:', 'Untitled draft');
      if (name === null) return;
      var d = newDraft((name || '').trim() || 'Untitled draft');
      state.drafts[d.id] = d; state.currentId = d.id; writeStore(); paintDraft(d);
      setStatus('ok', 'Saved · ' + formatWhen(d.updated));
    });
    var btnExport = el('btnExport');
    if (btnExport) btnExport.addEventListener('click', function () {
      saveNow();
      exportMd();
    });
    var btnDrafts = el('btnDrafts');
    if (btnDrafts) btnDrafts.addEventListener('click', function () {
      saveNow();
      var ids = Object.keys(state.drafts);
      var list = ids.map(function (id) { return (id === state.currentId ? '* ' : '- ') + (state.drafts[id].name || id); }).join('\n');
      var pick = prompt('Drafts on this device (type exact name to open):\n' + list, current().name || '');
      if (pick === null) return;
      var match = ids.find(function (id) { return (state.drafts[id].name || '') === pick; });
      if (!match) { alert('No draft with that exact name.'); return; }
      state.currentId = match; writeStore(); paintDraft(current());
      setStatus('ok', 'Saved · ' + formatWhen(current().updated));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();

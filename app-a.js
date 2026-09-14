(function () {
    var STORAGE_KEY = 'draftDesk.marks.v1';
    var FIELDS = ['fallacies', 'political', 'testable', 'conflict', 'sowhat'];
    var PROMPTS = ['claim', 'evidence', 'steelman', 'incentive', 'assumption', 'hypocrisy'];
    var PLACE = {
      fallacies: 'Blank. Name the move, then a line from the piece.',
      political: 'Blank. Who benefits, what is framed, what is left out.',
      testable: 'Blank. Claims you could check, and what would falsify them.',
      conflict: 'Blank. Where values, interests, or facts collide.',
      sowhat: 'One or two lines.'
    };
    var LABELS = {
      fallacies: 'Fallacies',
      political: 'Political Angle',
      testable: 'Testable',
      conflict: 'Conflict',
      sowhat: 'So what?'
    };

    var editors = {};
    var lastEditor = null;
    var saveDebounce = null;
    var state = { currentId: null, drafts: {} };
    var persistOk = true;

    function uid() {
      return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
    function nowIso() { return new Date().toISOString(); }
    function el(id) { return document.getElementById(id); }

    function formatWhen(iso) {
      if (!iso) return '';
      try {
        return new Date(iso).toLocaleString('en-AU', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: 'numeric', minute: '2-digit'
        });
      } catch (e) {
        return iso;
      }
    }

    function wordChar(text) {
      var t = String(text || '').replace(/\s+/g, ' ').trim();
      var chars = String(text || '').replace(/\s/g, '').length;
      var words = t ? t.split(' ').length : 0;
      return { words: words, chars: chars, label: words + ' words \u00b7 ' + chars + ' characters' };
    }

    function blankField() {
      return { html: '', fontSize: '16pt', lineHeight: '1.5' };
    }
    function blankPrompts() {
      var p = {};
      PROMPTS.forEach(function (k) { p[k] = false; });
      return p;
    }
    function newDraft(name) {
      var id = uid();
      var d = {
        id: id,
        name: name || 'Untitled draft',
        created: nowIso(),
        updated: nowIso(),
        pieceTitle: '',
        sourceUrl: '',
        articleText: '',
        fields: {},
        prompts: blankPrompts()
      };
      FIELDS.forEach(function (k) { d.fields[k] = blankField(); });
      return d;
    }

    function loadStore() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        persistOk = false;
        return null;
      }
    }
    function writeStore() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        persistOk = true;
        return true;
      } catch (e) {
        persistOk = false;
        return false;
      }
    }

    function current() {
      return state.drafts[state.currentId];
    }

    function setStatus(kind, text) {
      var n = el('saveStatus');
      n.className = 'save-status' + (kind ? ' ' + kind : '');
      n.textContent = text;
    }

    function sanitise(html) {
      var box = document.createElement('div');
      box.innerHTML = String(html || '');
      box.querySelectorAll('script,style,iframe,object,embed,link,meta,img,svg,video,audio').forEach(function (n) {
        n.remove();
      });
      box.querySelectorAll('*').forEach(function (n) {
        var attrs = Array.prototype.slice.call(n.attributes || []);
        attrs.forEach(function (a) {
          var name = a.name.toLowerCase();
          if (name.indexOf('on') === 0 || name === 'srcdoc') n.removeAttribute(a.name);
          if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
        });
      });
      return box.innerHTML;
    }

    function editorText(node) {
      return (node && node.innerText ? node.innerText : '').replace(/\u00a0/g, ' ');
    }

    function refreshPlaceholder(field) {
      var ed = editors[field];
      if (!ed) return;
      var empty = !editorText(ed).trim();
      ed.classList.toggle('placeholder', empty);
    }

    function refreshCounts() {
      var art = wordChar(el('articleText').value);
      el('articleCounts').textContent = art.label;
      FIELDS.forEach(function (k) {
        var wc = wordChar(editorText(editors[k]));
        var n = document.querySelector('[data-count-for="' + k + '"]');
        if (n) n.textContent = wc.words ? wc.words + ' w' : '';
        var c = editors[k] && editors[k].parentNode && editors[k].parentNode.querySelector('.counts');
        if (c) c.textContent = wc.label;
      });
    }

    function collectInto(draft) {
      if (!draft) return;
      draft.name = (el('draftName').value || '').trim() || 'Untitled draft';
      draft.pieceTitle = el('pieceTitle').value;
      draft.sourceUrl = el('sourceUrl').value;
      draft.articleText = el('articleText').value;
      FIELDS.forEach(function (k) {
        draft.fields[k] = {
          html: sanitise(editors[k].innerHTML),
          fontSize: editors[k].style.fontSize || '16pt',
          lineHeight: editors[k].style.lineHeight || '1.5'
        };
      });
      PROMPTS.forEach(function (k) {
        var box = document.querySelector('[data-prompt="' + k + '"]');
        draft.prompts[k] = !!(box && box.checked);
      });
      draft.updated = nowIso();
    }

    function paintDraft(draft) {
      el('draftName').value = draft.name || '';
      el('pieceTitle').value = draft.pieceTitle || '';
      el('sourceUrl').value = draft.sourceUrl || '';
      el('articleText').value = draft.articleText || '';
      FIELDS.forEach(function (k) {
        var f = (draft.fields && draft.fields[k]) || blankField();
        editors[k].innerHTML = sanitise(f.html);
        editors[k].style.fontSize = f.fontSize || '16pt';
        editors[k].style.lineHeight = f.lineHeight || '1.5';
        var wrap = editors[k].parentNode;
        var sizeSel = wrap.querySelector('[data-cmd="fontSize"]');
        var spSel = wrap.querySelector('[data-cmd="lineHeight"]');
        if (sizeSel) sizeSel.value = f.fontSize || '16pt';
        if (spSel) spSel.value = f.lineHeight || '1.5';
        refreshPlaceholder(k);
      });
      PROMPTS.forEach(function (k) {
        var box = document.querySelector('[data-prompt="' + k + '"]');
        if (box) box.checked = !!(draft.prompts && draft.prompts[k]);
      });
      refreshCounts();
    }

    function saveNow(quiet) {
      var d = current();
      if (!d) return;
      collectInto(d);
      var ok = writeStore();
      if (!ok) {
        setStatus('err', 'Could not save on this device');
        return;
      }
      if (!quiet) setStatus('ok', 'Saved \u00b7 ' + formatWhen(d.updated));
    }

    function scheduleSave() {
      setStatus('busy', 'Saving\u2026');
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(function () { saveNow(); }, 550);
    }

    function applyCmd(editor, cmd, val) {
      editor.focus();
      lastEditor = editor;
      try { document.execCommand('styleWithCSS', false, true); } catch (e1) {}
      if (cmd === 'fontSize') {
        editor.style.fontSize = val;
        return;
      }
      if (cmd === 'lineHeight') {
        editor.style.lineHeight = val;
        return;
      }
      if (cmd === 'createLink') {
        var url = window.prompt('Link address (include https://):', 'https://');
        if (!url) return;
        document.execCommand('createLink', false, url);
        return;
      }
      if (cmd === 'removeFormat') {
        document.execCommand('removeFormat', false, null);
        document.execCommand('unlink', false, null);
        editor.style.fontSize = '16pt';
        editor.style.lineHeight = '1.5';
        var wrap = editor.parentNode;
        var sizeSel = wrap.querySelector('[data-cmd="fontSize"]');
        var spSel = wrap.querySelector('[data-cmd="lineHeight"]');
        if (sizeSel) sizeSel.value = '16pt';
        if (spSel) spSel.value = '1.5';
        return;
      }
      document.execCommand(cmd, false, val || null);
    }

    function buildEditor(wrap) {
      var field = wrap.getAttribute('data-field');
      var short = wrap.getAttribute('data-short') === '1';
      var tb = document.createElement('div');
      tb.className = 'toolbar';
      tb.setAttribute('role', 'toolbar');
      tb.innerHTML =
        '<label class="tb-field">Size<select data-cmd="fontSize">' +
          '<option value="14pt">14 pt</option>' +
          '<option value="16pt" selected>16 pt</option>' +
          '<option value="18pt">18 pt</option>' +
          '<option value="20pt">20 pt</option>' +
          '<option value="22pt">22 pt</option>' +
        '</select></label>' +
        '<label class="tb-field">Spacing<select data-cmd="lineHeight">' +
          '<option value="1.25">Tight</option>' +
          '<option value="1.5" selected>Normal</option>' +
          '<option value="1.75">Loose</option>' +
          '<option value="2">Double</option>' +
        '</select></label>' +
        '<button type="button" data-cmd="bold" title="Bold"><b>B</b></button>' +
        '<button type="button" data-cmd="italic" title="Italic"><i>I</i></button>' +
        '<button type="button" data-cmd="insertUnorderedList" title="Bullet list">\u2022 List</button>' +
        '<button type="button" data-cmd="insertOrderedList" title="Numbered list">1. List</button>' +
        '<button type="button" data-cmd="createLink" title="Hyperlink">Link</button>' +
        '<button type="button" data-cmd="removeFormat" title="Clear formatting">Clear</button>';
      var ed = document.createElement('div');
      ed.className = 'editor' + (short ? ' short' : '');
      ed.setAttribute('contenteditable', 'true');
      ed.setAttribute('role', 'textbox');
      ed.setAttribute('aria-multiline', 'true');
      ed.setAttribute('aria-label', LABELS[field]);
      ed.setAttribute('spellcheck', 'true');
      ed.setAttribute('data-placeholder', PLACE[field]);
      ed.classList.add('placeholder');
      var counts = document.createElement('div');
      counts.className = 'counts';
      counts.textContent = '0 words \u00b7 0 characters';
      wrap.appendChild(tb);
      wrap.appendChild(ed);
      wrap.appendChild(counts);
      editors[field] = ed;

      tb.addEventListener('mousedown', function (e) {
        if (e.target.closest('button, select')) e.preventDefault();
      });
      tb.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-cmd]');
        if (!btn) return;
        applyCmd(ed, btn.getAttribute('data-cmd'));
        refreshPlaceholder(field);
        refreshCounts();
        scheduleSave();
      });
      tb.addEventListener('change', function (e) {
        var sel = e.target.closest('select[data-cmd]');
        if (!sel) return;
        applyCmd(ed, sel.getAttribute('data-cmd'), sel.value);
        scheduleSave();
      });
      ed.addEventListener('focus', function () { lastEditor = ed; });
      ed.addEventListener('input', function () {
        refreshPlaceholder(field);
        refreshCounts();
        scheduleSave();
      });
      ed.addEventListener('paste', function (e) {
        if (!e.clipboardData) return;
        var html = e.clipboardData.getData('text/html');
        var text = e.clipboardData.getData('text/plain');
        e.preventDefault();
        if (html) {
          document.execCommand('insertHTML', false, sanitise(html));
        } else {
          document.execCommand('insertText', false, text);
        }
      });
    }

    function htmlToMarkdown(html) {
      var box = document.createElement('div');
      box.innerHTML = sanitise(html);
      function walk(node) {
        if (node.nodeType === 3) return node.nodeValue;
        if (node.nodeType !== 1) return '';
        var tag = node.tagName.toLowerCase();
        var inner = Array.prototype.map.call(node.childNodes, walk).join('');
        if (tag === 'br') return '\n';
        if (tag === 'strong' || tag === 'b') return '**' + inner + '**';
        if (tag === 'em' || tag === 'i') return '*' + inner + '*';
        if (tag === 'a') {
          var href = node.getAttribute('href') || '';
          return '[' + inner + '](' + href + ')';
        }
        if (tag === 'li') {
          var parent = node.parentNode && node.parentNode.tagName;
          var prefix = parent === 'OL' ? '1. ' : '- ';
          return prefix + inner.trim() + '\n';
        }
        if (tag === 'p' || tag === 'div' || tag === 'h1' || tag === 'h2' || tag === 'h3') {
          return inner.trim() + '\n\n';
        }
        if (tag === 'ul' || tag === 'ol') return '\n' + inner + '\n';
        return inner;
      }
      return walk(box).replace(/\n{3,}/g, '\n\n').trim();
    }

    function slugPart(s) {
      var t = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return t.slice(0, 40) || 'draft';
    }

    function dateStamp() {
      var d = new Date();
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }

    function exportBaseName() {
      var d = current();
      var n = slugPart(d.pieceTitle || d.name);
      return 'draft-' + n + '-' + dateStamp();
    }

    function downloadFile(filename, mime, content) {
      var blob = new Blob([content], { type: mime });

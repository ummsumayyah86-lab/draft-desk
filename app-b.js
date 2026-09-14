      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 800);
    }

    function escapeHtml(s) {
      return String(s || '').replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    }

    function buildExportHtml() {
      var d = current();
      collectInto(d);
      var ticks = PROMPTS.map(function (k) {
        var label = document.querySelector('[data-prompt="' + k + '"]');
        var text = label && label.parentNode ? label.parentNode.textContent.trim() : k;
        return '<li>' + (d.prompts[k] ? '☑ ' : '☐ ') + escapeHtml(text) + '</li>';
      }).join('');
      var blocks = FIELDS.map(function (k) {
        return '<h2>' + escapeHtml(LABELS[k]) + '</h2>\n<div class="block">' + sanitise(d.fields[k].html) + '</div>';
      }).join('\n');
      return '<!DOCTYPE html>\n<html lang="en-AU"><head><meta charset="utf-8" />' +
        '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
        '<title>' + escapeHtml(d.pieceTitle || d.name || 'Article marks') + '</title>' +
        '<style>body{font-family:Georgia,"Times New Roman",serif;font-size:15pt;line-height:1.45;color:#1e1c18;max-width:46rem;margin:0 auto;padding:1.2rem;background:#fbf8f2;}h1{font-size:1.3rem;}h2{font-size:1.08rem;margin:1.2rem 0 .4rem;} .meta{color:#5c564c;font-size:.95rem;} .article{white-space:pre-wrap;border:1px solid #d5ccbe;padding:.8rem;border-radius:10px;background:#fff;} .block{min-height:2rem;border:1px solid #d5ccbe;padding:.7rem;border-radius:10px;background:#fff;} ul{padding-left:1.2rem;}</style></head><body>' +
        '<h1>Draft Desk — article marks</h1>' +
        '<p class="meta">' + escapeHtml(d.name) + '<br>Saved ' + escapeHtml(formatWhen(d.updated)) + '</p>' +
        '<p><strong>Piece:</strong> ' + escapeHtml(d.pieceTitle || '—') + '<br>' +
        '<strong>Source URL (note):</strong> ' + escapeHtml(d.sourceUrl || '—') + '</p>' +
        '<h2>Article</h2><div class="article">' + escapeHtml(d.articleText || '') + '</div>' +
        blocks +
        '<h2>Conflict / Testable prompts</h2><ul>' + ticks + '</ul>' +
        '<p class="meta">Stays on this device unless exported. Prefer hypocrite / hypocrisy (not “double standard”).</p>' +
        '</body></html>';
    }

    function buildExportMd() {
      var d = current();
      collectInto(d);
      var lines = [
        '---',
        'tool: draft-desk',
        'format: article-marks',
        'draft_id: ' + (d.id || ''),
        'draft_name: ' + JSON.stringify(d.name || ''),
        'piece_title: ' + JSON.stringify(d.pieceTitle || ''),
        'source_url: ' + JSON.stringify(d.sourceUrl || ''),
        'updated: ' + (d.updated || ''),
        'exported: ' + nowIso(),
        'export_date: ' + dateStamp(),
        'oneDrive_folder: Portfolio/Practice/Drafts/',
        'prefer: hypocrite / hypocrisy (not double standard)',
        '---',
        '',
        '# ' + (d.pieceTitle || d.name || 'Article marks'),
        '',
        'Draft: ' + (d.name || ''),
        'Source URL (note): ' + (d.sourceUrl || '—'),
        'Saved: ' + formatWhen(d.updated),
        '',
        '## Article',
        '',
        d.articleText || '',
        ''
      ];
      FIELDS.forEach(function (k) {
        lines.push('## ' + LABELS[k], '', htmlToMarkdown(d.fields[k].html) || '', '');
      });
      lines.push('## Conflict / Testable prompts', '');
      PROMPTS.forEach(function (k) {
        var label = document.querySelector('[data-prompt="' + k + '"]');
        var text = label && label.parentNode ? label.parentNode.textContent.trim() : k;
        lines.push('- [' + (d.prompts[k] ? 'x' : ' ') + '] ' + text);
      });
      lines.push('', '_Prefer hypocrite / hypocrisy (not “double standard”)._');
      lines.push('', '_Save this file to OneDrive Portfolio/Practice/Drafts/ for Chief of Staff._');
      return lines.join('\n');
    }

    function buildExportJson() {
      var d = current();
      collectInto(d);
      var payload = {
        tool: 'draft-desk',
        format: 'article-marks',
        oneDrive_folder: 'Portfolio/Practice/Drafts/',
        prefer: 'hypocrite / hypocrisy (not double standard)',
        exported: nowIso(),
        export_date: dateStamp(),
        draft: {
          id: d.id,
          name: d.name,
          created: d.created,
          updated: d.updated,
          pieceTitle: d.pieceTitle,
          sourceUrl: d.sourceUrl,
          articleText: d.articleText,
          fields: {},
          prompts: d.prompts || blankPrompts()
        }
      };
      FIELDS.forEach(function (k) {
        var f = d.fields[k] || blankField();
        payload.draft.fields[k] = {
          html: f.html || '',
          markdown: htmlToMarkdown(f.html || ''),
          text: (function () {
            var box = document.createElement('div');
            box.innerHTML = sanitise(f.html || '');
            return (box.innerText || '').replace(/\u00a0/g, ' ').trim();
          })(),
          fontSize: f.fontSize || '16pt',
          lineHeight: f.lineHeight || '1.5'
        };
      });
      return JSON.stringify(payload, null, 2);
    }

    function renderDraftsList() {
      var box = el('draftsList');
      var ids = Object.keys(state.drafts).sort(function (a, b) {
        return (state.drafts[b].updated || '').localeCompare(state.drafts[a].updated || '');
      });
      if (!ids.length) {
        box.innerHTML = '<p class="hint">No drafts yet.</p>';
        return;
      }
      box.innerHTML = '';
      ids.forEach(function (id) {
        var d = state.drafts[id];
        var row = document.createElement('div');
        row.className = 'draft-row' + (id === state.currentId ? ' current' : '');
        var main = document.createElement('button');
        main.type = 'button';
        main.className = 'draft-main';
        main.innerHTML = escapeHtml(d.name || 'Untitled draft') +
          '<small>' + escapeHtml(formatWhen(d.updated)) +
          (id === state.currentId ? ' · open now' : '') + '</small>';
        main.addEventListener('click', function () {
          switchDraft(id);
          el('draftsDialog').close();
        });
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'danger';
        del.textContent = 'Delete';
        del.addEventListener('click', function () {
          deleteDraft(id);
        });
        row.appendChild(main);
        row.appendChild(del);
        box.appendChild(row);
      });
    }

    function switchDraft(id) {
      if (!state.drafts[id]) return;
      saveNow(true);
      state.currentId = id;
      writeStore();
      paintDraft(state.drafts[id]);
      setStatus('ok', 'Saved · ' + formatWhen(state.drafts[id].updated));
    }

    function deleteDraft(id) {
      if (!state.drafts[id]) return;
      if (!window.confirm('Delete this draft from this device? This cannot be undone.')) return;
      delete state.drafts[id];
      if (state.currentId === id) {
        var rest = Object.keys(state.drafts);
        if (!rest.length) {
          var fresh = newDraft();
          state.drafts[fresh.id] = fresh;
          state.currentId = fresh.id;
        } else {
          rest.sort(function (a, b) {
            return (state.drafts[b].updated || '').localeCompare(state.drafts[a].updated || '');
          });
          state.currentId = rest[0];
        }
        paintDraft(current());
      }
      writeStore();
      renderDraftsList();
      setStatus('ok', 'Saved · ' + formatWhen(current().updated));
    }

    function startNewDraft() {
      saveNow(true);
      var name = window.prompt('Name for the new draft:', 'Untitled draft');
      if (name === null) return;
      var d = newDraft((name || '').trim() || 'Untitled draft');
      state.drafts[d.id] = d;
      state.currentId = d.id;
      writeStore();
      paintDraft(d);
      setStatus('ok', 'Saved · ' + formatWhen(d.updated));
    }

    function createNamedFromDialog() {
      var name = window.prompt('Name for the new draft:', 'Untitled draft');
      if (name === null) return;
      saveNow(true);
      var d = newDraft((name || '').trim() || 'Untitled draft');
      state.drafts[d.id] = d;
      state.currentId = d.id;
      writeStore();
      paintDraft(d);
      renderDraftsList();
      setStatus('ok', 'Saved · ' + formatWhen(d.updated));
    }

    function insertHypocrisy() {
      var target = lastEditor;
      if (!target) {
        window.alert('Tap a marks field first, then tap this chip to insert “hypocrisy”.');
        return;
      }
      target.focus();
      document.execCommand('insertText', false, 'hypocrisy');
      var field = null;
      FIELDS.forEach(function (k) { if (editors[k] === target) field = k; });
      if (field) refreshPlaceholder(field);
      refreshCounts();
      scheduleSave();
    }

    function loadArticleFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '');
        var isHtml = /\.html?$/i.test(file.name) || /<html[\s>]/i.test(text) || /<body[\s>]/i.test(text);
        if (isHtml) {
          var box = document.createElement('div');
          box.innerHTML = text;
          box.querySelectorAll('script,style,noscript,iframe').forEach(function (n) { n.remove(); });
          text = (box.innerText || box.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
        }
        el('articleText').value = text;
        el('fileNote').textContent = 'Loaded ' + file.name;
        refreshCounts();
        scheduleSave();
      };
      reader.readAsText(file);
    }

    function bootEditors() {
      document.querySelectorAll('.editor-wrap').forEach(buildEditor);
    }

    function bind() {
      ['draftName', 'pieceTitle', 'sourceUrl', 'articleText'].forEach(function (id) {
        el(id).addEventListener('input', function () {
          if (id === 'articleText') refreshCounts();
          scheduleSave();
        });
      });
      document.querySelectorAll('[data-prompt]').forEach(function (box) {
        box.addEventListener('change', scheduleSave);
      });
      el('articleFile').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        loadArticleFile(f);
        e.target.value = '';
      });
      el('btnDrafts').addEventListener('click', function () {
        saveNow(true);
        renderDraftsList();
        el('draftsDialog').showModal();
      });
      el('btnCloseDrafts').addEventListener('click', function () { el('draftsDialog').close(); });
      el('btnCreateNamed').addEventListener('click', createNamedFromDialog);
      el('btnNew').addEventListener('click', startNewDraft);
      el('btnExport').addEventListener('click', function () {
        saveNow(true);
        el('exportDialog').showModal();
      });
      el('btnCloseExport').addEventListener('click', function () { el('exportDialog').close(); });
      el('btnDlHtml').addEventListener('click', function () {
        downloadFile(exportBaseName() + '.html', 'text/html;charset=utf-8', buildExportHtml());
      });
      el('btnDlMd').addEventListener('click', function () {
        downloadFile(exportBaseName() + '.md', 'text/markdown;charset=utf-8', buildExportMd());
      });
      el('btnDlJson').addEventListener('click', function () {
        downloadFile(exportBaseName() + '.json', 'application/json;charset=utf-8', buildExportJson());
      });
      el('btnExpand').addEventListener('click', function () {
        document.querySelectorAll('details.lens').forEach(function (d) { d.open = true; });
      });
      el('btnCollapse').addEventListener('click', function () {
        document.querySelectorAll('details.lens').forEach(function (d) { d.open = false; });
      });
      el('hypocrisyChip').addEventListener('click', insertHypocrisy);
      window.addEventListener('pagehide', function () { saveNow(true); });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') saveNow(true);
      });
    }

    function boot() {
      bootEditors();
      bind();
      var stored = loadStore();
      if (stored && stored.drafts && stored.currentId && stored.drafts[stored.currentId]) {
        state = stored;
        if (!state.drafts[state.currentId]) {
          var ids = Object.keys(state.drafts);
          state.currentId = ids[0] || null;
        }
      }
      if (!state.currentId || !state.drafts[state.currentId]) {
        var d = newDraft();
        state.drafts = {};
        state.drafts[d.id] = d;
        state.currentId = d.id;
        writeStore();
      }
      paintDraft(current());
      if (!persistOk) setStatus('err', 'Storage blocked — export to keep a copy');
      else if (current().updated) setStatus('ok', 'Saved · ' + formatWhen(current().updated));
      else setStatus('', 'Not saved yet');
    }

    boot();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function () {});
      });
    }
  

/* Présentations de Tableaux personnalisés DigDash (Self Service BI)
   LD_VIEW_CAPTURE : lit la mise en forme du tableau affiché (à coller dans la console du tableau de bord)
   LD_VIEW_APPLY   : réapplique une mise en forme enregistrée (script console ou favori)
   Les deux s'appuient sur l'éditeur interne de DigDash (AxisEditor.getCurrentViewJSON / applyViewJSON). */

var LD_VIEW_CAPTURE = function (opt) {
  opt = opt || {};
  (async function () {
    var D = document, W = window, cap = { ed: null, dh: null };
    /* message : console (admin) ou panneau à l'écran (favori utilisateur) */
    function panel(html) {
      var b = D.getElementById('ldVuePanel') || D.createElement('div');
      b.id = 'ldVuePanel';
      b.style.cssText = 'position:fixed;z-index:999999;right:16px;bottom:16px;width:380px;max-width:calc(100vw - 32px);background:#fff;color:#0D1440;border:1px solid #E5E7EB;border-top:4px solid #293378;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.25);font:13px Arial,sans-serif;padding:14px 16px;line-height:1.45';
      b.innerHTML = html + '<button type="button" data-ld="close" style="position:absolute;top:6px;right:8px;border:0;background:none;font-size:18px;cursor:pointer;color:#6B7280" title="Fermer">&times;</button>';
      D.body.appendChild(b);
      b.querySelector('[data-ld="close"]').onclick = function () { b.remove(); };
      return b;
    }
    function fail(msg) { if (opt.ui) panel('<b>Capture impossible</b><p style="margin:6px 0 0">' + msg + '</p>'); else console.log(msg); }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function vis(e) { return !!(e && (e.offsetWidth || e.offsetHeight)); }
    var tb = Array.prototype.filter.call(D.querySelectorAll('.editToolbar'), vis)[0];
    if (!tb) { fail('Aucun Tableau personnalisé visible : ouvrez une page Tableau personnalisé et mettez le tableau en forme.'); return; }
    var fid = tb.id.replace(/_editToolbar$/, ''), frame = D.getElementById(fid), src = tb.querySelector('.editTool.drag');
    var page = tb.closest('.dashboard_page[role="main"]');
    var saved = [];
    function wrap(C, key) {
      if (!C) return;
      Object.getOwnPropertyNames(C.prototype).forEach(function (m) {
        var f = C.prototype[m];
        if (typeof f !== 'function' || m === 'constructor') return;
        saved.push([C.prototype, m, f]);
        C.prototype[m] = function () { if (!cap[key]) cap[key] = this; return f.apply(this, arguments); };
      });
    }
    /* filtres du tableau de bord (lien, panneau) : notés avant, remis après, car l'application d'une vue les réinitialise */
    function fdims() { var r = []; Array.prototype.forEach.call(D.querySelectorAll('span[id^="dimName"][id$="false"]'), function (e) { var k = e.id.replace(/^dimName/, '').replace(/false$/, ''); if (r.indexOf(k) < 0) r.push(k); }); return r; }
    function factive(f) { return f && !(Array.isArray(f) && (!f.length || (f.length === 1 && f[0] === 'All'))); }
    function fsnap() { var r = []; fdims().forEach(function (d) { try { if (factive(W.ddCtrl.getDimensionFilter(d))) { var o = W.ddCtrl.getFilterOperandByDim(d); if (o) r.push(o); } } catch (e) { /* ignore */ } }); return r; }
    function fplain(o) { return { dimId: o.dimId, member: o.member, h: o.h, l: o.l, memberFormated: o.memberFormated, bExcludeFilter: !!o.bExcludeFilter }; }
    function fsig(list) { return list.map(function (o) { return o.dimId + '=' + JSON.stringify(o.member); }).sort().join('|'); }
    function fop(p) {
      var FO = W.FilterOperand || (W.ddCtrl && W.ddCtrl.FilterOperand);
      return FO ? new FO(p.dimId, p.member, p.h, p.l, p.memberFormated, false, p.bExcludeFilter) : null;
    }
    async function frestore(list) {
      if (!list.length) return true;
      try { W.ddCtrl.beginSelection(); list.forEach(function (o) { W.ddCtrl.filter(o); }); W.ddCtrl.commitSelection(); } catch (e) { /* repli ci-dessous */ }
      await sleep(1500);
      var now = fsig(fsnap().map(fplain)), want = fsig(list.map(fplain));
      if (now === want) return true;
      /* repli : une valeur après l'autre */
      try {
        W.ddCtrl.beginSelection();
        list.forEach(function (o) {
          var p = fplain(o), m = [].concat(p.member), FO = W.FilterOperand || (W.ddCtrl && W.ddCtrl.FilterOperand);
          m.forEach(function (v, i) { W.ddCtrl.filter(new FO(p.dimId, v, p.h, p.l, [].concat(p.memberFormated)[i], i > 0, p.bExcludeFilter)); });
        });
        W.ddCtrl.commitSelection();
      } catch (e) { return false; }
      await sleep(1500);
      return fsig(fsnap().map(fplain)) === want;
    }
    /* filtres propres au tableau (popup "Filtres..." de la barre Self Service) : ed.chart.dmsel.dimsToFilter */
    function tfList(ed) { try { return (ed.chart.dmsel.dimsToFilter || []).slice(); } catch (e) { return []; } }
    function tfJSON(ed) { return tfList(ed).map(function (f) { try { return JSON.parse(JSON.stringify(f)); } catch (e) { return null; } }).filter(Boolean); }
    function tfText(ed) { return tfList(ed).map(function (f) { var n = f.dim && f.dim.name ? f.dim.name : ''; var t = ''; try { t = f.getFilterString(); } catch (e) { /* ignore */ } return (n ? n + ' : ' : '') + t; }); }
    var before = fsnap();
    wrap(W.AxisEditor, 'ed'); wrap(W.DragEditHandler, 'dh');
    try {
      var cell = frame.querySelector('td.tdvHeader') || frame.querySelector('td.tdValueMeasure') || frame.querySelector('thead td');
      if (cell) { var r = cell.getBoundingClientRect(); cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2 })); }
      await sleep(400);
      if (!cap.ed && src) { var dt = new DataTransfer(); src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt })); await sleep(300); src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt })); }
    } finally {
      saved.forEach(function (x) { x[0][x[1]] = x[2]; });
      D.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      D.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    function findEd(o, d, seen) {
      if (!o || typeof o !== 'object' || d > 3 || seen.indexOf(o) >= 0) return null;
      seen.push(o);
      if (o instanceof W.AxisEditor) return o;
      var ks = Object.keys(o);
      for (var i = 0; i < ks.length && i < 300; i++) { try { var x = findEd(o[ks[i]], d + 1, seen); if (x) return x; } catch (e) { /* ignore */ } }
      return null;
    }
    var ed = cap.ed || (cap.dh ? findEd(cap.dh, 0, []) : null);
    if (fsig(fsnap().map(fplain)) !== fsig(before.map(fplain))) await frestore(before);
    if (!ed) { fail('Éditeur du tableau introuvable : la version de DigDash a peut-être changé.'); return; }
    var v = ed.getCurrentViewJSON();
    var vue = typeof v === 'string' ? JSON.parse(v) : v;
    function titles(sel) { return Array.prototype.map.call(tb.querySelectorAll(sel), function (x) { return x.getAttribute('title'); }); }
    var out = {
      source: 'digdash-vue',
      capturedAt: new Date().toISOString(),
      pageId: page ? page.id : '',
      pageUid: page ? page.getAttribute('uid') : '',
      portlet: fid.replace(/^frame_/, ''),
      dimensions: titles('.editToolIconDim:not(.editToolIconDimDisabled)'),
      mesures: titles('.editToolIconMeasure:not(.editToolIconMeasureDisabled)'),
      filtres: before.map(fplain),
      tfiltres: tfJSON(ed),
      tfiltresTexte: tfText(ed),
      tdates: tfList(ed).filter(function (f) { return f.dim && (f.dim.time || /^D_/.test(f.dim.id)); }).map(function (f) { var t = ''; try { t = f.getFilterString(); } catch (e) { /* ignore */ } return { dim: f.dim.id, nom: f.dim.name, texte: t }; }),
      vue: vue
    };
    var s = JSON.stringify(out);
    var resume = out.dimensions.join(' x ') + (out.mesures.length ? ' | ' + out.mesures.join(', ') : '') + (out.tfiltresTexte.length ? ' | Filtres : ' + out.tfiltresTexte.join(', ') : '');
    if (!opt.ui) {
      console.log('Présentation capturée : ' + resume + ' (' + s.length + ' caractères)');
      try { copy(s); console.log('Résultat copié dans le presse-papier : collez-le dans l\'admin, onglet Présentations'); } catch (e) { console.log(s); }
      return;
    }
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    var btn = 'font:inherit;font-weight:bold;border-radius:4px;padding:7px 12px;cursor:pointer;';
    var b = panel('<b style="font-size:14px">Présentation capturée</b>' +
      '<p style="margin:6px 0;color:#374151">' + esc(resume) + '</p>' +
      '<label style="display:block;font-size:12px;color:#374151;margin-top:8px">Nom du favori</label>' +
      '<input data-ld="name" type="text" value="' + esc(out.dimensions.join(' x ').slice(0, 60)) + '" style="width:100%;box-sizing:border-box;font:inherit;padding:7px 8px;border:1px solid #D1D5DB;border-radius:4px;margin:4px 0 10px">' +
      out.tdates.map(function (d, i) {
        return '<label style="display:block;font-size:12px;color:#374151">Période : ' + esc(d.nom) + '</label>' +
          '<select data-ld="per" data-dim="' + esc(d.dim) + '" style="width:100%;box-sizing:border-box;font:inherit;padding:6px 8px;border:1px solid #D1D5DB;border-radius:4px;margin:4px 0 10px">' +
          [['fixe', 'Mois fixe : ' + d.texte], ['dernier', 'Dernier mois disponible'], ['dernierN1', 'Même mois, année précédente'], ['12m', '12 derniers mois (cumul)'], ['12mN1', '12 mois précédents (13e au 24e mois, cumul)']]
            .map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>';
      }).join('') +
      '<button type="button" data-ld="make" style="' + btn + 'background:#293378;color:#fff;border:1px solid #293378">Créer le favori</button> ' +
      '<button type="button" data-ld="share" style="' + btn + 'background:#fff;color:#293378;border:1px solid #293378">Copier le code de partage</button>' +
      '<div data-ld="out" style="margin-top:10px"></div>');
    var zone = b.querySelector('[data-ld="out"]');
    b.querySelector('[data-ld="make"]').onclick = function () {
      var name = b.querySelector('[data-ld="name"]').value.trim() || 'Ma présentation';
      var periodes = Array.prototype.map.call(b.querySelectorAll('[data-ld="per"]'), function (sel) { return { dim: sel.getAttribute('data-dim'), mode: sel.value }; }).filter(function (x) { return x.mode !== 'fixe'; });
      var V = { name: name, pageId: out.pageId, pageUid: out.pageUid, tfiltres: out.tfiltres, periodes: periodes, vue: out.vue };
      var href = 'javascript:' + encodeURIComponent('(' + opt.applySrc + ')(' + JSON.stringify(V) + ');');
      zone.innerHTML = '<p style="margin:0 0 6px">Faites glisser ce bouton dans votre <b>barre de favoris</b> :</p>' +
        '<a href="' + esc(href) + '" draggable="true" style="display:inline-block;background:#FFCC52;color:#0D1440;font-weight:bold;text-decoration:none;padding:7px 12px;border-radius:4px">' + esc(name) + '</a>' +
        '<p style="margin:8px 0 0;color:#6B7280;font-size:12px">Un clic sur ce favori, depuis n\'importe quelle page du tableau de bord, remettra le tableau dans cette présentation. Barre de favoris masquée : Ctrl+Maj+B.</p>';
      zone.querySelector('a').onclick = function (e) { e.preventDefault(); };
    };
    b.querySelector('[data-ld="share"]').onclick = function () {
      function done(ok) { zone.innerHTML = '<p style="margin:0;color:' + (ok ? '#1B7F3B' : '#D92424') + '">' + (ok ? 'Code copié : envoyez-le à l\'administrateur de la page des liens pour qu\'il le publie.' : 'Copie impossible.') + '</p>'; }
      if (navigator.clipboard && W.isSecureContext) navigator.clipboard.writeText(s).then(function () { done(true); }, function () { done(false); });
      else { var ta = D.createElement('textarea'); ta.value = s; D.body.appendChild(ta); ta.select(); var ok = false; try { ok = D.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); done(ok); }
    };
  })();
};

var LD_VIEW_APPLY = function (V) {
  (async function () {
    var D = document, W = window, cap = { ed: null, dh: null };
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function vis(e) { return !!(e && (e.offsetWidth || e.offsetHeight)); }
    function toast(msg, ok) {
      var t = D.getElementById('ldVueToast') || D.createElement('div');
      t.id = 'ldVueToast';
      t.style.cssText = 'position:fixed;z-index:999999;right:16px;bottom:16px;max-width:360px;padding:12px 16px;border-radius:8px;font:13px Arial,sans-serif;color:#fff;box-shadow:0 4px 10px rgba(0,0,0,.3);background:' + (ok === false ? '#D92424' : '#0D1440');
      t.textContent = msg;
      D.body.appendChild(t);
      if (ok !== undefined) setTimeout(function () { t.remove(); }, 4000);
    }
    if (!W.ddCtrl || !W.AxisEditor) { toast('Ouvrez d\'abord le tableau de bord RPE, puis relancez la présentation.', false); return; }
    function toolbar() {
      return Array.prototype.filter.call(D.querySelectorAll('.editToolbar'), function (tb) {
        if (!vis(tb)) return false;
        var pg = tb.closest('.dashboard_page[role="main"]');
        return !V.pageId || (pg && pg.id === V.pageId);
      })[0];
    }
    var tb = toolbar();
    if (!tb && V.pageUid) {
      toast('Ouverture de la page...');
      try { W.ddCtrl.changePage(V.pageUid); } catch (e) { /* ignore */ }
      var t0 = Date.now();
      while (!tb && Date.now() - t0 < 30000) { await sleep(400); tb = toolbar(); }
    }
    if (!tb) { toast('Tableau personnalisé introuvable sur cette page.', false); return; }
    toast('Application de la présentation "' + V.name + '"...');
    var fid = tb.id.replace(/_editToolbar$/, ''), frame = D.getElementById(fid), src = tb.querySelector('.editTool.drag');
    var t1 = Date.now();
    while (!frame.querySelector('table.table') && Date.now() - t1 < 20000) await sleep(300);
    var saved = [];
    function wrap(C, key) {
      if (!C) return;
      Object.getOwnPropertyNames(C.prototype).forEach(function (m) {
        var f = C.prototype[m];
        if (typeof f !== 'function' || m === 'constructor') return;
        saved.push([C.prototype, m, f]);
        C.prototype[m] = function () { if (!cap[key]) cap[key] = this; return f.apply(this, arguments); };
      });
    }
    /* filtres du tableau de bord (lien, panneau) : notés avant, remis après, car l'application d'une vue les réinitialise */
    function fdims() { var r = []; Array.prototype.forEach.call(D.querySelectorAll('span[id^="dimName"][id$="false"]'), function (e) { var k = e.id.replace(/^dimName/, '').replace(/false$/, ''); if (r.indexOf(k) < 0) r.push(k); }); return r; }
    function factive(f) { return f && !(Array.isArray(f) && (!f.length || (f.length === 1 && f[0] === 'All'))); }
    function fsnap() { var r = []; fdims().forEach(function (d) { try { if (factive(W.ddCtrl.getDimensionFilter(d))) { var o = W.ddCtrl.getFilterOperandByDim(d); if (o) r.push(o); } } catch (e) { /* ignore */ } }); return r; }
    function fplain(o) { return { dimId: o.dimId, member: o.member, h: o.h, l: o.l, memberFormated: o.memberFormated, bExcludeFilter: !!o.bExcludeFilter }; }
    function fsig(list) { return list.map(function (o) { return o.dimId + '=' + JSON.stringify(o.member); }).sort().join('|'); }
    function fop(p) {
      var FO = W.FilterOperand || (W.ddCtrl && W.ddCtrl.FilterOperand);
      return FO ? new FO(p.dimId, p.member, p.h, p.l, p.memberFormated, false, p.bExcludeFilter) : null;
    }
    async function frestore(list) {
      if (!list.length) return true;
      try { W.ddCtrl.beginSelection(); list.forEach(function (o) { W.ddCtrl.filter(o); }); W.ddCtrl.commitSelection(); } catch (e) { /* repli ci-dessous */ }
      await sleep(1500);
      var now = fsig(fsnap().map(fplain)), want = fsig(list.map(fplain));
      if (now === want) return true;
      /* repli : une valeur après l'autre */
      try {
        W.ddCtrl.beginSelection();
        list.forEach(function (o) {
          var p = fplain(o), m = [].concat(p.member), FO = W.FilterOperand || (W.ddCtrl && W.ddCtrl.FilterOperand);
          m.forEach(function (v, i) { W.ddCtrl.filter(new FO(p.dimId, v, p.h, p.l, [].concat(p.memberFormated)[i], i > 0, p.bExcludeFilter)); });
        });
        W.ddCtrl.commitSelection();
      } catch (e) { return false; }
      await sleep(1500);
      return fsig(fsnap().map(fplain)) === want;
    }
    /* filtres propres au tableau (popup "Filtres..." de la barre Self Service) : ed.chart.dmsel.dimsToFilter */
    function tfList(ed) { try { return (ed.chart.dmsel.dimsToFilter || []).slice(); } catch (e) { return []; } }
    function tfJSON(ed) { return tfList(ed).map(function (f) { try { return JSON.parse(JSON.stringify(f)); } catch (e) { return null; } }).filter(Boolean); }
    function tfText(ed) { return tfList(ed).map(function (f) { var n = f.dim && f.dim.name ? f.dim.name : ''; var t = ''; try { t = f.getFilterString(); } catch (e) { /* ignore */ } return (n ? n + ' : ' : '') + t; }); }
    function tfFromJSON(dm, j) {
      var f = null;
      try { if (dm.castFilterSelection) f = dm.castFilterSelection(j); } catch (e) { f = null; }
      if (!f || !f.getFilterString) { try { var x = new W.DataModelSelectionFromJSON({ dimsToFilter: [j] }, dm.dm); f = x.dmsel && x.dmsel.dimsToFilter ? x.dmsel.dimsToFilter[0] : null; } catch (e) { f = null; } }
      return f && f.getFilterString ? f : null;
    }
    var before = fsnap();
    wrap(W.AxisEditor, 'ed'); wrap(W.DragEditHandler, 'dh');
    try {
      var cell = frame.querySelector('td.tdvHeader') || frame.querySelector('td.tdValueMeasure') || frame.querySelector('thead td');
      if (cell) { var r = cell.getBoundingClientRect(); cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2 })); }
      await sleep(400);
      if (!cap.ed && src) { var dt = new DataTransfer(); src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt })); await sleep(300); src.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt })); }
    } finally {
      saved.forEach(function (x) { x[0][x[1]] = x[2]; });
      D.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      D.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    function findEd(o, d, seen) {
      if (!o || typeof o !== 'object' || d > 3 || seen.indexOf(o) >= 0) return null;
      seen.push(o);
      if (o instanceof W.AxisEditor) return o;
      var ks = Object.keys(o);
      for (var i = 0; i < ks.length && i < 300; i++) { try { var x = findEd(o[ks[i]], d + 1, seen); if (x) return x; } catch (e) { /* ignore */ } }
      return null;
    }
    var ed = cap.ed || (cap.dh ? findEd(cap.dh, 0, []) : null);
    if (!ed) { toast('Éditeur du tableau introuvable : la version de DigDash a peut-être changé.', false); return; }
    var tBefore = tfList(ed).map(function (f) { return f.clone ? f.clone() : f; });
    var tExcl = {};
    try { var ex0 = ed.chart.dmsel.dimensionsToExcludeForNavigation || {}; Object.keys(ex0).forEach(function (k) { tExcl[k] = ex0[k]; }); } catch (e) { /* ignore */ }
    try { ed.applyViewJSON(V.vue); } catch (e) { toast('Échec de l\'application : ' + (e && e.message || e), false); return; }
    await sleep(1500);
    /* 1. filtres du tableau de bord (lien) : remis seulement s'ils ont été effacés */
    var dashOk = true;
    if (fsig(fsnap().map(fplain)) !== fsig(before.map(fplain))) dashOk = await frestore(before);
    /* 2. filtres du tableau : ceux en place sont prioritaires, ceux de la capture complètent les autres dimensions */
    var dm = ed.chart.dmsel, list = tBefore.slice(), have = {}, ko = [];
    list.forEach(function (f) { have[f.dim && f.dim.id ? f.dim.id : f.dim] = 1; });
    /* périodes relatives (dernier mois, N-1, 12 mois glissants...) calculées sur les mois disponibles au moment du clic : elles remplacent le filtre de date en place */
    var perTxt = [];
    (V.periodes || []).forEach(function (pr) {
      var base = null;
      (V.tfiltres || []).forEach(function (j) { if (j.dim === pr.dim) base = j; });
      if (!base) return;
      var f0 = tfFromJSON(dm, base);
      var mem = f0 && f0.dim && f0.dim.members ? f0.dim.members.filter(function (x) { return typeof x === 'number'; }) : [];
      if (!mem.length) { ko.push(pr.dim); return; }
      function key(t) { var d = new Date(t * 1000); return d.getFullYear() * 12 + d.getMonth(); }
      var byKey = {}, last = -Infinity;
      mem.forEach(function (t) { var k = key(t); byKey[k] = t; if (k > last) last = k; });
      var from = last, to = last;
      if (pr.mode === 'dernierN1') { from = to = last - 12; }
      else if (pr.mode === '12m') { from = last - 11; }
      else if (pr.mode === '12mN1') { from = last - 23; to = last - 12; }
      var sel = [];
      for (var k = from; k <= to; k++) if (byKey[k] !== undefined) sel.push(byKey[k]);
      if (!sel.length) { ko.push(pr.dim); return; }
      var j2 = {}; Object.keys(base).forEach(function (x) { if (x !== 'origIds') j2[x] = base[x]; });
      j2.selectedMembers = sel;
      var f2 = tfFromJSON(dm, j2);
      if (!f2) { ko.push(pr.dim); return; }
      try { if (f2.recalcIds) f2.recalcIds(); } catch (e) { /* ignore */ }
      list = list.filter(function (f) { return (f.dim && f.dim.id ? f.dim.id : f.dim) !== pr.dim; });
      list.push(f2); have[pr.dim] = 1;
      perTxt.push(sel.length + ' mois');
    });
    (V.tfiltres || []).forEach(function (j) { if (have[j.dim]) return; var f = tfFromJSON(dm, j); if (f) { list.push(f); have[j.dim] = 1; } else ko.push(j.dim); });
    var tabOk = true;
    if (list.length) {
      try {
        dm.removeFilters();
        list.forEach(function (f) { dm.setFilter(f.clone ? f.clone() : f); });
        var ex = dm.dimensionsToExcludeForNavigation || (dm.dimensionsToExcludeForNavigation = {});
        Object.keys(tExcl).forEach(function (k) { ex[k] = tExcl[k]; });
        Object.keys(have).forEach(function (k) { ex[k] = true; });
        try { ed.refreshDM(); } catch (e1) { try { ed.onDimFilterChange(); } catch (e2) { tabOk = false; } }
      } catch (e) { tabOk = false; }
    }
    await sleep(800);
    var txt = tfText(ed);
    var ok = dashOk && tabOk && !ko.length;
    toast('Présentation "' + V.name + '" appliquée' + (txt.length ? '. Filtres : ' + txt.join(' | ') : '') + (ok ? '.' : '. Attention : certains filtres n\'ont pas pu être remis' + (ko.length ? ' (' + ko.join(', ') + ')' : '') + '.'), ok);
  })();
};

/* Construction des scripts à partir d'une présentation enregistrée */
var LD_VIEWS = {
  captureScript: function () { return '(' + LD_VIEW_CAPTURE.toString() + ')();'; },
  minify: function (code) { return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*/g, ' '); },
  /* favori "Capturer une présentation" : utilisable par tout utilisateur, sans console */
  captureBookmarklet: function () {
    var code = '(' + LD_VIEW_CAPTURE.toString() + ')(' + JSON.stringify({ ui: true, applySrc: LD_VIEWS.minify(LD_VIEW_APPLY.toString()) }) + ');';
    return 'javascript:' + encodeURIComponent(LD_VIEWS.minify(code));
  },
  applyScript: function (view) {
    var V = { name: view.name, pageId: view.pageId, pageUid: view.pageUid, tfiltres: view.tfiltres || [], periodes: view.periodes || [], vue: view.vue };
    return '(' + LD_VIEW_APPLY.toString() + ')(' + JSON.stringify(V) + ');';
  },
  bookmarklet: function (view) {
    var code = LD_VIEWS.minify(LD_VIEWS.applyScript(view));
    return 'javascript:' + encodeURIComponent(code);
  }
};

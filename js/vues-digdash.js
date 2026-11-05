/* Présentations de Tableaux personnalisés DigDash (Self Service BI)
   LD_VIEW_CAPTURE : lit la mise en forme du tableau affiché (à coller dans la console du tableau de bord)
   LD_VIEW_APPLY   : réapplique une mise en forme enregistrée (script console ou favori)
   Les deux s'appuient sur l'éditeur interne de DigDash (AxisEditor.getCurrentViewJSON / applyViewJSON). */

var LD_VIEW_CAPTURE = function (opt) {
  opt = opt || {};
  var run = async function () {
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
    if (!tb) {
      if (opt.ui && opt.pages && opt.pages.length && W.ddCtrl) {
        var pb = panel('<b style="font-size:14px">Ouvrez d\'abord un tableau personnalisé</b>' +
          '<p style="margin:6px 0 10px;color:#374151">Choisissez le tableau à mettre en forme :</p>' +
          opt.pages.map(function (pg, i) { return '<button type="button" data-ld="go" data-i="' + i + '" style="display:block;width:100%;text-align:left;font:inherit;padding:8px 10px;margin:0 0 6px;border:1px solid #D1D5DB;border-radius:4px;background:#fff;cursor:pointer">' + String(pg.name).replace(/[&<>"]/g, '') + '</button>'; }).join('') +
          '<p style="margin:8px 0 0;color:#6B7280;font-size:12px">Ensuite, mettez le tableau en forme, puis cliquez de nouveau sur le favori "Assistant TdB RPE".</p>');
        Array.prototype.forEach.call(pb.querySelectorAll('[data-ld="go"]'), function (bt) {
          bt.onclick = function () { try { W.ddCtrl.changePage(opt.pages[+bt.getAttribute('data-i')].uid); } catch (e) { /* ignore */ } pb.remove(); };
        });
      } else fail('Aucun Tableau personnalisé visible : ouvrez une page Tableau personnalisé et mettez le tableau en forme.');
      return;
    }
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
      tdates: tfList(ed).filter(function (f) { return f.dim && (f.dim.time || /^D_/.test(f.dim.id)); }).map(function (f) {
        var t = '', j = {};
        try { t = f.getFilterString(); } catch (e) { /* ignore */ }
        try { j = JSON.parse(JSON.stringify(f)); } catch (e) { j = {}; }
        function key(x) { var d = new Date(x * 1000); return d.getFullYear() * 12 + d.getMonth(); }
        var mois = (f.dim.members || []).filter(function (x) { return typeof x === 'number'; }).map(function (x) { return { k: key(x), l: new Date(x * 1000).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }; }).sort(function (a, b) { return b.k - a.k; });
        return { dim: f.dim.id, nom: f.dim.name, texte: t, keys: (j.selectedMembers || []).filter(function (x) { return typeof x === 'number'; }).map(key), mois: mois };
      }),
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
    var nstep = 0;
    function stp(t) { nstep++; return '<div style="display:flex;align-items:center;gap:8px;margin:12px 0 4px;font-weight:bold"><span style="flex:none;width:22px;height:22px;border-radius:50%;background:#293378;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px">' + nstep + '</span>' + t + '</div>'; }
    var b = panel('<b style="font-size:15px">Créer votre favori</b>' +
      '<p style="margin:6px 0 0;color:#374151;background:#F5F2EE;border-radius:4px;padding:6px 8px">Tableau capturé : ' + esc(resume) + '</p>' +
      (out.tdates.length ? stp('Choisissez la période') : '') +
      out.tdates.map(function (d, i) {
        var sel = 'box-sizing:border-box;font:inherit;padding:6px 8px;border:1px solid #D1D5DB;border-radius:4px;';
        var opts = d.mois.map(function (m) { return '<option value="' + m.k + '">' + esc(m.l) + '</option>'; }).join('');
        return '<div data-ld="perbox" data-i="' + i + '" style="margin-bottom:10px"><label style="display:block;font-size:12px;color:#374151">Période (' + esc(d.nom) + ')</label>' +
          '<select data-ld="per" style="width:100%;' + sel + 'margin:4px 0">' +
          [['fixe', 'Période capturée : ' + d.texte], ['dernier', 'Dernier mois disponible'], ['dernierN1', 'Même mois, année précédente'], ['12m', '12 derniers mois (cumul)'], ['12mN1', '13e au 24e mois (cumul)'], ['mois', 'Un mois au choix'], ['plage', 'Une période au choix']]
            .map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
          '<div data-ld="permois" style="display:none"><select data-ld="m1" style="width:100%;' + sel + '">' + opts + '</select></div>' +
          '<div data-ld="perplage" style="display:none;gap:6px"><select data-ld="pdeb" style="flex:1;' + sel + '" title="Début">' + opts + '</select><select data-ld="pfin" style="flex:1;' + sel + '" title="Fin">' + opts + '</select></div></div>';
      }).join('') +
      stp('Vérifiez le nom du favori') +
      '<input data-ld="name" type="text" value="' + esc(out.dimensions.join(' x ').slice(0, 60)) + '" style="width:100%;box-sizing:border-box;font:inherit;padding:7px 8px;border:1px solid #D1D5DB;border-radius:4px;margin:0 0 4px">' +
      stp('Créez le favori') +
      '<button type="button" data-ld="make" style="' + btn + 'background:#293378;color:#fff;border:1px solid #293378">Créer le favori</button> ' +
      '<div data-ld="out" style="margin-top:10px"></div>');
    var zone = b.querySelector('[data-ld="out"]');
    Array.prototype.forEach.call(b.querySelectorAll('[data-ld="perbox"]'), function (bx) {
      var s0 = bx.querySelector('[data-ld="per"]');
      var pd = bx.querySelector('[data-ld="pdeb"]'); if (pd && pd.options.length > 11) pd.selectedIndex = 11;
      s0.onchange = function () {
        bx.querySelector('[data-ld="permois"]').style.display = s0.value === 'mois' ? 'block' : 'none';
        bx.querySelector('[data-ld="perplage"]').style.display = s0.value === 'plage' ? 'flex' : 'none';
      };
    });
    /* nom proposé : période choisie en tête, puis les dimensions (tant que l'utilisateur n'a pas modifié le nom) */
    var nameIn = b.querySelector('[data-ld="name"]'), nameEdited = false;
    nameIn.oninput = function () { nameEdited = true; };
    function perLabel(bx) {
      var d = out.tdates[+bx.getAttribute('data-i')], m = bx.querySelector('[data-ld="per"]').value;
      function lab(selName) { var x = bx.querySelector('[data-ld="' + selName + '"]'); return x && x.selectedIndex >= 0 ? x.options[x.selectedIndex].text : ''; }
      if (m === 'fixe') {
        var ks = (d.keys || []).slice().sort(function (x, y) { return x - y; });
        var ml = function (k) { var r = ''; (d.mois || []).forEach(function (o) { if (o.k === k) r = o.l; }); return r; };
        if (ks.length === 1 && ml(ks[0])) return ml(ks[0]);
        if (ks.length > 1 && ml(ks[0]) && ml(ks[ks.length - 1])) return ml(ks[0]) + ' à ' + ml(ks[ks.length - 1]);
        return d.texte;
      }
      if (m === 'dernier') return 'Dernier mois';
      if (m === 'dernierN1') return 'Même mois N-1';
      if (m === '12m') return '12 derniers mois';
      if (m === '12mN1') return '13e au 24e mois';
      if (m === 'mois') return lab('m1');
      if (m === 'plage') { var a = bx.querySelector('[data-ld="pdeb"]'), z = bx.querySelector('[data-ld="pfin"]'); var ia = a.selectedIndex, iz = z.selectedIndex; return (ia >= iz ? a.options[ia].text + ' à ' + z.options[iz].text : z.options[iz].text + ' à ' + a.options[ia].text); }
      return '';
    }
    function defName() {
      if (nameEdited) return;
      var bx = b.querySelector('[data-ld="perbox"]'), base = out.dimensions.join(' x ');
      nameIn.value = ((bx ? perLabel(bx) + ' - ' : '') + base).slice(0, 90);
    }
    Array.prototype.forEach.call(b.querySelectorAll('[data-ld="perbox"] select'), function (x) { x.addEventListener('change', defName); });
    defName();
    function periodes() {
      return Array.prototype.map.call(b.querySelectorAll('[data-ld="perbox"]'), function (bx) {
        var d = out.tdates[+bx.getAttribute('data-i')], m = bx.querySelector('[data-ld="per"]').value, p = { dim: d.dim, mode: m };
        if (m === 'fixe') { p.mode = 'mois'; p.keys = d.keys; }
        if (m === 'mois') { p.keys = [+bx.querySelector('[data-ld="m1"]').value]; }
        if (m === 'plage') { var a = +bx.querySelector('[data-ld="pdeb"]').value, z = +bx.querySelector('[data-ld="pfin"]').value; p.from = Math.min(a, z); p.to = Math.max(a, z); }
        return p;
      });
    }
    b.querySelector('[data-ld="make"]').onclick = function () {
      var name = b.querySelector('[data-ld="name"]').value.trim() || 'Ma présentation';
      var V = { name: name, pageId: out.pageId, pageUid: out.pageUid, tfiltres: out.tfiltres, periodes: periodes(), vue: out.vue };
      var href = 'javascript:' + encodeURIComponent('(' + opt.applySrc + ')(' + JSON.stringify(V) + ');');
      zone.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-weight:bold"><span style="flex:none;width:22px;height:22px;border-radius:50%;background:#1B7F3B;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px">' + (nstep + 1) + '</span>Rangez-le dans vos favoris</div>' +
        '<p style="margin:0 0 8px">Cliquez sur le bouton jaune, gardez le clic enfoncé et <b>faites-le glisser tout en haut de la fenêtre</b>, dans la barre de favoris, puis relâchez.</p>' +
        '<div style="text-align:center"><a href="' + esc(href) + '" draggable="true" title="Faites-moi glisser vers la barre de favoris" style="display:inline-block;background:#FFCC52;color:#0D1440;font-weight:bold;text-decoration:none;padding:9px 14px;border-radius:4px;box-shadow:0 0 0 4px rgba(255,204,82,.35);cursor:grab">&#9733; ' + esc(name) + '</a></div>' +
        '<p style="margin:8px 0 0;color:#6B7280;font-size:12px">Vous ne voyez pas la barre de favoris ? Appuyez sur Ctrl+Maj+B. Ensuite, un clic sur ce favori, depuis n\'importe quelle page du tableau de bord, remettra le tableau dans cette présentation.</p>';
      zone.querySelector('a').onclick = function (e) { e.preventDefault(); };
    };
  };

  /* ---- Assistant pas à pas affiché DANS le tableau de bord (favori "Assistant TdB RPE") ---- */
  function guide() {
    var D = document, W = window, timer = null;
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function vis(e) { return !!(e && (e.offsetWidth || e.offsetHeight)); }
    function toolbar() { return Array.prototype.filter.call(D.querySelectorAll('.editToolbar'), vis)[0] || null; }
    if (!W.ddCtrl) { alertBox('Ouvrez d\'abord le tableau de bord RPE, puis cliquez de nouveau sur le favori "Assistant TdB RPE".'); return; }
    function alertBox(msg) { var a = D.createElement('div'); a.style.cssText = 'position:fixed;z-index:999999;right:16px;bottom:16px;max-width:360px;background:#D92424;color:#fff;padding:12px 16px;border-radius:8px;font:13px Arial,sans-serif'; a.textContent = msg; D.body.appendChild(a); setTimeout(function () { a.remove(); }, 6000); }
    var old = D.getElementById('ldGuide'); if (old) old.remove();
    var g = D.createElement('div');
    g.id = 'ldGuide';
    g.style.cssText = 'position:fixed;z-index:999998;right:16px;top:80px;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 100px);overflow:auto;background:#fff;color:#0D1440;border:1px solid #E5E7EB;border-top:5px solid #FFCC52;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.28);font:13px Arial,sans-serif;line-height:1.5';
    D.body.appendChild(g);
    var B = 'font:inherit;font-weight:bold;border-radius:4px;padding:8px 12px;cursor:pointer;';
    var B1 = B + 'background:#293378;color:#fff;border:1px solid #293378;', B2 = B + 'background:#fff;color:#293378;border:1px solid #293378;';
    function frame(n, title, body) {
      var dots = [1, 2, 3].map(function (i) { return '<span style="flex:1;height:5px;border-radius:3px;background:' + (i < n ? '#406BDE' : i === n ? '#293378' : '#E5E7EB') + '"></span>'; }).join('');
      g.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:12px 14px 6px"><b style="flex:1;font-size:15px">Assistant TdB RPE</b>' +
        '<button type="button" data-g="min" title="Réduire" style="border:0;background:none;font-size:18px;cursor:pointer;color:#6B7280">&minus;</button>' +
        '<button type="button" data-g="close" title="Fermer" style="border:0;background:none;font-size:20px;cursor:pointer;color:#6B7280">&times;</button></div>' +
        '<div style="display:flex;gap:4px;padding:0 14px">' + dots + '</div>' +
        '<div style="padding:10px 14px 14px"><div style="font-size:12px;color:#6B7280">Étape ' + n + ' sur 3</div><b style="display:block;font-size:14px;margin:2px 0 8px">' + title + '</b>' + body + '</div>';
      g.querySelector('[data-g="close"]').onclick = function () { clearInterval(timer); unhi(); g.remove(); };
      g.querySelector('[data-g="min"]').onclick = function () {
        var body0 = g.innerHTML; unhi();
        g.style.width = 'auto'; g.style.top = 'auto'; g.style.bottom = '16px';
        g.innerHTML = '<button type="button" style="' + B1 + '">Assistant TdB RPE : reprendre</button>';
        g.querySelector('button').onclick = function () { g.style.width = '360px'; g.style.top = '80px'; g.style.bottom = 'auto'; show(cur); };
      };
    }
    /* mise en évidence d'un élément du tableau de bord, avec une bulle explicative */
    var hiEls = [];
    function unhi() { hiEls.forEach(function (e) { e.remove(); }); hiEls = []; }
    function hi(el, text) {
      unhi();
      if (!el) return;
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* ignore */ }
      setTimeout(function () {
        var r = el.getBoundingClientRect();
        var o = D.createElement('div');
        o.style.cssText = 'position:fixed;z-index:999997;pointer-events:none;left:' + (r.left - 6) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px;border:4px solid #FFCC52;border-radius:8px;box-shadow:0 0 0 9999px rgba(13,20,64,.35)';
        var t = D.createElement('div');
        var top = r.bottom + 12 + 80 > W.innerHeight ? Math.max(8, r.top - 70) : r.bottom + 12;
        t.style.cssText = 'position:fixed;z-index:999998;max-width:280px;left:' + Math.max(8, Math.min(r.left, W.innerWidth - 300)) + 'px;top:' + top + 'px;background:#0D1440;color:#fff;padding:8px 12px;border-radius:6px;font:13px Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3)';
        t.textContent = text;
        D.body.appendChild(o); D.body.appendChild(t); hiEls = [o, t];
        setTimeout(unhi, 6000);
      }, 350);
    }
    var cur = 1;
    function show(n) {
      cur = n; clearInterval(timer); unhi();
      var tb = toolbar();
      if (n === 1) {
        frame(1, 'Choisissez le tableau à mettre en forme',
          (tb ? '<p style="margin:0 0 8px;background:#E2E8FB;border-radius:4px;padding:6px 8px">Vous êtes déjà sur un tableau personnalisé. <button type="button" data-g="here" style="' + B2 + 'padding:4px 8px">Continuer avec celui-ci</button></p>' : '') +
          (opt.pages || []).map(function (pg, i) { return '<button type="button" data-g="go" data-i="' + i + '" style="display:block;width:100%;text-align:left;font:inherit;padding:9px 10px;margin:0 0 6px;border:1px solid #D1D5DB;border-radius:6px;background:#fff;cursor:pointer">' + esc(pg.name) + '</button>'; }).join(''));
        Array.prototype.forEach.call(g.querySelectorAll('[data-g="go"]'), function (bt) {
          bt.onclick = function () {
            var pg = opt.pages[+bt.getAttribute('data-i')];
            try { W.ddCtrl.changePage(pg.uid); } catch (e) { /* ignore */ }
            g.querySelector('div[style*="padding:10px"]').innerHTML = '<p>Ouverture du tableau <b>' + esc(pg.name) + '</b>...</p>';
            var t0 = Date.now();
            timer = setInterval(function () {
              var t = toolbar(), pgEl = t && t.closest('.dashboard_page[role="main"]');
              if (t && pgEl && (!pg.uid || pgEl.getAttribute('uid') === String(pg.uid))) { clearInterval(timer); show(2); }
              else if (Date.now() - t0 > 30000) { clearInterval(timer); show(1); }
            }, 500);
          };
        });
        var here = g.querySelector('[data-g="here"]'); if (here) here.onclick = function () { show(2); };
      } else if (n === 2) {
        if (!tb) { show(1); return; }
        var st = 'display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px dashed #E5E7EB';
        var num = function (k) { return '<span style="flex:none;width:20px;height:20px;border-radius:50%;background:#E3E5F1;color:#293378;font-weight:bold;font-size:11px;display:inline-flex;align-items:center;justify-content:center">' + k + '</span>'; };
        var show2 = function (k) { return ' <button type="button" data-g="show" data-k="' + k + '" style="' + B2 + 'padding:2px 8px;font-size:12px">Me montrer</button>'; };
        frame(2, 'Mettez le tableau en forme',
          '<div style="' + st + '">' + num(1) + '<div><b>Lignes et colonnes</b> : dans la liste <b>Dimensions</b>, à gauche, faites glisser une dimension sur l\'en-tête du tableau.' + show2('dim') + '</div></div>' +
          '<div style="' + st + '">' + num(2) + '<div><b>Chiffres</b> : sous <b>Mesures</b>, faites glisser la mesure voulue dans le tableau.' + show2('mes') + '</div></div>' +
          '<div style="' + st + '">' + num(3) + '<div><b>Filtres</b> : cliquez sur l\'<b>entonnoir</b>, puis <b>Ajouter un filtre</b> (territoire, sexe, date...) et validez par <b>OK</b>.' + show2('fil') + '</div></div>' +
          '<div style="' + st + ';border-bottom:0">' + num(4) + '<div>Le résultat s\'affiche dans le <b>tableau</b>. Vérifiez qu\'il vous convient.' + show2('tab') + '</div></div>' +
          '<p style="margin:8px 0;background:#FFF4D6;border-radius:4px;padding:6px 8px;font-size:12px">Une erreur ? Appuyez sur F5 pour revenir au tableau d\'origine, puis relancez l\'assistant.</p>' +
          '<div style="display:flex;gap:8px;justify-content:space-between"><button type="button" data-g="back" style="' + B2 + '">Changer de tableau</button><button type="button" data-g="next" style="' + B1 + '">Mon tableau est prêt</button></div>');
        Array.prototype.forEach.call(g.querySelectorAll('[data-g="show"]'), function (bt) {
          bt.onclick = function () {
            var k = bt.getAttribute('data-k'), t = toolbar(); if (!t) return;
            var fr = D.getElementById(t.id.replace(/_editToolbar$/, ''));
            if (k === 'dim') hi(t.querySelector('.editToolTitle1') || t, 'Les dimensions : faites-en glisser une sur l\'en-tête du tableau.');
            if (k === 'mes') hi(t.querySelector('.editToolTitle1[title="Mesures"]') || t, 'Les mesures : faites glisser celle que vous voulez afficher.');
            if (k === 'fil') hi(t.querySelector('.editToolIconFilters') || t, 'Cliquez ici pour ouvrir les filtres du tableau.');
            if (k === 'tab') hi((fr && fr.querySelector('table.table')) || fr, 'Votre tableau : son en-tête reçoit les dimensions glissées.');
          };
        });
        g.querySelector('[data-g="back"]').onclick = function () { show(1); };
        g.querySelector('[data-g="next"]').onclick = function () { show(3); };
      } else {
        frame(3, 'Enregistrez votre présentation',
          '<p style="margin:0 0 10px">Une fenêtre va s\'ouvrir en bas à droite. Vous y choisirez la <b>période</b> (si le tableau contient une date), vérifierez le <b>nom</b>, puis rangerez le <b>bouton jaune</b> dans votre barre de favoris.</p>' +
          '<div style="display:flex;gap:8px;justify-content:space-between"><button type="button" data-g="back" style="' + B2 + '">Retour</button><button type="button" data-g="cap" style="' + B1 + '">Capturer maintenant</button></div>');
        g.querySelector('[data-g="back"]').onclick = function () { show(2); };
        g.querySelector('[data-g="cap"]').onclick = function () { unhi(); g.remove(); run(); };
      }
    }
    show(toolbar() ? 2 : 1);
  }

  if (opt.ui && opt.guide) guide(); else run();
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
    /* reconstruction d'un filtre comme le fait DigDash : new FilterSelection(dimension, hiérarchie, niveau, positions, membres...)
       les positions (origIds) sont recalculées à chaque fois, car l'ordre interne des membres peut changer d'une session à l'autre */
    function tfDim(dm, id) {
      var d = dm && dm.availableDim ? dm.availableDim[id] : null;
      if (d && typeof d === 'object') return d;
      try {
        var src = dm.dm || {}, found = null;
        Object.keys(src).forEach(function (k) {
          var v = src[k], arr = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (x) { return v[x]; }) : []);
          arr.forEach(function (x) { if (!found && x && x.id === id && Array.isArray(x.members)) found = x; });
        });
        return found;
      } catch (e) { return null; }
    }
    function tfFromJSON(dm, j) {
      var FS = W.FilterSelection, dim = tfDim(dm, j.dim);
      if (!FS || !dim) return null;
      var h = j.hierarchy == null ? -1 : j.hierarchy, l = j.level == null ? -1 : j.level, oids = null;
      var all = j.selectedMembers || [];
      var mem = Array.isArray(dim.members) ? all.filter(function (m) { return dim.members.indexOf(m) >= 0; }) : [];
      /* dimensions volumineuses (territoires) : membres chargés côté serveur, absents de la liste locale.
         On transmet alors les valeurs telles quelles, comme DigDash (recalcIds se charge du reste). */
      if (!mem.length && all.length) {
        var ff = new FS(dim, h, l, dim.membersOnServer ? [] : (j.origIds || []).slice(), all.slice(), undefined, j.mode || 0, j.displayValue);
        try { ff.recalcIds(); } catch (e) { /* ignore */ }
        return ff;
      }
      if (!mem.length) return null;
      if (l !== -1 && typeof W.getMemberPos === 'function') { try { oids = W.getMemberPos(dim, h, l, mem); } catch (e) { oids = null; } }
      if (l === -1 || !oids || !oids.length) { l = -1; oids = mem.map(function (m) { return dim.members.indexOf(m); }); }
      var f = new FS(dim, h, l, oids, mem.slice(), undefined, j.mode || 0, j.displayValue);
      try { f.recalcIds(); } catch (e) { /* ignore */ }
      return f;
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
    if (fsig(fsnap().map(fplain)) !== fsig(before.map(fplain))) { dashOk = await frestore(before); if (!dashOk) ko.push('filtres du lien'); }
    /* 2. filtres du tableau : ceux en place sont prioritaires, ceux de la capture complètent les autres dimensions */
    var dm = ed.chart.dmsel, list = tBefore.slice(), have = {}, ko = [];
    list.forEach(function (f) { have[f.dim && f.dim.id ? f.dim.id : f.dim] = 1; });
    /* périodes (dernier mois, N-1, 12 mois, mois ou période au choix) : calculées sur les mois disponibles au moment du clic,
       appliquées à la dimension date du tableau affiché (son nom varie d'un tableau à l'autre) ; elles remplacent le filtre de date en place */
    function mkey(t) { var d = new Date(t * 1000); return d.getFullYear() * 12 + d.getMonth(); }
    function dmTimeDims() {
      var r = [];
      try {
        var src = dm.dm || {};
        Object.keys(src).forEach(function (k) {
          var v = src[k], arr = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (x) { return v[x]; }) : []);
          arr.forEach(function (d) { if (d && d.time && d.id && d.id !== 'DATMAJ' && Array.isArray(d.members) && d.members.length > 1 && r.indexOf(d) < 0) r.push(d); });
        });
      } catch (e) { /* ignore */ }
      /* dimension date principale : préfixe D_, puis le plus de mois */
      return r.sort(function (a, b) { return ((/^D_/.test(b.id) ? 1000 : 0) + b.members.length) - ((/^D_/.test(a.id) ? 1000 : 0) + a.members.length); });
    }
    var pers = (V.periodes || []).slice(), pdims = {};
    pers.forEach(function (p) { pdims[p.dim] = 1; });
    (V.tfiltres || []).forEach(function (j) {
      if (/^D_/.test(j.dim) && !pdims[j.dim]) { pers.push({ dim: j.dim, mode: 'mois', keys: (j.selectedMembers || []).filter(function (x) { return typeof x === 'number'; }).map(mkey) }); pdims[j.dim] = 1; }
    });
    pers.forEach(function (pr) {
      var base = null, target = null, hl = { h: 0, l: 0 };
      (V.tfiltres || []).forEach(function (j) { if (j.dim === pr.dim) base = j; });
      var f0 = base ? tfFromJSON(dm, base) : null;
      if (f0 && f0.dim && Array.isArray(f0.dim.members)) { target = f0.dim; hl = { h: base.hierarchy, l: base.level }; }
      if (!target) list.forEach(function (f) { if (!target && f.dim && (f.dim.time || /^D_/.test(f.dim.id)) && Array.isArray(f.dim.members)) { target = f.dim; try { var jj = JSON.parse(JSON.stringify(f)); hl = { h: jj.hierarchy, l: jj.level }; } catch (e) { /* ignore */ } } });
      if (!target) {
        var td = dmTimeDims();
        if (td.length) {
          target = td[0];
          /* hiérarchie contenant le niveau Mois, sinon pas de hiérarchie */
          hl = { h: -1, l: -1 };
          (target.hierarchies || []).some(function (h, hi) { var li = -1; (h.levels || []).forEach(function (l, i) { if (li < 0 && /mois/i.test(l.name || l.id || '')) li = i; }); if (li >= 0) { hl = { h: hi, l: li }; return true; } return false; });
        }
      }
      if (!target) { ko.push(pr.dim); return; }
      var byKey = {}, last = -Infinity;
      target.members.forEach(function (t) { if (typeof t !== 'number') return; var k = mkey(t); byKey[k] = t; if (k > last) last = k; });
      var from = last, to = last;
      if (pr.mode === 'dernierN1') { from = to = last - 12; }
      else if (pr.mode === '12m') { from = last - 11; }
      else if (pr.mode === '12mN1') { from = last - 23; to = last - 12; }
      else if (pr.mode === 'plage') { from = pr.from; to = pr.to; }
      var sel = [];
      if (pr.mode === 'mois') (pr.keys || []).forEach(function (k) { if (byKey[k] !== undefined) sel.push(byKey[k]); });
      else for (var k = from; k <= to; k++) if (byKey[k] !== undefined) sel.push(byKey[k]);
      if (!sel.length) { ko.push((target.name || target.id) + ' : mois absent des données'); return; }
      /* origIds : position des membres dans la dimension (indispensable à DigDash) */
      /* niveau -1 : membres bruts, comme les filtres de date posés par la popup */
      var f2 = tfFromJSON(dm, { dim: target.id, hierarchy: target.hierarchies && target.hierarchies.length ? 0 : -1, level: -1, selectedMembers: sel, mode: 0 });
      if (!f2) { ko.push(target.id + ' : filtre refusé'); return; }
      list = list.filter(function (f) { return (f.dim && f.dim.id ? f.dim.id : f.dim) !== target.id; });
      list.push(f2); have[target.id] = 1;
    });
    (V.tfiltres || []).forEach(function (j) { if (have[j.dim] || pdims[j.dim]) return; var f = tfFromJSON(dm, j); if (f) { list.push(f); have[j.dim] = 1; } else ko.push(j.dim); });
    var tabOk = true;
    if (list.length) {
      try {
        dm.removeFilters();
        list.forEach(function (f) {
          var done = false, err = null;
          try {
            if (dm.setFilter(f.clone ? f.clone() : f) === false) err = 'dimension absente de ce tableau';
            else { f.getFilterString(); done = true; }
          } catch (e) { err = e; try { dm.removeFilterByDimension(f.dim); } catch (e2) { /* ignore */ } }
          if (!done) ko.push((f.dim && (f.dim.name || f.dim.id)) + ' : ' + (err && err.message || err));
        });
        var ex = dm.dimensionsToExcludeForNavigation || (dm.dimensionsToExcludeForNavigation = {});
        Object.keys(tExcl).forEach(function (k) { ex[k] = tExcl[k]; });
        Object.keys(have).forEach(function (k) { ex[k] = true; });
        try { ed.refreshDM(); } catch (e1) { try { ed.onDimFilterChange(); } catch (e2) { tabOk = false; ko.push('rafraîchissement : ' + (e2 && e2.message || e2)); } }
      } catch (e) { tabOk = false; ko.push('filtres du tableau : ' + (e && e.message || e)); }
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
  captureBookmarklet: function (pages) {
    var code = '(' + LD_VIEW_CAPTURE.toString() + ')(' + JSON.stringify({ ui: true, guide: true, pages: pages || [], applySrc: LD_VIEWS.minify(LD_VIEW_APPLY.toString()) }) + ');';
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

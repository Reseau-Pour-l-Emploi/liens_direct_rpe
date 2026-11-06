/* Présentations de Tableaux personnalisés DigDash (Self Service BI)
   LD_VIEW_CAPTURE : lit la mise en forme du tableau affiché (à coller dans la console du tableau de bord)
   LD_VIEW_APPLY   : réapplique une mise en forme enregistrée (script console ou favori)
   Les deux s'appuient sur l'éditeur interne de DigDash (AxisEditor.getCurrentViewJSON / applyViewJSON). */

var LD_VIEW_CAPTURE = function (opt) {
  opt = opt || {};
  /* lecture en direct du tableau de bord (menu, pages, tableaux personnalisés) : aucune extraction à tenir à jour */
  function live() {
    var D = document, titles = {}, names = {}, tables = [], seen = {};
    function tx(e) { return (e.textContent || '').replace(/\s+/g, ' ').trim(); }
    Array.prototype.forEach.call(D.querySelectorAll('[id$="_0_menu_title_text"]'), function (el) { titles[el.id.replace(/_0_menu_title_text$/, '')] = tx(el); });
    var menu = Object.keys(titles).sort(function (a, b) { return a.length - b.length; });
    Array.prototype.forEach.call(D.querySelectorAll('.dashboard_page[role="main"][uid]'), function (el) {
      var id = el.id; if (seen[id]) return; seen[id] = 1;
      var path = [], parent = '';
      menu.forEach(function (m) { if (m !== id && id.indexOf(m + '_') === 0) { path.push(titles[m]); parent = m; } });
      var title = titles[id] || id.slice(parent ? parent.length + 1 : 0).replace(/___/g, ' / ').replace(/_/g, ' ').trim();
      names[id] = (path.length > 1 ? path.slice(1).join(' > ') + ' > ' : '') + title;
      if (/tableau personnalis/i.test(title + ' ' + path.join(' '))) tables.push({ name: path[1] || title, uid: el.getAttribute('uid'), id: id });
    });
    return { names: names, tables: tables };
  }
  var LV = live();
  /* fenêtres de l'assistant : déplaçables par leur barre de titre, réductibles en un bouton */
  function mover(box, bar) {
    bar.style.cursor = 'move';
    bar.title = 'Cliquez et faites glisser pour déplacer la fenêtre';
    bar.onmousedown = function (ev) {
      if (ev.button !== 0 || ev.target.closest('button,a,input,select')) return;
      var r = box.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      box.style.left = r.left + 'px'; box.style.top = r.top + 'px'; box.style.right = 'auto'; box.style.bottom = 'auto';
      function mv(e) { box.style.left = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dx)) + 'px'; box.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy)) + 'px'; }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
      ev.preventDefault();
    };
  }
  function reduce(box, onHide) {
    if (onHide) onHide();
    box.style.display = 'none';
    var p = document.createElement('button');
    p.type = 'button'; p.id = 'ldPill';
    p.style.cssText = 'position:fixed;z-index:999999;right:16px;bottom:16px;font:bold 13px Arial,sans-serif;padding:10px 14px;border-radius:20px;border:0;background:#FFCC52;color:#0D1440;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer';
    p.textContent = '🧭 Assistant TdB RPE : reprendre';
    p.title = 'Rouvrir la fenêtre de l\'assistant';
    var old = document.getElementById('ldPill'); if (old) old.remove();
    document.body.appendChild(p);
    p.onclick = function () { p.remove(); box.style.display = ''; };
  }
  var run = async function (mode) {
    var D = document, W = window, cap = { ed: null, dh: null };
    /* message : console (admin) ou panneau à l'écran (favori utilisateur) */
    function panel(html) {
      var b = D.getElementById('ldVuePanel') || D.createElement('div');
      b.id = 'ldVuePanel';
      b.style.cssText = 'position:fixed;z-index:999999;right:16px;bottom:16px;width:380px;max-width:calc(100vw - 32px);background:#fff;color:#0D1440;border:1px solid #E5E7EB;border-top:4px solid #293378;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.25);font:13px Arial,sans-serif;padding:14px 16px;line-height:1.45';
      b.style.display = '';
      b.style.maxHeight = 'calc(100vh - 32px)'; b.style.overflow = 'auto';
      b.innerHTML = '<div data-ld="bar" style="display:flex;align-items:center;gap:6px;margin:-14px -16px 8px;padding:6px 8px 6px 16px;background:#F5F2EE;border-radius:8px 8px 0 0;font-size:12px;color:#6B7280;user-select:none"><span style="flex:1">&#10021; Déplacer la fenêtre</span>' +
        '<button type="button" data-ld="min" title="Réduire le temps de construire votre tableau" style="border:0;background:none;font-size:18px;cursor:pointer;color:#6B7280">&minus;</button>' +
        '<button type="button" data-ld="close" style="border:0;background:none;font-size:18px;cursor:pointer;color:#6B7280" title="Fermer">&times;</button></div>' + html;
      D.body.appendChild(b);
      mover(b, b.querySelector('[data-ld="bar"]'));
      b.querySelector('[data-ld="min"]').onclick = function () { reduce(b); };
      b.querySelector('[data-ld="close"]').onclick = function () { var pl = D.getElementById('ldPill'); if (pl) pl.remove(); b.remove(); };
      return b;
    }
    function fail(msg) { if (opt.ui) panel('<b>Capture impossible</b><p style="margin:6px 0 0">' + msg + '</p>'); else console.log(msg); }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function vis(e) { return !!(e && (e.offsetWidth || e.offsetHeight)); }
    var tb = Array.prototype.filter.call(D.querySelectorAll('.editToolbar'), vis)[0];
    if (!tb || mode === 'page') {
      if (opt.ui && W.ddCtrl) capPage();
      else fail('Aucun Tableau personnalisé visible : ouvrez une page Tableau personnalisé et mettez le tableau en forme.');
      return;
    }
    /* ---- page classique : favori = lien direct vers la page avec ses filtres (un seul clic, même depuis un onglet vide) ---- */
    function capPage() {
      var e = encodeURIComponent, k = 0;
      function h(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
      function st(t) { k++; return '<div style="display:flex;align-items:center;gap:8px;margin:12px 0 4px;font-weight:bold"><span style="flex:none;width:22px;height:22px;border-radius:50%;background:#293378;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px">' + k + '</span>' + t + '</div>'; }
      var B = 'font:inherit;font-weight:bold;border-radius:4px;padding:7px 12px;cursor:pointer;';
      var SEL = 'box-sizing:border-box;font:inherit;padding:6px 8px;border:1px solid #D1D5DB;border-radius:4px;width:100%;margin:4px 0;';
      var pg = Array.prototype.filter.call(D.querySelectorAll('.dashboard_page[role="main"][uid]'), vis)[0];
      if (!pg) { fail('Aucune page du tableau de bord n\'est affichée.'); return; }
      var pname = LV.names[pg.id] || (opt.names || {})[pg.id] || pg.id.replace(/_/g, ' ');
      var q = new URLSearchParams(location.search), home = opt.home;
      if (!home) home = location.origin + location.pathname + '?' + ['domain', 'user', 'pass'].filter(function (x) { return q.get(x); }).map(function (x) { return x + '=' + e(q.get(x)); }).join('&');
      var url = home.replace('?', '?defaultPage=' + e(pg.id) + (/\?$/.test(home) ? '' : '&')), lst = [], warn = [], keep = [], dates = [];
      /* les identifiants des éléments du panneau de filtres finissent par "false" (dimensions) ou "true" (dates) */
      function sx(d) { return D.getElementById('dimName' + d + 'false') ? 'false' : 'true'; }
      function el(p, d) { return D.getElementById(p + d + sx(d)); }
      /* hiérarchie et niveaux lus dans le panneau de filtres ; niveau du membre lu dans l'arbre du filtre (aria-level) */
      function hierOf(d) {
        var hs = el('H', d), ls = el('L', d);
        return { h: hs && hs.options.length ? hs.options[hs.selectedIndex >= 0 ? hs.selectedIndex : 0].value : '', L: ls ? Array.prototype.map.call(ls.options, function (o) { return o.value; }).reverse() : [] };
      }
      function treeLvl(v, lab) {
        var c = Array.prototype.filter.call(D.querySelectorAll('li[member]'), function (li) { return li.getAttribute('member') === v; });
        if (c.length > 1) { var U = String(lab || '').toUpperCase(), m = c.filter(function (li) { return String(li.getAttribute('memberformated') || '').toUpperCase() === U; }); if (m.length) c = m; }
        if (c.length > 1) { var s1 = c.filter(function (li) { return li.querySelector('.jstree-clicked,[aria-selected="true"]'); }); if (s1.length) c = s1; }
        if (!c.length) return 0;
        var an = c[0].querySelector('a[aria-level]'), n = an ? +an.getAttribute('aria-level') : 0;
        if (n) return n;
        n = 1; var x = c[0];
        while (x && x.parentNode && x.parentNode.closest && (x = x.parentNode.closest('li.jstree-node,li[member]'))) n++;
        return n;
      }
      function lvlName(p, T, L, v, lab) {
        if (typeof p.l === 'string' && p.l && isNaN(+p.l)) return p.l;
        var n = treeLvl(v, lab);
        if (n && L[n - 1]) return L[n - 1];
        if (T) {
          var c = T.c[v];
          if (c && typeof c === 'object') c = c[String(lab || '').toUpperCase()];
          if (c && T.L[c - 1]) return T.L[c - 1];
        }
        if (/^CLPE/i.test(v) && L.length) return L[L.length - 1];
        return '';
      }
      function dimName(d) { var t = el('dim', d), sp = el('dimName', d), n = (opt.dims || {})[d] || (t && t.getAttribute('title')) || (sp && sp.textContent.trim()) || d; return n === d && /^D_/.test(d) ? 'Date' : n; }
      /* mois d'une valeur de date : 01/02/2024, 2024-02, "février 2024" ou horodatage */
      var MO = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      function mkey(x) {
        var s = String(x == null ? '' : x).replace(/^combo_result_/, '').trim().toLowerCase(), m;
        if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return +m[3] * 12 + (+m[2] - 1);
        if ((m = s.match(/^(\d{4})-(\d{2})/))) return +m[1] * 12 + (+m[2] - 1);
        if ((m = s.match(/^([a-zéû]+)\.? (\d{4})$/))) { var i = MO.indexOf(m[1]); if (i < 0) MO.forEach(function (n, j) { if (n.indexOf(m[1]) === 0) i = j; }); if (i >= 0) return +m[2] * 12 + i; }
        if (/^\d{9,13}$/.test(s)) { var dt = new Date(s.length > 11 ? +s : +s * 1000); return dt.getFullYear() * 12 + dt.getMonth(); }
        return null;
      }
      function mlab(k) { return MO[k % 12] + ' ' + Math.floor(k / 12); }
      /* cases à cocher de la page (ex. actualisation hybride) et filtre masqué qu'elles pilotent (checkboxTypeMesure -> C_TYPEMESURE) */
      var cks = Array.prototype.filter.call(D.querySelectorAll('.gwt-HTML input[type="checkbox"].custom-check'), vis).map(function (c) {
        var kk = '', pe = c.parentElement;
        (pe && typeof pe.className === 'string' ? pe.className.split(/\s+/) : []).forEach(function (n) { var m = n.match(/^checkbox(\w+?)\d*$/i); if (m) kk = m[1].toUpperCase(); });
        return { label: pe ? pe.textContent.replace(/\s+/g, ' ').trim() : '', checked: !!c.checked, key: kk };
      }).filter(function (c) { return c.label; });
      function linked(d) { return cks.some(function (c) { return c.key && d.toUpperCase().indexOf(c.key) >= 0; }); }
      var act = {};
      fsnap().map(fplain).forEach(function (p) {
        act[p.dimId] = 1;
        var vals = [].concat(p.member).map(function (v) { return String(v).replace(/^combo_result_/, ''); }).filter(function (v) { return v && v !== 'All'; });
        var labs = [].concat(p.memberFormated || []).map(String), dn = dimName(p.dimId);
        if (!vals.length) return;
        if (p.bExcludeFilter) { warn.push(dn); return; }
        if (!linked(p.dimId)) keep.push(p);
        url += '&' + e(p.dimId) + '=' + e(vals.join(','));
        var T = (opt.terr || {})[p.dimId], HL = hierOf(p.dimId), L = HL.L.length ? HL.L : (T ? T.L : []), hh = p.h || HL.h || (T && T.h);
        if (hh && (T || treeLvl(vals[0], labs[0]))) { var ln = lvlName(p, T, L, vals[0], labs[0]); url += '&' + e('H' + p.dimId) + '=' + e(hh); if (ln) url += '&' + e('L' + p.dimId) + '=' + e(ln); }
        var shown = labs.length === vals.length ? labs.join(', ') : vals.join(', ');
        /* filtre de date : mois disponibles lus dans le panneau de filtres */
        if (/^D_/.test(p.dimId) && vals.length === 1) {
          var ms = el('M', p.dimId), mois = [], seen = {};
          if (ms) Array.prototype.forEach.call(ms.options, function (o) { var kx = mkey(o.value); if (kx !== null && !seen[kx]) { seen[kx] = 1; mois.push({ k: kx, l: mlab(kx), v: o.value }); } });
          mois.sort(function (a, b) { return b.k - a.k; });
          var k0 = mkey(labs[0]); if (k0 === null) k0 = mkey(vals[0]);
          if (mois.length && k0 !== null) dates.push({ dim: p.dimId, nom: dn, texte: shown, k0: k0, mois: mois });
        }
        if (!linked(p.dimId)) lst.push({ d: dn, v: shown, date: /^D_/.test(p.dimId) });
      });
      /* sans filtre actif sur le filtre piloté par une case : toutes les valeurs, pour que le lien ne retombe pas sur le réglage par défaut */
      fdims().forEach(function (d) {
        if (act[d] || !linked(d)) return;
        var t = el('dim', d), ms = el('M', d);
        if (!t || t.style.display !== 'none' || !ms) return;
        var vals = Array.prototype.map.call(ms.options, function (o) { return o.value; }).filter(function (v) { return v && v !== 'Tous' && v !== 'All'; });
        if (!vals.length || vals.length > 20) return;
        url += '&' + e(d) + '=' + e(vals.join(','));
      });
      function perOpts(d) {
        var S = {}, n = d.mois.length, L = d.mois[0].k;
        d.mois.forEach(function (m) { S[m.k] = 1; });
        return [['fixe', 'Période capturée : ' + d.texte], ['dernier', 'Dernier mois disponible'], ['dernierN1', 'Même mois, année précédente'], ['mois', 'Un mois au choix']]
          .filter(function (o) { return o[0] === 'fixe' || (o[0] === 'dernier' && n > 0) || (o[0] === 'dernierN1' && S[L - 12]) || (o[0] === 'mois' && n > 1); });
      }
      var b = panel('<b style="font-size:15px">Créer votre favori</b>' +
        '<p style="margin:6px 0 0;color:#374151;background:#F5F2EE;border-radius:4px;padding:6px 8px">Page : <b>' + h(pname) + '</b></p>' +
        st('Vérifiez les filtres') +
        (lst.length || cks.length ? '<ul style="margin:0 0 4px;padding-left:18px">' + lst.map(function (x) { return '<li>' + h(x.d) + ' : <b>' + h(x.v) + '</b></li>'; }).join('') +
            cks.map(function (c) { return '<li>' + (c.checked ? '&#9745; ' : '&#9744; ') + h(c.label) + '</li>'; }).join('') + '</ul>'
          : '<p style="margin:0 0 4px;color:#374151">Aucun filtre : le favori ouvrira la page sans filtre. Pour en ajouter, fermez cette fenêtre, réglez les filtres de la page, puis relancez l\'assistant.</p>') +
        (warn.length ? '<p style="margin:4px 0;background:#FFF4D6;border-radius:4px;padding:6px 8px;font-size:12px">Non repris (valeurs exclues) : ' + h(warn.join(', ')) + '.</p>' : '') +
        (dates.length ? st('Choisissez la période') + dates.map(function (d, i) {
          return '<div data-ld="pbox" data-i="' + i + '"><label style="display:block;font-size:12px;color:#374151">' + h(d.nom) + ' : ' + d.mois.length + ' mois disponible' + (d.mois.length > 1 ? 's' : '') + '</label>' +
            '<select data-ld="per" style="' + SEL + '">' + perOpts(d).map(function (o) { return '<option value="' + o[0] + '">' + h(o[1]) + '</option>'; }).join('') + '</select>' +
            '<select data-ld="m1" style="' + SEL + 'display:none">' + d.mois.map(function (m) { return '<option value="' + m.k + '">' + h(m.l) + '</option>'; }).join('') + '</select></div>';
        }).join('') : '') +
        st('Vérifiez le nom du favori') +
        '<input data-ld="name" type="text" value="" style="width:100%;box-sizing:border-box;font:inherit;padding:7px 8px;border:1px solid #D1D5DB;border-radius:4px;margin:0 0 4px">' +
        st('Créez le favori') +
        '<button type="button" data-ld="make" style="' + B + 'background:#293378;color:#fff;border:1px solid #293378">Créer le favori</button>' +
        '<div data-ld="out" style="margin-top:10px"></div>');
      var nameIn = b.querySelector('[data-ld="name"]'), edited = false;
      nameIn.oninput = function () { edited = true; };
      function pers() {
        return Array.prototype.map.call(b.querySelectorAll('[data-ld="pbox"]'), function (bx) {
          var d = dates[+bx.getAttribute('data-i')], m = bx.querySelector('[data-ld="per"]').value, p = { dim: d.dim, mode: m };
          if (m === 'mois') p.key = +bx.querySelector('[data-ld="m1"]').value;
          p.lab = m === 'fixe' ? d.texte : m === 'dernier' ? 'Dernier mois' : m === 'dernierN1' ? 'Même mois N-1' : mlab(p.key);
          return p;
        });
      }
      function defName() {
        if (edited) return;
        var P = pers(), pl = P.filter(function (p) { return p.mode !== 'fixe'; }).map(function (p) { return p.lab; });
        var vs = lst.filter(function (x) { return !(x.date && pl.length); }).map(function (x) { return x.v; });
        nameIn.value = ((pl.length ? pl.join(', ') + ' - ' : '') + pname + (vs.length ? ' - ' + vs.join(' - ') : '')).slice(0, 90);
      }
      Array.prototype.forEach.call(b.querySelectorAll('[data-ld="pbox"]'), function (bx) {
        var s0 = bx.querySelector('[data-ld="per"]'), s1 = bx.querySelector('[data-ld="m1"]');
        s0.onchange = function () { s1.style.display = s0.value === 'mois' ? 'block' : 'none'; defName(); };
        s1.onchange = defName;
      });
      defName();
      b.querySelector('[data-ld="make"]').onclick = function () {
        var name = nameIn.value.trim() || pname, z = b.querySelector('[data-ld="out"]'), P = pers();
        /* lien classique si rien à recalculer ; sinon favori qui applique la période et les cases dans le tableau de bord */
        var simple = !cks.length && !P.some(function (p) { return p.mode !== 'fixe'; });
        var href = simple ? url : 'javascript:' + encodeURIComponent('(' + opt.pageSrc + ')(' + JSON.stringify({ name: name, url: url, pageId: pg.id, pageUid: pg.getAttribute('uid'), filters: keep, cases: cks.map(function (c) { return { label: c.label, checked: c.checked }; }), periodes: P }) + ');');
        z.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-weight:bold"><span style="flex:none;width:22px;height:22px;border-radius:50%;background:#1B7F3B;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px">' + (k + 1) + '</span>Rangez-le dans vos favoris</div>' +
          '<p style="margin:0 0 8px">Cliquez sur le bouton bleu, gardez le clic enfoncé et <b>faites-le glisser tout en haut de la fenêtre</b>, dans la barre de favoris, puis relâchez.</p>' +
          '<div style="text-align:center"><a data-ld="bm" href="' + h(href) + '" draggable="true" title="Faites-moi glisser vers la barre de favoris" style="display:inline-block;background:#406BDE;color:#fff;font-weight:bold;text-decoration:none;padding:9px 14px;border-radius:4px;box-shadow:0 0 0 4px rgba(64,107,222,.3);cursor:grab">🔵 ' + h(name) + '</a></div>' +
          (simple ? '<div style="display:flex;gap:8px;justify-content:center;margin-top:8px"><button type="button" data-ld="cp" style="' + B + 'background:#fff;color:#293378;border:1px solid #293378;padding:4px 10px">Copier le lien</button><a href="' + h(url) + '" target="_blank" rel="noopener" style="' + B + 'background:#fff;color:#293378;border:1px solid #293378;padding:4px 10px;text-decoration:none">Tester</a></div>' +
              '<p style="margin:8px 0 0;color:#6B7280;font-size:12px">C\'est un lien classique : <b>un seul clic</b> ouvre la page filtrée, même depuis un nouvel onglet. Il peut aussi être envoyé par mail ou Teams. Barre de favoris invisible ? Ctrl+Maj+B.</p>'
            : '<p style="margin:8px 0 0;color:#6B7280;font-size:12px">Ce favori recalcule la période et remet les cases de la page à chaque clic. Depuis le tableau de bord, <b>un clic</b> suffit ; s\'il n\'est pas ouvert, il s\'ouvre : cliquez alors une seconde fois sur le favori. Barre de favoris invisible ? Ctrl+Maj+B.</p>');
        z.querySelector('[data-ld="bm"]').onclick = function (ev) { ev.preventDefault(); };
        var cp = z.querySelector('[data-ld="cp"]');
        if (cp) cp.onclick = function () {
          function done(ok) { cp.textContent = ok ? 'Lien copié' : 'Copie impossible'; }
          try { navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); }); } catch (x) { done(false); }
        };
      };
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
    function fdims() { var r = []; Array.prototype.forEach.call(D.querySelectorAll('span[id^="dimName"][id$="false"],span[id^="dimName"][id$="true"]'), function (e) { var k = e.id.replace(/^dimName/, '').replace(/(false|true)$/, ''); if (r.indexOf(k) < 0) r.push(k); }); return r; }
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
        return '<div data-ld="perbox" data-i="' + i + '" style="margin-bottom:10px"><label style="display:block;font-size:12px;color:#374151">Période (' + esc(d.nom) + ') : ' + d.mois.length + ' mois disponible' + (d.mois.length > 1 ? 's' : '') + '</label>' +
          '<select data-ld="per" style="width:100%;' + sel + 'margin:4px 0">' +
          [['fixe', 'Période capturée : ' + d.texte], ['dernier', 'Dernier mois disponible'], ['dernierN1', 'Même mois, année précédente'], ['12m', '12 derniers mois (cumul)'], ['12mN1', '13e au 24e mois (cumul)'], ['mois', 'Un mois au choix'], ['plage', 'Une période au choix']]
            .filter(function (o) { var S = {}, n = 0, L = -1e9; (d.mois || []).forEach(function (m) { if (!S[m.k]) { S[m.k] = 1; n++; } if (m.k > L) L = m.k; }); function all(a, z) { for (var k = a; k <= z; k++) if (!S[k]) return false; return true; } return o[0] === 'fixe' || (n > 0 && ({ dernier: true, dernierN1: !!S[L - 12], '12m': all(L - 11, L), '12mN1': all(L - 23, L - 12), mois: n > 1, plage: n > 1 })[o[0]]); }).map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
          '<div data-ld="permois" style="display:none"><select data-ld="m1" style="width:100%;' + sel + '">' + opts + '</select></div>' +
          '<div data-ld="perplage" style="display:none;gap:6px"><select data-ld="pdeb" style="flex:1;' + sel + '" title="Début">' + opts + '</select><select data-ld="pfin" style="flex:1;' + sel + '" title="Fin">' + opts + '</select></div></div>';
      }).join('') +
      stp('Vérifiez le nom du favori') +
      '<input data-ld="name" type="text" value="' + esc(out.dimensions.join(' x ').slice(0, 60)) + '" style="width:100%;box-sizing:border-box;font:inherit;padding:7px 8px;border:1px solid #D1D5DB;border-radius:4px;margin:0 0 4px">' +
      '<label style="display:flex;gap:6px;align-items:flex-start;margin:8px 0 0;font-size:12px"><input type="checkbox" data-ld="xls" style="margin-top:2px"> <span><b>Export Excel automatique</b> : le fichier Excel du tableau se télécharge à chaque ouverture du favori. <button type="button" data-ld="xlstest" style="' + btn + 'background:#fff;color:#293378;border:1px solid #293378;padding:2px 8px;font-size:12px">Tester maintenant</button></span></label>' +
      stp('Créez le favori') +
      '<button type="button" data-ld="make" style="' + btn + 'background:#293378;color:#fff;border:1px solid #293378">Créer le favori</button> ' +
      '<div data-ld="out" style="margin-top:10px"></div>');
    var zone = b.querySelector('[data-ld="out"]');
    b.querySelector('[data-ld="xlstest"]').onclick = function (ev) {
      ev.preventDefault();
      try { (new Function('(' + opt.applySrc + ')(' + JSON.stringify({ name: 'Test', excelOnly: true, pageId: out.pageId }) + ');'))(); } catch (x) { /* ignore */ }
    };
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
      var q = new URLSearchParams(location.search), u = location.origin + location.pathname + '?defaultPage=' + encodeURIComponent(out.pageId);
      ['domain', 'user', 'pass'].forEach(function (k) { if (q.get(k)) u += '&' + k + '=' + encodeURIComponent(q.get(k)); });
      var V = { name: name, url: opt.home ? opt.home.replace('?', '?defaultPage=' + encodeURIComponent(out.pageId) + '&') : u, pageId: out.pageId, pageUid: out.pageUid, tfiltres: out.tfiltres, periodes: periodes(), excel: b.querySelector('[data-ld="xls"]').checked, used: out.dimensions.concat(out.mesures), vue: out.vue };
      var href = 'javascript:' + encodeURIComponent('(' + opt.applySrc + ')(' + JSON.stringify(V) + ');');
      zone.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-weight:bold"><span style="flex:none;width:22px;height:22px;border-radius:50%;background:#1B7F3B;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px">' + (nstep + 1) + '</span>Rangez-le dans vos favoris</div>' +
        '<p style="margin:0 0 8px">Cliquez sur le bouton jaune, gardez le clic enfoncé et <b>faites-le glisser tout en haut de la fenêtre</b>, dans la barre de favoris, puis relâchez.</p>' +
        '<div style="text-align:center"><a href="' + esc(href) + '" draggable="true" title="Faites-moi glisser vers la barre de favoris" style="display:inline-block;background:#FFCC52;color:#0D1440;font-weight:bold;text-decoration:none;padding:9px 14px;border-radius:4px;box-shadow:0 0 0 4px rgba(255,204,82,.35);cursor:grab">🟡 ' + esc(name) + '</a></div>' +
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
    function goDD(url, name) {
      var D = document, inDD = /digdash_dashboard/.test(location.pathname);
      var o = D.getElementById('ldGo'); if (o) o.remove();
      o = D.createElement('div'); o.id = 'ldGo';
      o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(13,20,64,.45);display:flex;align-items:center;justify-content:center;font:14px Arial,sans-serif';
      o.innerHTML = '<div style="background:#fff;color:#0D1440;max-width:420px;width:calc(100% - 32px);border-top:5px solid #FFCC52;border-radius:10px;padding:20px;box-shadow:0 8px 28px rgba(0,0,0,.3);line-height:1.5">' +
        '<div style="font-weight:bold;font-size:16px;margin-bottom:8px">' + (inDD ? 'Tableau de bord en cours de chargement' : 'Ouverture du tableau de bord RPE') + '</div>' +
        (inDD ? '<p style="margin:0 0 14px">Attendez la fin du chargement, puis <b>cliquez de nouveau sur le favori</b> <b style="background:#FFCC52;padding:1px 6px;border-radius:3px">' + String(name).replace(/[&<>"]/g, '') + '</b> pour appliquer vos paramètres.</p>'
          : '<p style="margin:0 0 6px">Le tableau de bord s\'ouvre dans <b data-n="1">3</b> s.</p><ol style="margin:0 0 14px;padding-left:20px"><li>Une fois la page chargée, <b>cliquez de nouveau sur le favori</b> <b style="background:#FFCC52;padding:1px 6px;border-radius:3px">' + String(name).replace(/[&<>"]/g, '') + '</b> pour appliquer vos paramètres.</li></ol>') +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' + (inDD ? '' : '<button data-x="1" style="font:inherit;font-weight:bold;padding:8px 12px;border-radius:4px;border:1px solid #293378;background:#fff;color:#293378;cursor:pointer">Annuler</button>') +
        '<button data-ok="1" style="font:inherit;font-weight:bold;padding:8px 12px;border-radius:4px;border:1px solid #293378;background:#293378;color:#fff;cursor:pointer">' + (inDD ? 'Compris' : 'Ouvrir maintenant') + '</button></div></div>';
      (D.body || D.documentElement).appendChild(o);
      var n = 3, tm = inDD ? null : setInterval(function () { n--; var c = o.querySelector('[data-n]'); if (c) c.textContent = n; if (n <= 0) { clearInterval(tm); location.href = url; } }, 1000);
      o.querySelector('[data-ok]').onclick = function () { clearInterval(tm); o.remove(); if (!inDD) location.href = url; };
      var x = o.querySelector('[data-x]'); if (x) x.onclick = function () { clearInterval(tm); o.remove(); };
    }
    if (!W.ddCtrl && opt.home) { goDD(opt.home, '🧭 Assistant TdB RPE'); return; }
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
      g.innerHTML = '<div data-g="bar" style="display:flex;align-items:center;gap:8px;padding:12px 14px 6px;user-select:none"><b style="flex:1;font-size:15px">Assistant TdB RPE <span style="font-weight:normal;font-size:11px;color:#6B7280">&#10021; déplaçable</span></b>' +
        '<button type="button" data-g="min" title="Réduire le temps de construire votre tableau" style=""border:0;background:none;font-size:18px;cursor:pointer;color:#6B7280">&minus;</button>' +
        '<button type="button" data-g="close" title="Fermer" style="border:0;background:none;font-size:20px;cursor:pointer;color:#6B7280">&times;</button></div>' +
        '<div style="display:flex;gap:4px;padding:0 14px">' + dots + '</div>' +
        '<div style="padding:10px 14px 14px"><div style="font-size:12px;color:#6B7280">Étape ' + n + ' sur 3</div><b style="display:block;font-size:14px;margin:2px 0 8px">' + title + '</b>' + body + '</div>';
      mover(g, g.querySelector('[data-g="bar"]'));
      g.querySelector('[data-g="close"]').onclick = function () { clearInterval(timer); unhi(); var pl = D.getElementById('ldPill'); if (pl) pl.remove(); g.remove(); };
      g.querySelector('[data-g="min"]').onclick = function () { reduce(g, unhi); };
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
        var pgEl = Array.prototype.filter.call(D.querySelectorAll('.dashboard_page[role="main"][uid]'), vis)[0];
        var pn = pgEl ? (live().names[pgEl.id] || pgEl.id.replace(/_/g, ' ')) : '';
        var tbl = LV.tables.map(function (pg, i) { return '<button type="button" data-g="go" data-i="' + i + '" style="display:block;width:100%;text-align:left;font:inherit;padding:8px 10px;margin:0 0 6px;border:1px solid #D1D5DB;border-radius:6px;background:#fff;cursor:pointer">' + esc(pg.name) + '</button>'; }).join('');
        frame(1, tb ? 'Tableau personnalisé détecté' : 'Créer un favori de cette page',
          (tb ? '<p style="margin:0 0 8px;background:#E2E8FB;border-radius:4px;padding:6px 8px">Vous êtes sur un <b>tableau personnalisé</b>' + (pn ? ' (' + esc(pn) + ')' : '') + '. L\'assistant va vous aider à le mettre en forme, puis à l\'enregistrer avec ses filtres et, si vous le souhaitez, un export Excel automatique.</p>' +
              '<button type="button" data-g="here" style="' + B1 + 'display:block;width:100%">Mettre en forme ce tableau</button>'
            : '<p style="margin:0 0 8px;background:#E2E8FB;border-radius:4px;padding:6px 8px">Page affichée : <b>' + esc(pn || 'page du tableau de bord') + '</b></p>' +
              '<button type="button" data-g="page" style="' + B1 + 'display:block;width:100%;margin-bottom:12px">Créer un lien vers cette page avec ses filtres</button>') +
          (tb ? '' : '<p style="margin:0;color:#6B7280;font-size:12px">Pour un tableau personnalisé : ouvrez-le dans le tableau de bord, puis cliquez de nouveau sur 🧭 Assistant TdB RPE.</p>'));
        Array.prototype.forEach.call(g.querySelectorAll('[data-g="go"]'), function (bt) {
          bt.onclick = function () {
            var pg = LV.tables[+bt.getAttribute('data-i')];
            try { W.ddCtrl.changePage(pg.uid); } catch (e) { /* ignore */ }
            g.querySelector('div[style*="padding:10px"]').innerHTML = '<p>Ouverture du tableau <b>' + esc(pg.name) + '</b>...</p>';
            var t0 = Date.now();
            timer = setInterval(function () {
              var t = toolbar(), pe = t && t.closest('.dashboard_page[role="main"]');
              if (t && pe && (!pg.uid || pe.getAttribute('uid') === String(pg.uid))) { clearInterval(timer); show(2); }
              else if (Date.now() - t0 > 30000) { clearInterval(timer); show(1); }
            }, 500);
          };
        });
        var here = g.querySelector('[data-g="here"]'); if (here) here.onclick = function () { show(2); };
        var pgb = g.querySelector('[data-g="page"]'); if (pgb) pgb.onclick = function () { show('p'); };
      } else if (n === 'p') {
        frame(2, 'Réglez les filtres de la page',
          '<p style="margin:0 0 8px">Choisissez dans le <b>volet de filtres</b> de la page le territoire, la période et les autres filtres voulus. Attendez que la page se mette à jour.</p>' +
          '<p style="margin:0 0 10px;background:#FFF4D6;border-radius:4px;padding:6px 8px;font-size:12px">Le favori sera un <b>lien classique</b> : un seul clic ouvrira la page avec ces filtres, même depuis un nouvel onglet.</p>' +
          '<div style="display:flex;gap:8px;justify-content:space-between"><button type="button" data-g="back" style="' + B2 + '">Retour</button><button type="button" data-g="cap" style="' + B1 + '">Mes filtres sont prêts</button></div>');
        g.querySelector('[data-g="back"]').onclick = function () { show(1); };
        g.querySelector('[data-g="cap"]').onclick = function () { unhi(); g.remove(); run('page'); };
      } else if (n === 2) {
        if (!tb) { show(1); return; }
        var st = 'display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px dashed #E5E7EB';
        var num = function (k) { return '<span style="flex:none;width:20px;height:20px;border-radius:50%;background:#E3E5F1;color:#293378;font-weight:bold;font-size:11px;display:inline-flex;align-items:center;justify-content:center">' + k + '</span>'; };
        var show2 = function (k) { return ' <button type="button" data-g="show" data-k="' + k + '" style="' + B2 + 'padding:2px 8px;font-size:12px">Me montrer</button>'; };
        frame(2, 'Mettez le tableau en forme',
          '<p style="margin:0 0 6px;background:#FFF4D6;border-radius:4px;padding:6px 8px;font-size:12px">La fenêtre gêne ? Déplacez-la par sa barre de titre, ou réduisez-la avec <b>&minus;</b> le temps de construire votre tableau : un bouton <b>🧭 Assistant TdB RPE : reprendre</b> la rouvrira.</p>' +
          '<div style="' + st + '">' + num(1) + '<div><b>Lignes et colonnes</b> : dans la liste <b>Dimensions</b>, à gauche, faites glisser une dimension sur l\'en-tête du tableau.' + show2('dim') + '</div></div>' +
          '<div style="' + st + '">' + num(2) + '<div><b>Chiffres</b> : sous <b>Mesures</b>, faites glisser la mesure voulue dans le tableau.' + show2('mes') + '</div></div>' +
          '<div style="' + st + '">' + num(3) + '<div><b>Filtres</b> : cliquez sur l\'<b>entonnoir</b>, puis <b>Ajouter un filtre</b> (territoire, sexe, date...) et validez par <b>OK</b>.' + show2('fil') + '</div></div>' +
          '<div style="' + st + ';border-bottom:0">' + num(4) + '<div>Le résultat s\'affiche dans le <b>tableau</b>. Vérifiez qu\'il vous convient.' + show2('tab') + '</div></div>' +
          '<p style="margin:8px 0;background:#FFF4D6;border-radius:4px;padding:6px 8px;font-size:12px">Une erreur ? Appuyez sur F5 pour revenir au tableau d\'origine, puis relancez l\'assistant.</p>' +
          '<div style="display:flex;gap:8px;justify-content:space-between"><button type="button" data-g="back" style="' + B2 + '">Retour</button><button type="button" data-g="next" style="' + B1 + '">Mon tableau est prêt</button></div>');
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
          '<p style="margin:0 0 10px">Une fenêtre va s\'ouvrir en bas à droite. Vous y choisirez la <b>période</b> (si le tableau contient une date), vérifierez le <b>nom</b>, pourrez cocher l\'<b>export Excel automatique</b>, puis rangerez le <b>bouton jaune</b> dans votre barre de favoris.</p>' +
          '<div style="display:flex;gap:8px;justify-content:space-between"><button type="button" data-g="back" style="' + B2 + '">Retour</button><button type="button" data-g="cap" style="' + B1 + '">Capturer maintenant</button></div>');
        g.querySelector('[data-g="back"]').onclick = function () { show(2); };
        g.querySelector('[data-g="cap"]').onclick = function () { unhi(); g.remove(); run(); };
      }
    }
    show(1);
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
    function goDD(url, name) {
      var D = document, inDD = /digdash_dashboard/.test(location.pathname);
      var o = D.getElementById('ldGo'); if (o) o.remove();
      o = D.createElement('div'); o.id = 'ldGo';
      o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(13,20,64,.45);display:flex;align-items:center;justify-content:center;font:14px Arial,sans-serif';
      o.innerHTML = '<div style="background:#fff;color:#0D1440;max-width:420px;width:calc(100% - 32px);border-top:5px solid #FFCC52;border-radius:10px;padding:20px;box-shadow:0 8px 28px rgba(0,0,0,.3);line-height:1.5">' +
        '<div style="font-weight:bold;font-size:16px;margin-bottom:8px">' + (inDD ? 'Tableau de bord en cours de chargement' : 'Ouverture du tableau de bord RPE') + '</div>' +
        (inDD ? '<p style="margin:0 0 14px">Attendez la fin du chargement, puis <b>cliquez de nouveau sur le favori</b> <b style="background:#FFCC52;padding:1px 6px;border-radius:3px">' + String(name).replace(/[&<>"]/g, '') + '</b> pour appliquer vos paramètres.</p>'
          : '<p style="margin:0 0 6px">Le tableau de bord s\'ouvre dans <b data-n="1">3</b> s.</p><ol style="margin:0 0 14px;padding-left:20px"><li>Une fois la page chargée, <b>cliquez de nouveau sur le favori</b> <b style="background:#FFCC52;padding:1px 6px;border-radius:3px">' + String(name).replace(/[&<>"]/g, '') + '</b> pour appliquer vos paramètres.</li></ol>') +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' + (inDD ? '' : '<button data-x="1" style="font:inherit;font-weight:bold;padding:8px 12px;border-radius:4px;border:1px solid #293378;background:#fff;color:#293378;cursor:pointer">Annuler</button>') +
        '<button data-ok="1" style="font:inherit;font-weight:bold;padding:8px 12px;border-radius:4px;border:1px solid #293378;background:#293378;color:#fff;cursor:pointer">' + (inDD ? 'Compris' : 'Ouvrir maintenant') + '</button></div></div>';
      (D.body || D.documentElement).appendChild(o);
      var n = 3, tm = inDD ? null : setInterval(function () { n--; var c = o.querySelector('[data-n]'); if (c) c.textContent = n; if (n <= 0) { clearInterval(tm); location.href = url; } }, 1000);
      o.querySelector('[data-ok]').onclick = function () { clearInterval(tm); o.remove(); if (!inDD) location.href = url; };
      var x = o.querySelector('[data-x]'); if (x) x.onclick = function () { clearInterval(tm); o.remove(); };
    }
    if (!W.ddCtrl && V.url) { goDD(V.url, '🟡 ' + V.name); return; }
    if (!W.ddCtrl || !W.AxisEditor) { toast('Ouvrez d\'abord le tableau de bord RPE, puis relancez la présentation.', false); return; }
    function toolbar() {
      return Array.prototype.filter.call(D.querySelectorAll('.editToolbar'), function (tb) {
        if (!vis(tb)) return false;
        var pg = tb.closest('.dashboard_page[role="main"]');
        return !V.pageId || (pg && pg.id === V.pageId);
      })[0];
    }
    /* export Excel : bouton ou entrée de menu du portlet dont le titre, la classe ou le texte évoque Excel */
    async function excel(t) {
      var fr = t ? D.getElementById(t.id.replace(/_editToolbar$/, '')) : null, zones = [], e = fr;
      if (t) zones.push(t);
      for (var i = 0; i < 5 && e; i++) { zones.push(e); e = e.parentElement; }
      function mine(x) { return !!x.closest('#ldVuePanel,#ldGuide,#ldVueToast,#ldGo'); }
      function txt(x) { var c = typeof x.className === 'string' ? x.className : ''; return ((x.getAttribute('title') || '') + ' ' + (x.getAttribute('alt') || '') + ' ' + (x.getAttribute('aria-label') || '') + ' ' + c + ' ' + (x.children.length ? '' : x.textContent)).toLowerCase(); }
      function find(roots, re) {
        for (var r = 0; r < roots.length; r++) {
          var l = roots[r].querySelectorAll('*');
          for (var j = 0; j < l.length; j++) if (vis(l[j]) && !mine(l[j]) && re.test(txt(l[j]))) return l[j];
        }
        return null;
      }
      function click(x) { ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(function (n) { x.dispatchEvent(new MouseEvent(n, { bubbles: true, cancelable: true, view: W })); }); }
      /* menu du portlet (roue dentée toolBarMenu_<portlet>) puis "Sauvegarder en Excel Standard" */
      function xlsItem() {
        var it = Array.prototype.filter.call(D.querySelectorAll('.dd-popup-panel .save-as-xls-icon'), function (i) { var pp = i.closest('.dd-popup-panel'); return pp && pp.style.visibility !== 'hidden' && pp.style.display !== 'none'; });
        var std = it.filter(function (i) { return /standard/i.test(i.textContent); });
        var x = (std[0] || it[0]);
        return x ? (x.closest('.dd-menu-item') || x) : null;
      }
      if (fr) {
        var pid = fr.id.replace(/^frame_/, ''), mb = D.getElementById('toolBarMenu_' + pid);
        if (!mb) { var best = ''; Array.prototype.forEach.call(D.querySelectorAll('[id^="toolBarMenu_"]'), function (m) { var k = m.id.slice(12); if (pid.indexOf(k) === 0 && k.length > best.length) { best = k; mb = m; } }); }
        if (mb) {
          click(mb);
          for (var w = 0; w < 10 && !xlsItem(); w++) await sleep(200);
          var it = xlsItem();
          if (it) { click(it); toast('Export Excel lancé : le fichier va se télécharger.', true); return true; }
          D.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }
      }
      var x = find(zones, /excel|\bxlsx?\b/);
      if (!x) { var m = find(zones, /export/); if (m) { click(m); await sleep(800); x = find([D.body], /excel|\bxlsx?\b/); } }
      if (!x) { toast('Export Excel introuvable sur ce tableau : utilisez le menu d\'export du tableau.', false); return false; }
      click(x);
      toast('Export Excel lancé : le fichier va se télécharger.', true);
      return true;
    }
    /* le tableau de bord a changé depuis la capture : on invite à refaire le favori */
    function modified(det) {
      var o = D.getElementById('ldMod'); if (o) o.remove();
      var t = D.getElementById('ldVueToast'); if (t) t.remove();
      o = D.createElement('div'); o.id = 'ldMod';
      o.style.cssText = 'position:fixed;z-index:999999;right:16px;bottom:16px;width:380px;max-width:calc(100vw - 32px);background:#fff;color:#0D1440;border:1px solid #E5E7EB;border-top:5px solid #D92424;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.28);font:13px Arial,sans-serif;line-height:1.5;padding:14px 16px';
      var h = function (x) { return String(x).replace(/[&<>"]/g, ''); };
      o.innerHTML = '<b style="display:block;font-size:15px;margin-bottom:6px">La page a été modifiée depuis la capture</b>' +
        '<p style="margin:0 0 8px">Le tableau de bord a changé depuis la création du favori <b>🟡 ' + h(V.name) + '</b> : vos paramètres ne peuvent pas être pris en compte correctement.</p>' +
        '<p style="margin:0 0 8px"><b>Refaites une capture</b> : cliquez sur le favori <b>🧭 Assistant TdB RPE</b>, recréez le favori, puis supprimez l\'ancien (clic droit sur le favori, puis Supprimer).</p>' +
        (det && det.length ? '<p style="margin:0 0 10px;color:#6B7280;font-size:12px">Détail : ' + h(det.join(' | ')) + '</p>' : '') +
        '<div style="text-align:right"><button type="button" style="font:inherit;font-weight:bold;padding:7px 12px;border-radius:4px;border:1px solid #293378;background:#293378;color:#fff;cursor:pointer">Compris</button></div>';
      D.body.appendChild(o);
      o.querySelector('button').onclick = function () { o.remove(); };
    }
    var tb = toolbar();
    if (V.excelOnly) { await excel(tb); return; }
    if (!tb && V.pageId && !D.getElementById(V.pageId)) { modified(['page introuvable dans le tableau de bord']); return; }
    if (!tb && V.pageUid) {
      toast('Ouverture de la page...');
      try { W.ddCtrl.changePage(V.pageUid); } catch (e) { /* ignore */ }
      var t0 = Date.now();
      while (!tb && Date.now() - t0 < 30000) { await sleep(400); tb = toolbar(); }
    }
    if (!tb) { modified(['tableau personnalisé introuvable']); return; }
    toast('Application de la présentation "' + V.name + '"...');
    var fid = tb.id.replace(/_editToolbar$/, ''), frame = D.getElementById(fid), src = tb.querySelector('.editTool.drag');
    var t1 = Date.now();
    while (!frame.querySelector('table.table') && Date.now() - t1 < 20000) await sleep(300);
    if (V.used && V.used.length) {
      var catal = Array.prototype.map.call(tb.querySelectorAll('.editToolIconDim,.editToolIconMeasure'), function (x) { return x.getAttribute('title'); });
      var miss = V.used.filter(function (x) { return catal.indexOf(x) < 0; });
      if (miss.length) { modified(['absent du tableau : ' + miss.join(', ')]); return; }
    }
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
    function fdims() { var r = []; Array.prototype.forEach.call(D.querySelectorAll('span[id^="dimName"][id$="false"],span[id^="dimName"][id$="true"]'), function (e) { var k = e.id.replace(/^dimName/, '').replace(/(false|true)$/, ''); if (r.indexOf(k) < 0) r.push(k); }); return r; }
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
    try { ed.applyViewJSON(V.vue); } catch (e) { modified(['mise en forme refusée : ' + (e && e.message || e)]); return; }
    await sleep(1500);
    /* 1. filtres du tableau de bord (lien) : remis seulement s'ils ont été effacés */
    var dashOk = true, ko = [], chg = [];
    if (fsig(fsnap().map(fplain)) !== fsig(before.map(fplain))) { dashOk = await frestore(before); if (!dashOk) ko.push('filtres du lien'); }
    /* 2. filtres du tableau : ceux en place sont prioritaires, ceux de la capture complètent les autres dimensions */
    var dm = ed.chart.dmsel, list = tBefore.slice(), have = {};
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
      if (!target) { chg.push('date ' + pr.dim + ' absente'); return; }
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
    (V.tfiltres || []).forEach(function (j) { if (have[j.dim] || pdims[j.dim]) return; var f = tfFromJSON(dm, j); if (f) { list.push(f); have[j.dim] = 1; } else (tfDim(dm, j.dim) ? ko : chg).push('filtre ' + j.dim + (tfDim(dm, j.dim) ? ' : valeurs introuvables' : ' absent')); });
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
          if (!done) (err === 'dimension absente de ce tableau' ? chg : ko).push((f.dim && (f.dim.name || f.dim.id)) + ' : ' + (err && err.message || err));
        });
        var ex = dm.dimensionsToExcludeForNavigation || (dm.dimensionsToExcludeForNavigation = {});
        Object.keys(tExcl).forEach(function (k) { ex[k] = tExcl[k]; });
        Object.keys(have).forEach(function (k) { ex[k] = true; });
        try { ed.refreshDM(); } catch (e1) { try { ed.onDimFilterChange(); } catch (e2) { tabOk = false; ko.push('rafraîchissement : ' + (e2 && e2.message || e2)); } }
      } catch (e) { tabOk = false; ko.push('filtres du tableau : ' + (e && e.message || e)); }
    }
    await sleep(800);
    var txt = tfText(ed);
    if (chg.length) { modified(chg); return; }
    var ok = dashOk && tabOk && !ko.length;
    toast('Présentation "' + V.name + '" appliquée' + (txt.length ? '. Filtres : ' + txt.join(' | ') : '') + (ok ? '.' : '. Attention : certains filtres n\'ont pas pu être remis' + (ko.length ? ' (' + ko.join(', ') + ')' : '') + '.'), ok);
    if (V.excel) { await sleep(2500); await excel(toolbar()); }
  })();
};

/* Favori de page (période recalculée et cases de la page) : remet la page, ses cases et ses filtres dans le tableau de bord */
var LD_PAGE_APPLY = function (P) {
  (async function () {
    var D = document, W = window;
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function vis(e) { return !!(e && (e.offsetWidth || e.offsetHeight)); }
    function h(x) { return String(x).replace(/[&<>"]/g, ''); }
    function toast(msg, ok) {
      var t = D.getElementById('ldVueToast') || D.createElement('div');
      t.id = 'ldVueToast';
      t.style.cssText = 'position:fixed;z-index:999999;right:16px;bottom:16px;max-width:360px;padding:12px 16px;border-radius:8px;font:13px Arial,sans-serif;color:#fff;box-shadow:0 4px 10px rgba(0,0,0,.3);background:' + (ok === false ? '#D92424' : '#0D1440');
      t.textContent = msg;
      (D.body || D.documentElement).appendChild(t);
      if (ok !== undefined) setTimeout(function () { t.remove(); }, 5000);
    }
    var nm = '🔵 ' + P.name;
    if (!W.ddCtrl) {
      var inDD = /digdash_dashboard/.test(location.pathname), o = D.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(13,20,64,.45);display:flex;align-items:center;justify-content:center;font:14px Arial,sans-serif';
      o.innerHTML = '<div style="background:#fff;color:#0D1440;max-width:420px;width:calc(100% - 32px);border-top:5px solid #406BDE;border-radius:10px;padding:20px;box-shadow:0 8px 28px rgba(0,0,0,.3);line-height:1.5">' +
        '<div style="font-weight:bold;font-size:16px;margin-bottom:8px">' + (inDD ? 'Tableau de bord en cours de chargement' : 'Ouverture du tableau de bord RPE') + '</div>' +
        (inDD ? '' : '<p style="margin:0 0 6px">Le tableau de bord s\'ouvre dans <b data-n="1">3</b> s.</p>') +
        '<p style="margin:0 0 14px">Une fois la page chargée, <b>cliquez de nouveau sur le favori</b> <b style="background:#406BDE;color:#fff;padding:1px 6px;border-radius:3px">' + h(nm) + '</b> pour appliquer vos paramètres.</p>' +
        '<div style="text-align:right"><button type="button" style="font:inherit;font-weight:bold;padding:8px 12px;border-radius:4px;border:1px solid #293378;background:#293378;color:#fff;cursor:pointer">' + (inDD ? 'Compris' : 'Ouvrir maintenant') + '</button></div></div>';
      (D.body || D.documentElement).appendChild(o);
      var n = 3, tm = inDD ? null : setInterval(function () { n--; var c = o.querySelector('[data-n]'); if (c) c.textContent = n; if (n <= 0) { clearInterval(tm); location.href = P.url; } }, 1000);
      o.querySelector('button').onclick = function () { clearInterval(tm); o.remove(); if (!inDD) location.href = P.url; };
      return;
    }
    function modified(det) {
      var o = D.createElement('div');
      o.style.cssText = 'position:fixed;z-index:999999;right:16px;bottom:16px;width:380px;max-width:calc(100vw - 32px);background:#fff;color:#0D1440;border:1px solid #E5E7EB;border-top:5px solid #D92424;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.28);font:13px Arial,sans-serif;line-height:1.5;padding:14px 16px';
      o.innerHTML = '<b style="display:block;font-size:15px;margin-bottom:6px">La page a été modifiée depuis la capture</b>' +
        '<p style="margin:0 0 8px">Le tableau de bord a changé depuis la création du favori <b>' + h(nm) + '</b> : vos paramètres ne peuvent pas être pris en compte correctement.</p>' +
        '<p style="margin:0 0 8px"><b>Refaites une capture</b> : cliquez sur le favori <b>🧭 Assistant TdB RPE</b>, recréez le favori, puis supprimez l\'ancien (clic droit sur le favori, puis Supprimer).</p>' +
        '<p style="margin:0 0 10px;color:#6B7280;font-size:12px">Détail : ' + h(det.join(' | ')) + '</p>' +
        '<div style="text-align:right"><button type="button" style="font:inherit;font-weight:bold;padding:7px 12px;border-radius:4px;border:1px solid #293378;background:#293378;color:#fff;cursor:pointer">Compris</button></div>';
      var t = D.getElementById('ldVueToast'); if (t) t.remove();
      D.body.appendChild(o);
      o.querySelector('button').onclick = function () { o.remove(); };
    }
    var pg = D.getElementById(P.pageId);
    if (!pg) { modified(['page introuvable dans le tableau de bord']); return; }
    if (!vis(pg)) {
      toast('Ouverture de la page...');
      try { W.ddCtrl.changePage(P.pageUid); } catch (e) { /* ignore */ }
      var t0 = Date.now();
      while (!vis(pg) && Date.now() - t0 < 30000) await sleep(400);
      await sleep(1500);
    }
    toast('Application du favori "' + P.name + '"...');
    var chg = [], txt = [];
    function sx(d) { return D.getElementById('dimName' + d + 'false') ? 'false' : 'true'; }
    function has(d) { return !!(D.getElementById('dimName' + d + 'false') || D.getElementById('dimName' + d + 'true')); }
    /* 1. cases de la page : on clique seulement si l'état diffère */
    var cks = Array.prototype.filter.call(D.querySelectorAll('.gwt-HTML input[type="checkbox"].custom-check'), vis);
    var clicked = false;
    (P.cases || []).forEach(function (c) {
      var x = cks.filter(function (k) { return k.parentElement && k.parentElement.textContent.replace(/\s+/g, ' ').trim() === c.label; })[0];
      if (!x) { chg.push('case "' + c.label + '" absente'); return; }
      if (x.checked !== c.checked) { x.click(); clicked = true; }
      txt.push((c.checked ? 'avec ' : 'sans ') + c.label.replace(/^inclure /i, ''));
    });
    if (clicked) await sleep(2000);
    /* 2. période recalculée sur les mois disponibles au moment du clic */
    var MO = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    function mkey(x) {
      var s = String(x == null ? '' : x).replace(/^combo_result_/, '').trim().toLowerCase(), m;
      if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return +m[3] * 12 + (+m[2] - 1);
      if ((m = s.match(/^(\d{4})-(\d{2})/))) return +m[1] * 12 + (+m[2] - 1);
      if ((m = s.match(/^([a-zéû]+)\.? (\d{4})$/))) { var i = MO.indexOf(m[1]); if (i < 0) MO.forEach(function (n, j) { if (n.indexOf(m[1]) === 0) i = j; }); if (i >= 0) return +m[2] * 12 + i; }
      if (/^\d{9,13}$/.test(s)) { var dt = new Date(s.length > 11 ? +s : +s * 1000); return dt.getFullYear() * 12 + dt.getMonth(); }
      return null;
    }
    var list = (P.filters || []).map(function (p) { return JSON.parse(JSON.stringify(p)); });
    list.forEach(function (p) { if (!has(p.dimId)) chg.push('filtre ' + p.dimId + ' absent'); });
    (P.periodes || []).forEach(function (pr) {
      if (pr.mode === 'fixe') return;
      var p = list.filter(function (x) { return x.dimId === pr.dim; })[0], ms = D.getElementById('M' + pr.dim + sx(pr.dim));
      if (!p || !ms) { chg.push('date ' + pr.dim + ' absente'); return; }
      var mois = [];
      Array.prototype.forEach.call(ms.options, function (o) { var k = mkey(o.value); if (k !== null) mois.push({ k: k, v: o.value, l: o.text }); });
      if (!mois.length) { chg.push('mois de ' + pr.dim + ' illisibles'); return; }
      var last = Math.max.apply(null, mois.map(function (m) { return m.k; }));
      var want = pr.mode === 'dernier' ? last : pr.mode === 'dernierN1' ? last - 12 : pr.key;
      var o = mois.filter(function (m) { return m.k === want; })[0];
      if (!o) { txt.push('période absente des données'); return; }
      /* même forme de valeur que celle capturée (horodatage ou libellé) */
      var m0 = [].concat(p.member)[0], s0 = String(m0).replace(/^combo_result_/, ''), v = o.v;
      if (/^\d{9,13}$/.test(s0)) {
        var ms0 = s0.length > 11 ? +s0 : +s0 * 1000, d0 = new Date(ms0), nd = new Date(Math.floor(want / 12), want % 12, d0.getDate(), d0.getHours(), d0.getMinutes(), d0.getSeconds());
        var nv = s0.length > 11 ? nd.getTime() : Math.round(nd.getTime() / 1000);
        v = typeof m0 === 'number' ? nv : (/^combo_result_/.test(String(m0)) ? 'combo_result_' : '') + nv;
      }
      p.member = Array.isArray(p.member) ? [v] : v;
      p.memberFormated = Array.isArray(p.memberFormated) ? [o.l] : o.l;
      txt.push(o.l);
    });
    /* 3. filtres du tableau de bord */
    list = list.filter(function (p) { return has(p.dimId); });
    var FO = W.FilterOperand || W.ddCtrl.FilterOperand;
    function sig() { return list.map(function (p) { var o = null; try { o = W.ddCtrl.getFilterOperandByDim(p.dimId); } catch (e) { /* ignore */ } return p.dimId + '=' + JSON.stringify(o ? [].concat(o.member).map(String) : []); }).join('|'); }
    var want = list.map(function (p) { return p.dimId + '=' + JSON.stringify([].concat(p.member).map(String)); }).join('|');
    if (list.length && FO) {
      try { W.ddCtrl.beginSelection(); list.forEach(function (p) { W.ddCtrl.filter(new FO(p.dimId, p.member, p.h, p.l, p.memberFormated, false, p.bExcludeFilter)); }); W.ddCtrl.commitSelection(); } catch (e) { /* repli */ }
      await sleep(1500);
      if (sig() !== want) {
        try {
          W.ddCtrl.beginSelection();
          list.forEach(function (p) { var m = [].concat(p.member), f = [].concat(p.memberFormated || []); m.forEach(function (v, i) { W.ddCtrl.filter(new FO(p.dimId, v, p.h, p.l, f[i], i > 0, p.bExcludeFilter)); }); });
          W.ddCtrl.commitSelection();
        } catch (e) { chg.push('filtres refusés'); }
        await sleep(1500);
      }
    }
    if (chg.length) { modified(chg); return; }
    toast('Favori "' + P.name + '" appliqué' + (txt.length ? ' : ' + txt.join(' | ') : '') + '.', true);
  })();
};

/* Construction des scripts à partir d'une présentation enregistrée */
var LD_VIEWS = {
  captureScript: function () { return '(' + LD_VIEW_CAPTURE.toString() + ')();'; },
  minify: function (code) { return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*/g, ' '); },
  /* favori "Capturer une présentation" : utilisable par tout utilisateur, sans console */
  /* adresse du TdB (page donnée) : sert à ouvrir automatiquement le tableau de bord si le favori est cliqué ailleurs */
  homeUrl: function (pageId) {
    var d = typeof LIENS_DATA !== 'undefined' ? LIENS_DATA : {}, p = d.params || {}, e = encodeURIComponent;
    if (!d.baseUrl) return '';
    return d.baseUrl + '?' + (pageId ? 'defaultPage=' + e(pageId) + '&' : '') + 'domain=' + e(p.domain || '') + '&user=' + e(p.user || '') + '&pass=' + e(p.pass || '');
  },
  /* noms des pages et des filtres, niveaux du territoire (pour les liens de pages créés par l'assistant) */
  assistData: function () {
    var d = typeof LIENS_DATA !== 'undefined' ? LIENS_DATA : {}, names = {}, dims = {}, terr = {};
    (d.pages || []).forEach(function (p) {
      names[p.id] = (p.path && p.path.length > 1 ? p.path.slice(1).join(' > ') + ' > ' : '') + ((p.label && p.label.trim()) || p.title);
      (p.filters || []).forEach(function (f) { if (!dims[f.dim]) dims[f.dim] = f.alias || f.label || f.dim; });
    });
    (d.globals || []).forEach(function (g) {
      dims[g.dim] = g.label || dims[g.dim] || g.dim;
      if (!g.tree || !g.levels) return;
      var c = {}, cnt = {};
      (g.values || []).forEach(function (v) { cnt[v.v] = (cnt[v.v] || 0) + 1; });
      (g.values || []).forEach(function (v) {
        if (cnt[v.v] > 1) { if (typeof c[v.v] !== 'object') c[v.v] = {}; c[v.v][String(v.l).toUpperCase()] = v.lvl || 1; } else c[v.v] = v.lvl || 1;
      });
      terr[g.dim] = { h: g.hier, L: g.levels, c: c };
    });
    return { names: names, dims: dims, terr: terr };
  },
  captureBookmarklet: function (pages, home) {
    var a = LD_VIEWS.assistData();
    var code = '(' + LD_VIEW_CAPTURE.toString() + ')(' + JSON.stringify({ ui: true, guide: true, home: home || LD_VIEWS.homeUrl(''), terr: a.terr, pages: pages || [], pageSrc: LD_VIEWS.minify(LD_PAGE_APPLY.toString()), applySrc: LD_VIEWS.minify(LD_VIEW_APPLY.toString()) }) + ');';
    return 'javascript:' + encodeURIComponent(LD_VIEWS.minify(code));
  },
  applyScript: function (view) {
    var V = { name: view.name, url: view.url || LD_VIEWS.homeUrl(view.pageId), pageId: view.pageId, pageUid: view.pageUid, tfiltres: view.tfiltres || [], periodes: view.periodes || [], excel: !!view.excel, used: view.used || (view.dimensions || []).concat(view.mesures || []), vue: view.vue };
    return '(' + LD_VIEW_APPLY.toString() + ')(' + JSON.stringify(V) + ');';
  },
  bookmarklet: function (view) {
    var code = LD_VIEWS.minify(LD_VIEWS.applyScript(view));
    return 'javascript:' + encodeURIComponent(code);
  }
};

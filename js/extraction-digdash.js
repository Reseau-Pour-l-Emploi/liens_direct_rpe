/* Extraction DigDash - Liens directs TdB RPE
   Script copie depuis admin.html puis colle dans la console du navigateur (F12 > Console), sur le tableau de bord ouvert.
   Parcourt toutes les pages, releve les filtres (dimensions + valeurs) et telecharge un fichier JSON. */
var LD_CRAWLER = function () {
  var OPT = {
    exclude: /^(DDAudit_|Focus_sur_l_accompagnement)/,
    minWait: 2500,
    stableFor: 1500,
    timeout: 25000,
    maxValues: 2000,
    nodeTimeout: 10000,
    globalDims: ['C_REGION_ID', 'C_TERRITOIRE_ID', 'C_TERRITOIRECOMP_ID', 'C_LBLREGION', 'C_LBLDEPARTEMENT', 'C_DEPARTEMENT_ID']
  };
  var W = window, D = document;
  var stopped = false;
  var report = { source: 'digdash', schema: 1, extractedAt: new Date().toISOString(), url: location.origin + location.pathname, version: (W.ddCtrl && W.ddCtrl.version) || '', pages: [], globals: [], errors: [] };

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function txt(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function visible(el) { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }

  /* ---- Menu : titres et arborescence ---- */
  var titles = {};
  Array.prototype.forEach.call(D.querySelectorAll('[id$="_0_menu_title_text"]'), function (el) {
    titles[el.id.replace(/_0_menu_title_text$/, '')] = txt(el);
  });
  var menuIds = Object.keys(titles).sort(function (a, b) { return a.length - b.length; });

  /* ---- Dimensions connues (panneau de filtres global) ---- */
  var dims = {};
  Array.prototype.forEach.call(D.querySelectorAll('span[id^="dimName"][id$="false"]'), function (el) {
    var id = el.id.replace(/^dimName/, '').replace(/false$/, '');
    if (!dims[id]) dims[id] = txt(el);
  });
  var dimIds = Object.keys(dims).sort(function (a, b) { return b.length - a.length; });

  /* ---- Pages ---- */
  var seen = {}, pages = [];
  Array.prototype.forEach.call(D.querySelectorAll('.dashboard_page[role="main"][uid]'), function (el) {
    if (seen[el.id]) return;
    seen[el.id] = 1;
    pages.push({ id: el.id, uid: el.getAttribute('uid') });
  });
  var pageIds = pages.map(function (p) { return p.id; });

  function pathOf(pid) {
    var path = [];
    menuIds.forEach(function (m) { if (m !== pid && pid.indexOf(m + '_') === 0) path.push(titles[m]); });
    return path;
  }
  function titleOf(pid, path) {
    if (titles[pid]) return titles[pid];
    var parent = '';
    menuIds.forEach(function (m) { if (m !== pid && pid.indexOf(m + '_') === 0) parent = m; });
    return pid.slice(parent ? parent.length + 1 : 0).replace(/___/g, ' / ').replace(/_/g, ' ').trim();
  }
  function ownedBy(elId, pid) {
    if (elId.indexOf(pid + '_') !== 0) return false;
    for (var i = 0; i < pageIds.length; i++) {
      var o = pageIds[i];
      if (o.length > pid.length && o.indexOf(pid + '_') === 0 && elId.indexOf(o + '_') === 0) return false;
    }
    return true;
  }

  function resolveDim(suffix, label) {
    for (var i = 0; i < dimIds.length; i++) {
      if (new RegExp('(^|_)' + escRe(dimIds[i]) + '(_\\d+)?$').test(suffix)) return { dim: dimIds[i], check: false };
    }
    var byLabel = dimIds.filter(function (k) { return dims[k] === label; });
    if (byLabel.length === 1) return { dim: byLabel[0], check: false };
    var m = suffix.match(/((?:C|N|D)_[A-Z0-9_]+?)(?:_\d+)?$/);
    return { dim: m ? m[1] : suffix, check: true };
  }

  function slicers(pid) {
    return Array.prototype.filter.call(D.querySelectorAll('[id^="' + pid.replace(/"/g, '\\"') + '_"].dimension'), function (el) { return ownedBy(el.id, pid); });
  }
  /* niveau d'un noeud de liste arborescente : aria-level, sinon profondeur dans l'arbre */
  function nodeLevel(li) {
    var an = li.querySelector('a.jstree-anchor, a[aria-level]');
    var n = an ? +an.getAttribute('aria-level') : 0;
    if (n) return n;
    n = 1;
    var x = li.parentNode;
    while (x && x.closest) { x = x.parentNode ? x.parentNode.closest('li.jstree-node') : null; if (x) n++; }
    return n;
  }
  function nodeMember(li, prefix) {
    var m = li.getAttribute('member') || li.getAttribute('data-member');
    if (m) return m;
    var id = li.id.indexOf(prefix) === 0 ? li.id.slice(prefix.length) : li.id;
    return id.replace(/^\d+_/, '');
  }
  function treeValues(el, tc) {
    var prefix = 'slicer_' + el.id + '_', out = [], got = {};
    Array.prototype.forEach.call(tc.querySelectorAll('li.jstree-node, li[member]'), function (li) {
      var an = li.querySelector('a.jstree-anchor');
      if (!li.hasAttribute('member') && li.id.indexOf(prefix) !== 0) return; /* noeud provisoire de chargement */
      var lvl = nodeLevel(li), mv = nodeMember(li, prefix);
      var par = li.parentNode && li.parentNode.closest ? li.parentNode.closest('li.jstree-node, li[member]') : null;
      var pv = par ? nodeMember(par, prefix) : '';
      var key = lvl + '|' + pv + '|' + mv;
      if (!mv || got[key]) return;
      got[key] = 1;
      out.push({ v: mv, l: li.getAttribute('memberformated') || txt(an) || mv, lvl: lvl, p: pv, pp: li.getAttribute('parentpath') || '', nid: li.id });
    });
    return out.slice(0, OPT.maxValues);
  }
  function slicerValues(el) {
    var tcx = treeContent(el);
    if (tcx) return treeValues(el, tcx);
    var prefix = 'slicer_' + el.id + '_', out = [], got = {};
    Array.prototype.forEach.call(D.querySelectorAll('li[id^="slicer_"]'), function (li) {
      if (li.id.indexOf(prefix) !== 0) return;
      if (li.hasAttribute('member')) {
        /* liste arborescente (jstree) : membre, niveau et parent */
        var an = li.querySelector('a.jstree-anchor');
        var lvl = an ? +an.getAttribute('aria-level') || 1 : 1;
        var par = li.parentNode && li.parentNode.closest ? li.parentNode.closest('li[member]') : null;
        var mv = li.getAttribute('member'), pv = par ? par.getAttribute('member') : '';
        var key = lvl + '|' + pv + '|' + mv;
        if (got[key]) return;
        got[key] = 1;
        out.push({ v: mv, l: li.getAttribute('memberformated') || txt(an) || mv, lvl: lvl, p: pv, pp: li.getAttribute('parentpath') || '', nid: li.id.slice(prefix.length) });
        return;
      }
      var v = li.id.slice(prefix.length);
      if (!v || v === 'All' || got[v] || /_(dropdown|checkbox)$/.test(v)) return;
      got[v] = 1;
      out.push({ v: v, l: txt(li) || v });
    });
    if (!out.length) {
      Array.prototype.forEach.call(el.querySelectorAll('select option'), function (o) {
        var v = o.value;
        if (!v || got[v] || /^(All|Tous)$/i.test(v)) return;
        got[v] = 1;
        out.push({ v: v, l: txt(o) || v });
      });
    }
    return out.slice(0, OPT.maxValues);
  }
  function signature(pid) {
    var s = slicers(pid), n = s.length, waits = 0;
    s.forEach(function (el) { n += slicerValues(el).length; });
    Array.prototype.forEach.call(D.querySelectorAll('[id^="' + pid + '_"][id$="_wait"]'), function (w) { if (visible(w)) waits++; });
    return { sig: n, waits: waits };
  }
  async function waitStable(pid) {
    await sleep(OPT.minWait);
    var t0 = Date.now(), last = -1, since = Date.now();
    while (Date.now() - t0 < OPT.timeout) {
      var s = signature(pid);
      if (s.sig !== last) { last = s.sig; since = Date.now(); }
      if (!s.waits && Date.now() - since >= OPT.stableFor) return;
      await sleep(300);
    }
  }
  async function extractPage(pid) {
    var out = [];
    var list = slicers(pid);
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var suffix = el.id.slice(pid.length + 1);
      var a = el.querySelector('a.chzn-single, a.chzn-choices, [aria-label^="Filtre sur la dimension"]');
      var label = '';
      if (a) {
        var m = (a.getAttribute('aria-label') || '').match(/dimension (.+?),/);
        label = m ? m[1] : txt(a.querySelector('span[title]'));
      }
      var r = resolveDim(suffix, label);
      var values = slicerValues(el);
      if (!values.length && a && a.click) {
        try { a.click(); await sleep(1500); values = slicerValues(el); a.click(); } catch (e) { /* ignore */ }
      }
      var f = { dim: r.dim, label: label || dims[r.dim] || r.dim, check: r.check, multi: !!el.querySelector('.chzn-container-multi'), portlet: suffix, values: values };
      var tc = treeContent(el);
      if (tc) {
        var h = hierOf(r.dim, el);
        f.tree = true; f.hier = h.hier; f.levels = h.levels;
        var ck = r.dim + '|' + f.label;
        if (treeCache[ck]) f.values = treeCache[ck];
        else {
          await expandTree(el, tc, h.levels.length || 4);
          f.values = slicerValues(el);
          treeCache[ck] = f.values;
        }
      }
      out.push(f);
    }
    return out;
  }

  /* ---- Listes arborescentes (dimension hiérarchique, ex. France > Région > Département > CLPE) ---- */
  var treeCache = {};
  function treeContent(el) {
    var c = D.getElementById('slicercontent_' + el.id);
    return c && /jstree/.test(c.className) ? c : null;
  }
  function hierOf(dim, el) {
    var hier = '', levels = [];
    var hs = D.getElementById('H' + dim + 'false'), ls = D.getElementById('L' + dim + 'false');
    if (hs && hs.options.length) hier = hs.options[hs.selectedIndex >= 0 ? hs.selectedIndex : 0].value;
    if (ls && ls.options.length) levels = Array.prototype.map.call(ls.options, function (o) { return o.value; }).reverse();
    if (!hier) {
      /* repli : fil d'Ariane du graphique associé (ex. "National > Région") */
      var bc = D.querySelector('.breadcrumbTxt[id*="_' + dim + '_"]');
      if (bc) {
        var ems = bc.querySelectorAll('em');
        if (ems.length) hier = txt(ems[0]);
        if (!levels.length && ems.length > 1) levels = [txt(ems[ems.length - 1])];
      }
    }
    return { hier: hier, levels: levels };
  }
  /* les sous-niveaux sont chargés à la demande : un noeud provisoire (sans attribut member) précède les vrais enfants */
  function kidsReady(li) {
    var ul = li.querySelector(':scope > ul');
    if (!ul || !ul.children.length) return false;
    for (var i = 0; i < ul.children.length; i++) if (!ul.children[i].hasAttribute('member')) return false;
    return true;
  }
  async function waitKids(id, ms) {
    var t0 = Date.now();
    while (Date.now() - t0 < ms) {
      var li = D.getElementById(id);
      if (!li || kidsReady(li)) return true;
      await sleep(200);
    }
    return false;
  }
  function inst(tc) {
    var t = null;
    jqs().some(function ($) { try { t = $(tc).jstree(true); } catch (e) { t = null; } return !!(t && t.open_node); });
    return t && t.open_node ? t : null;
  }
  async function openNode(tc, id) {
    var li = D.getElementById(id);
    if (!li || /jstree-leaf/.test(li.className) || kidsReady(li)) return;
    var t = inst(tc);
    if (t) {
      try { t.open_node(li); } catch (e) { /* repli ci-dessous */ }
      if (await waitKids(id, OPT.nodeTimeout)) return;
      try { t.close_node(D.getElementById(id)); await sleep(300); } catch (e) { /* ignore */ }
    }
    li = D.getElementById(id);
    var ocl = li && li.querySelector('i.jstree-ocl');
    if (ocl) ['mousedown', 'mouseup', 'click'].forEach(function (ev) { ocl.dispatchEvent(new MouseEvent(ev, { bubbles: true })); });
    if (!(await waitKids(id, OPT.nodeTimeout))) report.errors.push({ page: 'territoires', error: 'sous-niveaux non chargés : ' + id });
  }
  /* toutes les instances jQuery de la page qui portent le plugin jstree */
  function jqs() {
    var out = [];
    [W.jQuery, W.$, W.jq, W.ddjQuery].concat(Object.keys(W).filter(function (k) { return /jquery|^\$|^jq/i.test(k); }).map(function (k) { return W[k]; }))
      .forEach(function ($) { try { if ($ && $.fn && $.fn.jstree && out.indexOf($) < 0) out.push($); } catch (e) { /* ignore */ } });
    return out;
  }
  async function expandTree(el, tc, depth) {
    var base = msg.textContent;
    var a = el.querySelector('a.chzn-single');
    var drop = D.getElementById('slicer_' + el.id + '_dropdown');
    var wasHidden = drop && drop.style.display === 'none';
    if (wasHidden && a) { try { a.click(); await sleep(500); } catch (e) { /* ignore */ } }
    for (var lvl = 1; lvl < depth && !stopped; lvl++) {
      var ids = Array.prototype.filter.call(tc.querySelectorAll('li.jstree-node, li[member]'), function (li) {
        return li.id && nodeLevel(li) === lvl && !/jstree-leaf/.test(li.className);
      }).map(function (li) { return li.id; });
      for (var i = 0; i < ids.length && !stopped; i++) {
        msg.textContent = base + ' | territoires niveau ' + (lvl + 1) + ' : ' + (i + 1) + '/' + ids.length;
        await openNode(tc, ids[i]);
      }
    }
    if (wasHidden && a && drop && drop.style.display !== 'none') { try { a.click(); } catch (e) { /* ignore */ } }
    msg.textContent = base;
  }

  function globalDim(k) {
    var p = D.getElementById('dimSel' + k + 'false');
    if (!p) return null;
    var combos = p.querySelectorAll('select.selHierCombo');
    var hier = '', level = '', values = [], got = {};
    function add(v, l) { if (!v || got[v] || /^(Tous|All)$/i.test(v)) return; got[v] = 1; values.push({ v: v, l: l || v }); }
    Array.prototype.forEach.call(p.querySelectorAll('li[title]'), function (li) { add(li.getAttribute('title'), txt(li)); });
    if (values.length && combos.length >= 2) {
      hier = txt(combos[0].options[combos[0].selectedIndex]);
      level = txt(combos[1].options[combos[1].selectedIndex]);
    }
    if (!values.length && combos.length) {
      var last = combos[combos.length - 1];
      if (combos.length >= 3) {
        hier = txt(combos[0].options[combos[0].selectedIndex]);
        level = txt(combos[1].options[combos[1].selectedIndex]);
      }
      if (combos.length === 1 || combos.length >= 3) Array.prototype.forEach.call(last.options, function (o) { add(o.value, txt(o)); });
    }
    if (!values.length) return null;
    return { dim: k, label: dims[k] || k, hier: hier, level: level, values: values.slice(0, OPT.maxValues) };
  }

  /* ---- Bandeau de progression ---- */
  var box = D.createElement('div');
  box.style.cssText = 'position:fixed;z-index:999999;right:16px;bottom:16px;background:#0D1440;color:#fff;font:13px Arial,sans-serif;padding:12px 16px;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,.3);max-width:360px';
  var msg = D.createElement('div'), btn = D.createElement('button');
  btn.textContent = 'Arreter';
  btn.style.cssText = 'margin-top:8px;font:inherit;padding:4px 12px;border-radius:4px;border:0;cursor:pointer';
  btn.onclick = function () { stopped = true; msg.textContent = 'Arret demande...'; };
  box.appendChild(msg); box.appendChild(btn); D.body.appendChild(box);

  function download() {
    var blob = new Blob([JSON.stringify(report, null, 1)], { type: 'application/json' });
    var a = D.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'extraction-digdash-' + report.extractedAt.slice(0, 10) + '.json';
    D.body.appendChild(a); a.click(); a.remove();
  }

  async function run() {
    if (!W.ddCtrl || !W.ddCtrl.changePage) { msg.textContent = 'Tableau de bord DigDash introuvable sur cet onglet.'; return; }
    OPT.globalDims.forEach(function (k) { var g = globalDim(k); if (g) report.globals.push(g); });
    var todo = pages.filter(function (p) { return !OPT.exclude.test(p.id); });
    var start = D.querySelector('.dashboard_page[role="main"][uid]:not([style*="display: none"])');
    for (var i = 0; i < todo.length && !stopped; i++) {
      var p = todo[i];
      var path = pathOf(p.id);
      msg.textContent = 'Page ' + (i + 1) + ' / ' + todo.length + ' : ' + titleOf(p.id, path);
      var filters = [];
      try {
        W.ddCtrl.changePage(p.uid);
        await waitStable(p.id);
        filters = await extractPage(p.id);
      } catch (e) {
        report.errors.push({ page: p.id, error: String(e && e.message || e) });
      }
      report.pages.push({ id: p.id, uid: p.uid, title: titleOf(p.id, path), path: path, inMenu: !!titles[p.id], filters: filters });
      console.log('[Extraction] ' + (i + 1) + '/' + todo.length + ' ' + p.id + ' : ' + filters.length + ' filtre(s)');
    }
    report.stopped = stopped;
    try { if (start) W.ddCtrl.changePage(start.getAttribute('uid')); } catch (e) { /* ignore */ }
    download();
    var nf = report.pages.reduce(function (s, p) { return s + p.filters.length; }, 0);
    msg.textContent = 'Termine : ' + report.pages.length + ' pages, ' + nf + ' filtres. Fichier JSON telecharge.';
    btn.textContent = 'Fermer';
    btn.onclick = function () { box.remove(); };
    W.__extractionDigdash = report;
  }

  if (W.__LD_TEST) { W.__LD_API = { pages: pages, titles: titles, dims: dims, pathOf: pathOf, titleOf: titleOf, extractPage: extractPage, globalDim: globalDim, OPT: OPT, report: report }; box.remove(); return; }
  run();
};

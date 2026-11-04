/* Liens directs TdB RPE - fonctions communes (page publique + console admin) */
var LD = (function () {
  var TERRITORIAL = /^(C_TERRITOIRE(COMP2?)?_ID|C_REGION_ID|C_DEPARTEMENT_ID|C_LBLREGION|C_LBLDEPARTEMENT|C_LBLTERRITOIRE)$/;

  function enc(s) { return encodeURIComponent(String(s)); }

  function encodeExtra(extra) {
    if (!extra) return '';
    return String(extra).split('&').filter(Boolean).map(function (pair) {
      var i = pair.indexOf('=');
      if (i < 0) return enc(pair.trim());
      return enc(pair.slice(0, i).trim()) + '=' + enc(pair.slice(i + 1).trim());
    }).join('&');
  }

  /* sel : { dim: valeur } pour les filtres de la page
     gsel : { g: filtre transverse, v: membre, lvl: niveau (1 = premier niveau) pour une dimension hiérarchique } */
  function buildUrl(data, page, sel, gsel) {
    var p = data.params || {};
    var url = data.baseUrl + '?defaultPage=' + enc(page.id) +
      '&domain=' + enc(p.domain || '') + '&user=' + enc(p.user || '') + '&pass=' + enc(p.pass || '');
    var used = {};
    (page.filters || []).forEach(function (f) {
      if (!f.enabled || !sel || !sel[f.dim]) return;
      used[f.dim] = 1;
      url += '&' + enc(f.dim) + '=' + enc(sel[f.dim]);
    });
    if (gsel && gsel.g && gsel.v && page.applyGlobals !== false && !used[gsel.g.dim]) {
      url += '&' + enc(gsel.g.dim) + '=' + enc(gsel.v);
      if (gsel.g.tree && gsel.g.hier && gsel.lvl && gsel.g.levels && gsel.g.levels[gsel.lvl - 1]) {
        url += '&' + enc('H' + gsel.g.dim) + '=' + enc(gsel.g.hier) + '&' + enc('L' + gsel.g.dim) + '=' + enc(gsel.g.levels[gsel.lvl - 1]);
      }
      var x = encodeExtra(gsel.g.extra);
      if (x) url += '&' + x;
    }
    return url;
  }

  function displayTitle(page) { return (page.label && page.label.trim()) || page.title; }

  /* Regroupement : racine (tableau de bord) > rubrique > pages */
  function group(pages) {
    var roots = [], byRoot = {};
    pages.forEach(function (pg) {
      var root = pg.path[0] || 'Autres pages';
      var rub = pg.path[1] || displayTitle(pg);
      if (!byRoot[root]) { byRoot[root] = { name: root, rubs: [], byRub: {} }; roots.push(byRoot[root]); }
      var R = byRoot[root];
      if (!R.byRub[rub]) { R.byRub[rub] = { name: rub, pages: [] }; R.rubs.push(R.byRub[rub]); }
      R.byRub[rub].pages.push(pg);
    });
    return roots;
  }

  /* Libellé court d'une page dans sa rubrique (sous-onglets inclus) */
  function shortTitle(pg) {
    var t = displayTitle(pg);
    if (pg.label && pg.label.trim()) return t;
    var extra = pg.path.slice(2);
    return extra.length ? extra.concat([t]).join(' : ') : t;
  }

  function globalSources(ext) {
    var out = [];
    (ext.globals || []).forEach(function (g) {
      out.push({ source: 'panel:' + g.dim, dim: g.dim, label: g.label, hier: g.hier || '', level: g.level || '', values: g.values });
    });
    var seen = {};
    (ext.pages || []).forEach(function (pg) {
      (pg.filters || []).forEach(function (f) {
        if (!TERRITORIAL.test(f.dim)) return;
        var key = 'slicer:' + f.dim + ':' + f.label;
        if (seen[key] || !f.values.length) return;
        seen[key] = 1;
        out.push({ source: key, dim: f.dim, label: f.label, hier: f.hier || '', level: '', tree: !!f.tree, levels: f.levels || [], values: f.values });
      });
    });
    return out;
  }

  function sameValues(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i].v !== b[i].v || a[i].l !== b[i].l || (a[i].lvl || 0) !== (b[i].lvl || 0) || (a[i].p || '') !== (b[i].p || '')) return false;
    return true;
  }

  /* Fusion d'une extraction avec la configuration existante (réglages admin conservés) */
  function merge(cur, ext, opts) {
    opts = opts || {};
    var keepMissing = !!opts.keepMissing;
    var rep = { pagesAdded: [], pagesRemoved: [], filtersAdded: [], filtersRemoved: [], valuesChanged: [], globalsAdded: [], globalsUpdated: [], toCheck: [] };
    var old = {};
    (cur.pages || []).forEach(function (p) { old[p.id] = p; });
    var seen = {};
    var pages = (ext.pages || []).map(function (e) {
      seen[e.id] = 1;
      var o = old[e.id];
      if (!o) rep.pagesAdded.push(e.title);
      var of = {};
      ((o && o.filters) || []).forEach(function (f) { of[f.dim] = f; });
      var ef = {};
      /* un seul filtre par dimension (ex. plusieurs listes territoriales sur une page de comparaison) */
      var src = (e.filters || []).filter(function (f) {
        if (ef[f.dim]) return false;
        if (!(f.values || []).length && (e.filters || []).some(function (x) { return x.dim === f.dim && (x.values || []).length; })) return false;
        ef[f.dim] = 1;
        return true;
      });
      var filters = src.map(function (f) {
        var prev = of[f.dim];
        if (!prev) rep.filtersAdded.push(e.title + ' : ' + f.label);
        else if (!sameValues(prev.values || [], f.values || [])) rep.valuesChanged.push(e.title + ' : ' + f.label);
        if (f.check) rep.toCheck.push(e.title + ' : ' + f.label + ' (' + f.dim + ')');
        return {
          dim: f.dim, label: f.label, alias: prev ? (prev.alias || '') : '',
          enabled: prev ? prev.enabled !== false : !f.check,
          multi: !!f.multi, check: !!f.check, values: f.values || [],
          tree: !!f.tree, geo: TERRITORIAL.test(f.dim), hier: f.hier || '', levels: f.levels || []
        };
      });
      Object.keys(of).forEach(function (d) { if (!ef[d]) rep.filtersRemoved.push(e.title + ' : ' + of[d].label); });
      return {
        id: e.id, uid: e.uid, title: e.title, path: e.path || [], inMenu: !!e.inMenu,
        visible: o ? o.visible !== false : (!!e.inMenu && !/^Focus_sur_l_accompagnement/.test(e.id)),
        label: o ? (o.label || '') : '', note: o ? (o.note || '') : '',
        applyGlobals: o ? o.applyGlobals !== false : true,
        filters: filters
      };
    });
    (cur.pages || []).forEach(function (p) {
      if (seen[p.id]) return;
      if (keepMissing) pages.push(p); else rep.pagesRemoved.push(displayTitle(p));
    });

    var globals = (cur.globals || []).map(function (g) { return JSON.parse(JSON.stringify(g)); });
    var bySrc = {};
    globals.forEach(function (g) { bySrc[g.source] = g; });
    globalSources(ext).forEach(function (s, i) {
      var g = bySrc[s.source];
      if (g) {
        if (g.tree && !s.tree) return; /* extraction ancienne version : ne pas écraser une liste arborescente */
        if (!sameValues(g.values || [], s.values)) { g.values = s.values; rep.globalsUpdated.push(g.label); }
        if (s.tree) { g.tree = true; g.hier = s.hier || g.hier || ''; if (s.levels.length) g.levels = s.levels; }
      } else {
        var extra = !s.tree && s.hier && s.level ? 'H' + s.dim + '=' + s.hier + '&L' + s.dim + '=' + s.level : '';
        var ng = { key: 'g' + Date.now().toString(36) + i, source: s.source, label: s.label, dim: s.dim, extra: extra, enabled: false, values: s.values };
        if (s.tree) { ng.tree = true; ng.hier = s.hier; ng.levels = s.levels; ng.levelLabels = []; }
        globals.push(ng);
        rep.globalsAdded.push(s.label + ' (' + s.source + ')');
      }
    });

    var data = {
      schema: 1,
      updatedAt: new Date().toISOString(),
      extractedAt: ext.extractedAt || '',
      baseUrl: cur.baseUrl || ext.url || '',
      params: cur.params || {},
      globals: globals,
      pages: pages
    };
    return { data: data, report: rep };
  }

  function serialize(data) {
    return '/* Configuration des liens directs du TdB RPE - fichier généré par admin.html, ne pas modifier à la main */\n' +
      'var LIENS_DATA = ' + JSON.stringify(data, null, 1) + ';\n';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /* Libellé d'un niveau (renommage admin possible, ex. Territoire -> CLPE) */
  function levelLabel(g, lvl) {
    return (g.levelLabels && g.levelLabels[lvl - 1]) || (g.levels && g.levels[lvl - 1]) || ('Niveau ' + lvl);
  }
  function children(g, lvl, parent) {
    return (g.values || []).filter(function (v) { return (v.lvl || 1) === lvl && (lvl === 1 || v.p === parent); });
  }
  function depth(g) {
    var d = 1;
    (g.values || []).forEach(function (v) { if ((v.lvl || 1) > d) d = v.lvl; });
    return Math.max(d, g.tree && g.levels ? Math.min(g.levels.length, d) : d);
  }

  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  return { buildUrl: buildUrl, group: group, shortTitle: shortTitle, displayTitle: displayTitle, merge: merge, serialize: serialize, fmtDate: fmtDate, norm: norm, levelLabel: levelLabel, children: children, depth: depth, encodeExtra: encodeExtra };
})();
if (typeof module !== 'undefined') module.exports = LD;

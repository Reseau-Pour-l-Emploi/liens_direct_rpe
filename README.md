# Liens directs vers le tableau de bord RPE

Page autonome qui donne accès à chaque page du tableau de bord RPE (DigDash) par un lien direct, avec filtres quand la page en propose.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page publique (recherche, territoire transverse, filtres par page, copier / ouvrir) |
| `admin.html` | Console d'administration : extraction, import, réglages, publication (non référencée, `noindex`) |
| `js/liens-core.js` | Fonctions communes : construction des liens, fusion d'une extraction |
| `js/extraction-digdash.js` | Script d'extraction exécuté dans la console du tableau de bord |
| `data/liens-directs-data.js` | Configuration publiée (pages, filtres, territoires), générée par `admin.html` |
| `assets/`, `fonts/` | Logos RPE / France Travail, police Marianne |

## Mise à jour

1. `admin.html` > **Extraction** : ouvrir le tableau de bord, coller le script dans la console (F12), attendre le fichier JSON.
2. **Import** : déposer le JSON, vérifier le rapport, appliquer.
3. **Pages et filtres** / **Territoire et paramètres** : ajuster (pages affichées, libellés, notes, filtres actifs, niveaux territoriaux testés).
4. **Publication** : télécharger `liens-directs-data.js`, le placer dans `data/`, commit.

## Syntaxe des liens

`index.html?defaultPage=<id page>&domain=...&user=...&pass=...&<ID dimension>=<ID membre>`

Une valeur par filtre. Les dimensions hiérarchiques peuvent nécessiter `H<dim>=<hiérarchie>&L<dim>=<niveau>` (paramètres complémentaires du filtre territorial).

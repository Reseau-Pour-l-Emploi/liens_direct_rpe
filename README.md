# Mes favoris du tableau de bord RPE

Page autonome qui installe le favori **Assistant TdB RPE**. Utilisé dans le tableau de bord RPE (DigDash), l'assistant reconnaît la page affichée :

- **page classique** : il crée un favori (lien classique) qui rouvre la page avec ses filtres ;
- **tableau personnalisé** : il guide la mise en forme, puis crée un favori qui remet la disposition, les filtres, la période choisie et, en option, lance un export Excel.

L'assistant lit en direct le tableau de bord (menu, pages, filtres, niveaux territoriaux) : aucune extraction à tenir à jour.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page publique : installation pas à pas de l'assistant |
| `js/vues-digdash.js` | Assistant (capture d'une page ou d'un tableau personnalisé) et application des favoris |
| `js/liens-core.js` | Fonctions communes |
| `data/liens-directs-data.js` | Adresse du tableau de bord et paramètres d'accès public, données de secours (territoires, tableaux personnalisés) |
| `assets/`, `fonts/` | Logos RPE / France Travail, police Marianne |

## Changement de structure du tableau de bord

Si une page ou un tableau personnalisé est modifié dans DigDash (dimension, mesure ou filtre supprimé ou renommé), le favori concerné affiche un message invitant à refaire la capture avec l'assistant.

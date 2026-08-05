# Suivi de candidatures

Tracker de recherche d'emploi en React : centraliser ses candidatures, suivre leur statut, et ne plus rien perdre de vue.

## Fonctionnalités

- Suivi par statut : en attente, vivier / pause, refusé, sans suite
- Canal d'origine de chaque candidature (candidature directe, réseau, sollicitation entrante...)
- Compteur automatique du nombre de jours écoulés depuis la dernière action sur les candidatures "en attente"
- Recherche (entreprise, poste, note) et filtres par statut
- Vue statistiques : taux de réponse, répartition par statut et par canal
- Export CSV de toutes les candidatures
- Historique des changements de statut par candidature
- Ajout, édition et suppression de candidatures
- Sauvegarde automatique persistante

## Stack

- React 18 + Vite
- Tailwind CSS
- [lucide-react](https://lucide.dev/) pour les icônes

## Démarrer en local (Mac, Windows, Linux)

Prérequis : [Node.js](https://nodejs.org/) 18 ou plus (le plus simple sur Mac : `brew install node`, ou via [nvm](https://github.com/nvm-sh/nvm)).

```bash
npm install
npm run dev
```

Vite affiche une adresse locale (en général `http://localhost:5173`) — ouvre-la dans ton navigateur, l'app tourne.

Pour un build de production statique (déployable n'importe où  Netlify, Vercel, GitHub Pages...) :

```bash
npm run build
npm run preview   # pour vérifier le build en local
```

## Stockage

Le composant embarque un petit adaptateur de stockage (`storage`) qui :
- utilise `window.storage` quand il est disponible (environnement où le composant a été prototypé) ;
- retombe automatiquement sur `localStorage` dans n'importe quel autre contexte — donc aussi en local avec `npm run dev`.

Le même composant fonctionne tel quel dans les deux environnements, sans rien à changer.

## Structure

```
.
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx              # point d'entrée React
    ├── index.css             # directives Tailwind
    └── CandidatureTracker.jsx  # le composant
```

## Données

Ce dépôt ne contient que des données de démonstration fictives (`SEED`, dans `CandidatureTracker.jsx`). Au premier lancement, l'app les charge une fois, puis toutes les modifications de l'utilisateur (ajout, édition, statut) sont sauvegardées dans son propre stockage aucune donnée personnelle n'est codée en dur dans la source.

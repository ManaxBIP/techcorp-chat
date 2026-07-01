# TechCorp Chat

Interface de chat web permettant de discuter avec un modèle de langage (LLM) hébergé en local via [Ollama](https://ollama.com/), avec support du streaming des réponses.

## 🔗 Démo en ligne

**Production : [https://techcorp-chat.vercel.app/](https://techcorp-chat.vercel.app/)**

> ⚠️ **Si l'API ne répond plus**, c'est normal : le modèle est hébergé sur le serveur personnel d'un élève de la filière infra, exposé via un tunnel (ngrok/localtunnel). Ce serveur n'est pas destiné à tourner 24/7 et peut être coupé ou instable à tout moment. L'interface front reste consultable même quand le backend est down.

Une vidéo de démo montrant le fonctionnement complet de l'application (envoi de message, streaming de la réponse, changement de modèle, mode simulation, etc.) est disponible en pièce jointe.

## 🏗️ Architecture

```
┌──────────────┐        ┌──────────────────────┐        ┌───────────────────────────┐
│   Navigateur  │  HTTP  │   SvelteKit (Vercel)  │  HTTP  │  Serveur Ollama distant   │
│  (UI Svelte)  │ ─────► │  /api/proxy (backend) │ ─────► │  (tunnel ngrok/LT chez     │
│               │ ◄───── │                       │ ◄───── │   l'élève infra)          │
└──────────────┘        └──────────────────────┘        └───────────────────────────┘
```

- **Frontend** : une SPA Svelte (`src/routes/+page.svelte`) affiche la conversation, gère l'historique, le choix du modèle et les réglages, via un store central (`src/lib/stores/chatStore.ts`).
- **Backend (proxy)** : une route serveur SvelteKit (`src/routes/api/proxy/+server.ts`) relaie les appels vers l'URL Ollama configurée. Ce proxy existe pour deux raisons :
  - **contourner le CORS**, le navigateur ne pouvant pas appeler directement une API tierce sans en-têtes adaptés ;
  - **contourner les pages d'avertissement des tunnels** (ngrok, LocalTunnel) en ajoutant les en-têtes nécessaires (`ngrok-skip-browser-warning`, `Bypass-Tunnel-Reminder`, `User-Agent: curl`).
- **Backend LLM** : un serveur [Ollama](https://ollama.com/) tournant sur la machine d'un élève infra, exposé publiquement via un tunnel. C'est ce point qui est instable puisqu'il ne dépend pas de notre infrastructure.
- Le store front gère aussi un **mode simulation** (réponses factices en local) permettant de tester l'UI et le streaming sans dépendre du serveur distant.

## 🧱 Stack technique

- [SvelteKit](https://kit.svelte.dev/) 2 + [Svelte](https://svelte.dev/) 5 (runes)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [shadcn-svelte](https://shadcn-svelte.com/) / [bits-ui](https://bits-ui.com/) pour les composants UI
- [Lucide](https://lucide.dev/) pour les icônes
- [Vite](https://vite.js.org/) comme bundler
- [Ollama](https://ollama.com/) comme moteur d'inférence LLM (API `/api/chat`, streaming NDJSON)
- Déploiement : [Vercel](https://vercel.com/)

## 🚀 Développement local

```sh
npm install
npm run dev       # ou npm run dev -- --open
```

Le modèle Ollama doit être accessible depuis l'URL renseignée dans les réglages de l'application (par défaut une instance distante exposée via ngrok).

## 📦 Build

```sh
npm run build
npm run preview   # prévisualiser le build de production
```

## ✅ Qualité de code

```sh
npm run lint       # vérifie le formatage (prettier) et le lint (eslint)
npm run format     # applique le formatage
npm run check       # vérification des types (svelte-check)
```

# 🌟 Projet Reposight

**Reposight est une application web réalisée dans le cadre de mon portfolio pour aider les développeurs à visualiser, analyser et comparer les statistiques de leurs dépôts GitHub. Les utilisateurs peuvent lier leur compte GitHub à Reposight, explorer leurs dépôts, suivre leurs performances via des graphiques dédiés et disposer d’une vision synthétique pour mieux orienter leur travail en équipe.**

L’application n’est malheureusement pas disponible en production : elle repose sur des cookies tiers pour l’authentification (désactivés par défaut dans la plupart des navigateurs) et le front ne partage pas le même nom de domaine que le back-end.

![Screenshot de l'application](public/screenshot-home.png)

## ⭐ Fonctionnalités principales

- Se connecter en liant son compte GitHub à la plateforme.
- Rechercher, trier et sélectionner/ajouter les dépôts à suivre dans Reposight.
- Retirer un dépôt GitHub de sa sélection.
- Supprimer son compte.
- Accéder à une page détail riche pour chaque dépôt :
  - Vue d’ensemble (nom, statut privé/public, description, forks, stars, watchers, nombre de contributeurs, langages, date du dernier commit).
  - Historique des commits, pull requests et issues sur les dernières 48 h avec liens vers GitHub.
  - Visualisation de l’activité sur 30 jours grâce à un graphique interactif.
  - Comparaison hebdomadaire des commits/PRs/issues avec pourcentage d’évolution.
  - Liste des contributeurs et volume de commits associés.
  - Recherche et filtres avancés par auteur, branche et statut pour les commits, PRs et issues.
- Parcours d’onboarding guidé pour accompagner les nouveaux utilisateurs.

**Ce dépôt contient la partie front-end de Reposight. La partie back-end est disponible ici : [Reposight-front](https://github.com/PeterLeSouchu/Reposight-front).**

## 🛠️ Fonctionnement du back-end

### ⚙️ Architecture

- API en NestJS (Node.js 20) organisée en modules (`auth`, `repos`, `users`, `common`).
- Utilisation de l’API GitHub REST pour collecter commits, PRs et issues selon les filtres appliqués par l’utilisateur.
- Amazon DynamoDB : stockage des utilisateurs, des dépôts suivis et de la progression d’onboarding.

### 🧾 Validation des données

- Pipes appliqués aux paramètres des routes GET et DTO stricts pour les corps des requêtes POST, le tout activé par le `ValidationPipe` global (`transform`, `whitelist`, `forbidNonWhitelisted`) afin de garantir que seules des données typées et attendues atteignent les services.

### 🔒 Sécurité & Authentification

- OAuth GitHub via `passport-github2` : après succès, le serveur renvoie deux tokens distincts :
  - `refreshToken` longue durée, injecté dans un cookie HttpOnly `Secure` `SameSite=None` (inaccessible depuis le JS client) ;
  - `accessToken` courte durée, renvoyé dans le corps de la réponse pour être stocké côté front et ajouté ensuite dans l’en-tête `Authorization` de chaque requête.
- Routes protégées par deux guards complémentaires :
  - `JwtAuthGuard` vérifie systématiquement le jeton d’accès avant d’autoriser une requête sur les endpoints sécurisés (`/repos`, `/user`, etc.) et expose l’identifiant utilisateur dans `req.user.id`.
  - `JwtRefreshGuard` sécurise `/auth/refresh` en validant le cookie `refreshToken` avant de délivrer un nouveau jeton d’accès.
- Gestion globale des erreurs via `AllExceptionsFilter`, qui renvoie des réponses normalisées et détecte les tokens invalides/expirés pour signaler explicitement au front qu’un rafraîchissement est nécessaire.

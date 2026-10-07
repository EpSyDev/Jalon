# Jalon — outil du service technique

Référence fonctionnelle : [briefing-service-technique.md](briefing-service-technique.md).

## Prérequis

Node.js 22+ uniquement. Ni Docker ni Supabase pour développer.

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis générer SECRET_SESSION_LOCALE (commande dans le fichier)
npm run dev                  # base locale (PGlite, persistée dans .data/) + application : http://localhost:3000
```

Arrêt : Ctrl+C (arrête les deux). `npm run db:reset` repart de zéro (migrations + seed fictif). Les nouvelles migrations sont appliquées
automatiquement au démarrage de `npm run db`.

Connexion : choisir un des comptes fictifs (admin, technicien, lecture). Ce mode est refusé par l'application
sur Vercel ou avec une base distante.

## Tests

```bash
npm test          # logique métier + base Postgres embarquée (PGlite, en mémoire)
npm run typecheck
npm run lint
```

Les tests de base rejouent toutes les migrations de zéro, chargent le seed fictif et vérifient :
droits par rôle (RLS), 2FA admin, interdiction de supprimer, archivage réservé aux admins, journal d'audit,
contraintes de dates, et parité SQL/TypeScript du calcul des échéances.

## Rappels mail

Un cron quotidien (Vercel Cron, 7 h) appelle `/api/cron/rappels` avec `CRON_SECRET`. Un seul mail par exécution :
rappels J-60/J-30/J-7 (paramétrables) des contrôles, préavis de contrats et réserves, plus le récapitulatif
hebdomadaire des retards, envoyé même vide. Anti-doublon par échéance ; enregistrement après envoi réussi uniquement.

En local : `npm run cron` (application lancée) déclenche l'exécution ; les mails sont écrits dans `.data/mails`
et visibles dans **Paramètres → Voir les mails envoyés**. Destinataires et seuils : page **Paramètres** (admin).

## Sauvegarde et restauration

Indépendantes de Vercel et Supabase (l'offre gratuite de Supabase ne fournit aucune sauvegarde téléchargeable) :

```bash
npm run sauvegarde                                   # base de .env.local → sauvegardes/jalon-….json
DATABASE_URL=postgres://… npm run sauvegarde         # base de production (pooler Supabase)
npm run restaurer -- sauvegardes/jalon-….json --confirmer
```

Un admin peut aussi télécharger la sauvegarde depuis **Paramètres**. Le fichier contient toutes les tables, journal
d'audit compris : à stocker sur un support indépendant (réseau de l'établissement, disque chiffré), jamais dans le dépôt.

La restauration exige une base au même schéma (mêmes migrations), sans données métier, et dont les comptes
utilisateurs existent déjà (`--comptes-locaux` les crée en développement). Elle se fait en une transaction :
tout ou rien. Testée automatiquement (`tests/db/sauvegarde.test.ts`) et manuellement en ligne de commande.

## Variables d'environnement

| Variable | Mode | Rôle |
|---|---|---|
| `AUTH_MODE` | tous | `local` (développement) ou `supabase` (production) |
| `DATABASE_URL` | tous | Connexion Postgres (locale, ou pooler Supabase en mode transaction) |
| `SECRET_SESSION_LOCALE` | local | Signature du cookie de session locale (≥ 32 caractères) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | supabase | Authentification |
| `CRON_SECRET` | tous | Protège la route du cron (≥ 32 caractères) |
| `APP_URL` | tous | Adresse publique, pour les liens des mails |
| `MAIL_MODE` | tous | `local` (fichiers) ou `resend` (production, interdit en local sur Vercel) |
| `RESEND_API_KEY`, `MAIL_EXPEDITEUR` | resend | Envoi réel (région d'envoi UE) |

Aucune variable `NEXT_PUBLIC_` : tout passe par le serveur. Ne jamais committer `.env.local`.

## Déploiement (après validation locale et feu vert DSI)

1. Projet Supabase en région **Paris (eu-west-3)**, inscriptions désactivées, MFA TOTP activée, mot de passe ≥ 12 caractères.
2. `npx supabase link` puis `npx supabase db push` (migrations uniquement, **pas** de seed).
3. Créer les comptes par invitation depuis le tableau de bord, puis fixer les rôles :
   `update public.profils set role = 'admin' where id = '…';`
   Modèles de mail (Supabase → Authentication → Emails), pour que les liens fonctionnent avec le rendu serveur
   et résistent aux analyseurs de liens des messageries (le lien n'est consommé qu'au clic sur « Continuer ») :
   - **Invite user** : `<a href="{{ .SiteURL }}/connexion/lien?token_hash={{ .TokenHash }}&type=invite">Choisir mon mot de passe</a>`
   - **Reset password** : `<a href="{{ .SiteURL }}/connexion/lien?token_hash={{ .TokenHash }}&type=recovery">Choisir un nouveau mot de passe</a>`

   L'envoi de mails par le service intégré de Supabase est très limité (quelques mails par heure, adresses de
   l'équipe du projet seulement) : configurer un SMTP (Resend, région UE) avant d'inviter des collègues.
4. Vercel : importer le dépôt, renseigner les variables du mode `supabase` (`DATABASE_URL` = pooler, port 6543). `vercel.json` force la région `cdg1` (Paris).

## Structure

```
supabase/migrations/   schéma, audit, RLS, vue des échéances (SQL versionné)
supabase/seed/         données fictives (01 = comptes Supabase, 02 = données métier)
dev/                   base locale PGlite (serveur, préparation, simulation de l'environnement Supabase)
src/lib/metier/        règles métier pures et testées
src/lib/auth.ts        session (locale ou Supabase), rôles, 2FA
src/lib/db.ts          requêtes SQL sous l'identité de l'utilisateur (RLS)
src/proxy.ts           rafraîchissement de session, redirection, CSP à nonce
src/app/(app)/         pages authentifiées
tests/                 Vitest (unitaires + base PGlite)
```

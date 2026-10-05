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

## Variables d'environnement

| Variable | Mode | Rôle |
|---|---|---|
| `AUTH_MODE` | tous | `local` (développement) ou `supabase` (production) |
| `DATABASE_URL` | tous | Connexion Postgres (locale, ou pooler Supabase en mode transaction) |
| `SECRET_SESSION_LOCALE` | local | Signature du cookie de session locale (≥ 32 caractères) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | supabase | Authentification |

Aucune variable `NEXT_PUBLIC_` : tout passe par le serveur. Ne jamais committer `.env.local`.

## Déploiement (après validation locale et feu vert DSI)

1. Projet Supabase en région **Paris (eu-west-3)**, inscriptions désactivées, MFA TOTP activée, mot de passe ≥ 12 caractères.
2. `npx supabase link` puis `npx supabase db push` (migrations uniquement, **pas** de seed).
3. Créer les comptes par invitation depuis le tableau de bord, puis fixer les rôles :
   `update public.profils set role = 'admin' where id = '…';`
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

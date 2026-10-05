# Jalon — outil du service technique

Référence fonctionnelle : [briefing-service-technique.md](briefing-service-technique.md).

## Prérequis

- Node.js 20+
- Docker Desktop (uniquement pour lancer Supabase en local)

## Tests (sans Docker)

```bash
npm install
npm test          # logique métier + base Postgres embarquée (PGlite)
npm run typecheck
npm run lint
```

Les tests de base rejouent toutes les migrations de zéro, chargent le seed fictif et vérifient :
droits par rôle (RLS), 2FA admin, interdiction de supprimer, archivage réservé aux admins, journal d'audit,
contraintes de dates, et parité SQL/TypeScript du calcul des échéances.

## Lancer l'application en local

```bash
npx supabase start            # base + auth locales (Docker)
npx supabase db reset         # migrations + seed fictif
npx supabase status           # récupérer « API URL » et « Publishable key »
cp .env.example .env.local    # puis y reporter ces deux valeurs
npm run dev                   # http://localhost:3000
```

Comptes fictifs (mot de passe `Jalon-dev-2026`) : `admin@jalon.local`, `technicien@jalon.local`, `lecture@jalon.local`.
L'admin doit configurer la double authentification à la première connexion (application TOTP) ;
sans 2FA validée, la base ne lui accorde que la lecture.

Mails de développement (Inbucket) : http://127.0.0.1:54324.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `SUPABASE_URL` | URL de l'API Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Clé publique Supabase (la RLS protège les données) |

Aucune variable `NEXT_PUBLIC_` : tout l'accès Supabase passe par le serveur. Ne jamais committer `.env.local`.

## Déploiement (après validation locale et feu vert DSI)

1. Projet Supabase en région **Paris (eu-west-3)**, inscriptions désactivées, MFA TOTP activée, mot de passe ≥ 12 caractères.
2. `npx supabase link` puis `npx supabase db push` (migrations uniquement, **pas** de seed).
3. Créer les comptes par invitation depuis le tableau de bord, puis fixer les rôles :
   `update public.profils set role = 'admin' where id = '…';`
4. Vercel : importer le dépôt, renseigner les variables ci-dessus. `vercel.json` force la région `cdg1` (Paris).

## Structure

```
supabase/migrations/   schéma, audit, RLS, vue des échéances (SQL versionné)
supabase/seed/         données fictives (01 = comptes locaux, 02 = données métier)
src/lib/metier/        règles métier pures et testées
src/lib/auth.ts        session, rôles, 2FA
src/proxy.ts           rafraîchissement de session, redirection, CSP à nonce
src/app/(app)/         pages authentifiées
tests/                 Vitest (unitaires + base PGlite)
```

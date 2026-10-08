# Passation Jalon : état au 08/10/2026

> **Mise à jour du 08/10/2026 (lire d'abord, elle prime sur le reste).** Travail direct sur `main`, push automatique
> autorisé par Nico. Les migrations SQL sont **appliquées par Nico** (SQL Editor de Supabase, fichier envoyé avec
> SendUserFile) : ne jamais utiliser un jeton collé dans la conversation (refusé par le classificateur), ne pousser le
> code dépendant d'une migration qu'après sa confirmation.
>
> **Livré depuis le 07/10 (tout en production, 274 tests verts)** : audit complet (`AUDIT.md`), contacts (annuaire +
> reprise automatique des prestataires), formulaire unique « Nouveau contrôle » et liste par famille puis caractère,
> mode tournée, journal d'audit lisible, passage de relais, trous dans le suivi, jalon du jour, interventions et
> chantiers en retard, alerte de sauvegarde (7 jours), réserve → intervention, fiche équipement complète, relevés
> périodiques, import d'équipements enrichi (univers commun, codes générés par préfixe, colonnes en notes, feuilles
> multiples, .xlsm), création d'utilisateurs depuis Paramètres, boutons « Contrôle effectué » / « Effectué ».
>
> **Migrations appliquées en production** : 0100 limitation de connexion, 0200 garde-fous de dates, 0300 contacts,
> 0400 relevés (à confirmer : la ligne d'enregistrement dans `supabase_migrations.schema_migrations` pour 0300 et 0400).
>
> **À faire par Nico** : ajouter `SUPABASE_SERVICE_ROLE_KEY` sur Vercel (sinon la page Utilisateurs explique quoi
> faire) ; révoquer les jetons Supabase partagés dans les conversations ; poser les modèles de mail Supabase et un SMTP
> (invitation par mail, « mot de passe oublié ») ; désactiver l'API de données Supabase ; télécharger une première
> sauvegarde (Paramètres) ; feu vert DSI avant toute donnée réelle ; tester en réel connexion, 2FA admin, limitation.
>
> **Pistes écartées par Nico** : contacts par lieu, stock ↔ intervention, Ctrl+K sur stock/univers, plans de
> prévention. **Pistes restantes** : demande d'intervention depuis le QR par un compte lecture, relecture des
> déplacements groupés, PWA/hors ligne, 2FA pour tous, tests Playwright automatisés, format .xls (non pris en charge,
> demande une dépendance : à décider).
>
> **Chantier « lecture de fichiers » (décidé avec Nico le 08/10/2026).** Fichiers réels reçus le 08/10 (non commités,
> données d'établissement) : relevé MP des fauteuils (xlsx, 4 feuilles, la bonne est « SAV MP UGECAM 2026 2027
> OFFCIEL »), suivi biomédical (12 feuilles), rapport MP en PDF (généré depuis l'Excel : inutile à lire), un rapport
> Veritas (presse à balles, **sans réserve**). Ne rien deviner au-delà.
> 1. **Import Excel : fait (commit `79b60b9`)**, vérifié sur les vrais fichiers et dans le navigateur (162 fauteuils
>    importés en local, réimport sans doublon, association reprise). Fauteuils : 6 lignes dépassent 2 000 caractères de
>    notes tant que les colonnes « RAPPORT MP 2020 » ne sont pas décochées. Reste ouvert : l'historique MP mériterait
>    d'être importé en relevés/contrôles plutôt qu'en notes.
> 2. **Import de rapport PDF** : écran de pré-remplissage (jamais d'enregistrement automatique) : l'utilisateur dépose
>    le PDF, Jalon retrouve le plan de contrôle et propose date, résultat, nombre de réserves (page de garde) et liste
>    détaillée (description, gravité, échéance de levée si elles sont écrites), signale tout écart (« page de garde : 7,
>    détail : 6 »), l'utilisateur corrige puis valide ; création du contrôle et des réserves, nom du fichier en
>    `reference_rapport`. Ne pas stocker le PDF (pas d'upload sans feu vert DSI). Démarrer par une extraction à règles
>    dans l'application (texte du PDF, sans service externe) sur les rapports Veritas ; un PDF scanné demande un OCR.
>    Une lecture par IA (API Claude) lirait toutes les mises en page mais fait sortir le contenu vers un service
>    externe : seulement avec l'accord de la DSI, hébergement UE vérifié, aucune donnée patient. **Constat sur le
>    rapport reçu** : PDF texte (pas un scan), les règles tiennent pour date d'intervention, référence, nombre de
>    fiches, et par fiche marque / type / n° de série / localisation / avis général. Le format des réserves reste
>    inconnu : attendre un rapport Veritas **avec réserves** avant de coder. Extraction : dépendance à ajouter
>    (pdfjs-dist ou unpdf), à valider avec Nico.
>
> **Pièges de cette session** : les heredocs shell avec apostrophes échouent (utiliser Write/Edit ou un script .cjs
> dans le scratchpad) ; après chaque nouvelle route `npx next typegen` ; `git add` ciblé (jamais `-A` à la racine).

> Document de reprise pour une nouvelle session. Tout ce qui est écrit ici a été **vérifié** pendant la session précédente, sauf mention « non vérifié ». En cas de doute, relire le code ou interroger la base plutôt que se fier à ce texte. Lire aussi `briefing-service-technique.md` (référence fonctionnelle) et `README.md`.

## 1. Le projet

Outil interne « Jalon » pour le service technique d'un établissement de soin (1 utilisateur, 3 au maximum) : contrôles réglementaires, parc, interventions, contrats, rappels mail, stocks, statistiques. Anti-oubli, pas un outil de conformité. **Aucune donnée patient, aucune règle réglementaire inventée.** Interface 100 % française. Nico est le propriétaire ; réponses courtes, pas de récapitulatif de ce qui vient d'être fait, pas d'options multiples, tout en français.

## 2. Ce qui est livré (blocs du briefing)

Phase A (socle, auth, schéma, RLS, audit) et blocs B1 à B11 faits : contrôles, « Aujourd'hui », import Excel/CSV (avec association des colonnes), recherche Ctrl+K, rappels mail, parc + QR codes, interventions et chantiers, contrats et préavis, sauvegarde/restauration, statistiques, stocks. Ajouts : **univers** du parc (migration 9), identité visuelle « carnet de relevé » (bleu encre, orange jalon réservé à la marque, polices Archivo / Atkinson Hyperlegible Next / JetBrains Mono).

Qualité : 200 tests Vitest verts (unitaires + base PGlite), typage, lint, build de production OK au dernier commit de code (`4254c97`).

## 3. Architecture (à connaître avant de modifier)

- Next.js 16 (App Router, `src/proxy.ts` remplace middleware, CSP à nonce, rendu dynamique partout), TypeScript strict, Tailwind 4, shadcn **sur Base UI** (pas de `asChild` : utiliser `LienBouton`).
- Données : SQL direct (`postgres`) dans `src/lib/db.ts`. Chaque requête utilisateur passe par `avecUtilisateur` / `requete` (transaction + `set local role authenticated` + claims JWT) : **la RLS s'applique**. `avecServiceRole` réservé au cron.
- Auth : `AUTH_MODE=supabase` en production (Supabase Auth, 2FA TOTP obligatoire pour les admins ; sans aal2 un admin n'a que la lecture, côté base). `AUTH_MODE=local` en développement (choix d'un compte fictif, cookie signé HMAC) : refusé sur Vercel et avec une base distante (testé).
- Règles métier = fonctions pures dans `src/lib/metier/*`, testées. Échéances calculées en SQL (`v_plans_controle_echeance`) **et** en TypeScript, avec test de parité. Date du jour = Paris (`public.aujourdhui()`), jamais `current_date`.
- Migrations dans `supabase/migrations/` (9 fichiers, `20261006000100` à `…0900`). Ne jamais modifier une migration existante : en créer une nouvelle.
- Suppression physique interdite (droits + trigger) ; archivage via `archive_le` (admin seulement) ; `journal_audit` par triggers (aucune page pour le lire pour l'instant).
- Sauvegarde : `src/lib/sauvegarde.ts` liste toutes les tables (`TABLES`) ; un test échoue si une table est oubliée.

## 4. Production (vérifié le 06/10/2026)

- GitHub : `EpSyDev/Jalon`, privé, branche `main`. Vercel déploie `main` automatiquement.
- Vercel : projet `jalon`, https://jalon-eight.vercel.app, région `cdg1`. CLI Vercel connectée (compte `epsydev`) et projet lié. Variables définies (valeurs masquées) : `AUTH_MODE`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CRON_SECRET`, `APP_URL`. **Non définies** : `MAIL_MODE`, `RESEND_API_KEY`, `MAIL_EXPEDITEUR` (voulu pour l'instant) : le cron de 7 h répond donc 500 sans gravité tant que les mails ne sont pas configurés.
- Supabase : projet « Jalon », ref `akrhmgqpodbspbmvjmxx`, **région eu-west-1 (Irlande)**, pas Paris : à signaler à la DSI. Les 9 migrations sont appliquées, sans données fictives. Réglages auth : connexion mail activée, inscriptions fermées, mot de passe 12 caractères minimum, TOTP activé, `site_url` = adresse Vercel. Un compte existe (`nicolasschmitt30111@gmail.com`) avec le profil admin « Nicolas ».
- Le mot de passe de la base a été **régénéré** par l'assistant et écrit uniquement dans `DATABASE_URL` sur Vercel : il n'est stocké nulle part ailleurs. Pour `npm run sauvegarde` en production, régénérer l'URL (Supabase → Connect → Transaction pooler → Reset database password).
- Supabase CLI : **non connectée** par défaut (il faut un jeton `SUPABASE_ACCESS_TOKEN`, que Nico peut fournir temporairement puis révoquer). Les migrations ont été appliquées via l'API de gestion (`POST /v1/projects/<ref>/database/query`) en enregistrant la version dans `supabase_migrations.schema_migrations`. `npx supabase db push` exige le mot de passe de base.
- **Un jeton Supabase a été partagé dans la conversation précédente : Nico doit le révoquer** (Account → Access Tokens). Ne jamais le réutiliser sans nouvelle autorisation.
- État de la connexion réelle : Nico a pu se connecter et importer un fichier. L'enrôlement 2FA en conditions réelles n'a pas été vérifié explicitement (non vérifié).

## 5. Reste à faire (par ordre)

1. **Nico** : révoquer le jeton Supabase ; configurer Resend (domaine, région UE) ; obtenir le feu vert écrit de la DSI avant toute donnée réelle.
2. **Audit exécuté le 07/10/2026** sur la branche `audit-nuit` (pull request ouverte, non fusionnée) : lire `AUDIT.md`. Avant de fusionner : appliquer les migrations `20261007000100` et `20261007000200` en production (§5 de l'audit), poser les modèles de mail Supabase, puis tester les parcours réels (§6).
3. **Parc** : colonne « Univers » à l'import et action groupée faites sur `audit-nuit` ; reste à rattacher les équipements existants (sélection sur la liste du parc).
4. Idées gardées de côté (fonctions pratiques) : validation « Fait » directe depuis « Aujourd'hui », photos (nécessite l'accord DSI), flux iCal des échéances, installation en PWA, rappels par rôle, réserve → intervention en un clic. Décisions ouvertes : `AUDIT.md` §4.
5. Tests non faits : parcours 2FA réel, tests Playwright automatisés (prévus au briefing, jamais écrits).

## 6. Décisions à faire valider par Nico (proposées, notées au briefing)

Règle d'alerte de fin de contrat (limite de préavis = fin − préavis, même seuil que les contrôles) ; statuts de chantier ; indicateurs de la page Statistiques ; seuil d'alerte facultatif des articles de stock ; garde-fous de saisie (« conforme » = 0 réserve, dates jamais dans le futur).

## 7. Pièges rencontrés (gain de temps)

- Windows : le terminal Bash déforme les arguments commençant par `/` (curl) : exporter `MSYS_NO_PATHCONV=1`. Lancer le serveur de dev avec PowerShell `Start-Process -WindowStyle Hidden … npm run dev` (depuis Bash il ne reste pas actif). `npm run dev` lance la base locale **et** l'application.
- Les heredocs Bash contenant des apostrophes ou des gabarits `\1` échouent : préférer les outils Write/Edit. Prettier reformate le code : relire un fichier avant une édition par texte exact.
- Après avoir ajouté une route : `npx next typegen` (sinon `PageProps<…>` échoue au typage).
- Next 16 : on ne passe pas de fonction d'un composant serveur à un composant client ; `devIndicators` désactivé car il masquait l'interface mobile.
- Vercel masque les variables « Sensitive » : on ne peut pas les relire. La lecture des variables est tolérante (espaces, guillemets, `NOM=`, schéma `postgresql://` oublié) et le diagnostic affiche seulement la forme, jamais la valeur.
- Tests navigateur : toujours fermer Playwright et arrêter les serveurs par port (3000 application, 54329 base locale), jamais en tuant tous les processus node.
- Un seul Postgres local (PGlite) : migrations et seed rejoués par `npm run db:reset`.

## 8. Commandes utiles

```
npm run dev            # base locale + application (http://localhost:3000, comptes fictifs)
npm test               # 200 tests ; npm run typecheck ; npm run lint
npm run db:reset       # base locale vierge + seed fictif
npm run sauvegarde     # export JSON (DATABASE_URL requis pour la production)
npm run cron           # déclenche les rappels en local (mails dans .data/mails)
npx --no-install vercel ls | env ls | logs --environment production --since 10m --no-follow
```

## 9. Règles de travail de Nico (CLAUDE.md global)

Court et direct ; pas de récapitulatif ; `Edit` ciblé ; ne pas relire un fichier qu'on vient d'écrire ; annoncer avant tout agent (« Je vais lancer un agent pour X : tu confirmes ? ») ; pousser après chaque commit sur la branche courante ; stager les fichiers un par un ; proposer 2 ou 3 pistes à la fin d'une implémentation ; sécurité > efficience > ergonomie.

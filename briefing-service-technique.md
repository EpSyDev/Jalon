# BRIEFING : Outil de gestion du service technique (nom provisoire : « Jalon »)

> Document destiné à Claude Code. À lire en entier avant d'écrire la moindre ligne.
> Il sert de référence unique : en cas de doute, on revient ici.

---

## 1. Contexte

- **Utilisateur principal** : référent technique d'un établissement de soin.
- **Équipe** : 1 utilisateur au départ, 3 maximum à moyen terme. Uniquement le service technique.
- **Problème à résoudre** : l'information est dispersée (il faut « fouiller à droite et à gauche ») et il existe un risque permanent d'oublier une échéance (contrôles réglementaires, visites de maintenance, contrats).
- **Nature de l'outil** : outil interne **anti-oubli et anti-recherche**. Ce n'est PAS un outil destiné à être présenté à la HAS ou à une commission de sécurité. Pas d'exports de conformité en priorité.
- **Périmètre fonctionnel** : contrôles réglementaires, parc matériel, interventions/chantiers, contrats prestataires. Stocks et statistiques en squelette.
- **Biomédical** : le service ne fait que **suivre les prestataires** (contrats, visites, rapports, réserves). Aucune intervention directe à gérer.
- **Langue** : interface 100 % française (libellés, mails, messages d'erreur, formats de date `JJ/MM/AAAA`, fuseau `Europe/Paris`).

## 2. Principes produit (à respecter à chaque bloc)

1. **Révolutionnaire sur l'usage, sobre sur les données.** Innover sur l'ergonomie, jamais sur la fiabilité des dates, de l'historique et des calculs d'échéance.
2. **Rapidité** : toute action courante en moins de 10 secondes. Aucun écran de chargement inutile.
3. **Zéro friction** : peu de champs obligatoires, valeurs par défaut intelligentes, pré-remplissage.
4. **Proactivité** : l'outil vient chercher l'utilisateur (écran « Aujourd'hui », rappels mail), pas l'inverse.
5. **Retrouver en un geste** : recherche globale instantanée (Ctrl+K) sur tout objet.
6. **Mobile d'abord** : utilisable debout dans un local technique, d'une main.
7. **Pas de fonctionnalité spéculative.** Chaque module livré doit être utilisable réellement avant de passer au suivant.
8. **Ne jamais inventer de règle réglementaire.** Les périodicités et obligations viennent de l'utilisateur (voir annexe A). Aucune valeur par défaut « de mémoire ».

## 3. Contraintes non négociables

- **AUCUNE donnée patient**, nulle part (champs, commentaires, jeux de test). Vigilance sur les champs libres : prévoir un rappel visible dans l'UI.
- Données hébergées en **région UE**.
- L'outil **aide au suivi**, il ne « certifie » rien. Pas de mention de conformité garantie dans l'interface.
- Pas de code mort, pas de fonctionnalité non décrite ici sans validation.

### 3.1 Local d'abord

- Chaque bloc est **validé en local avant tout déploiement**, sans rien installer d'autre que Node :
  - base de développement = **PGlite persisté** dans `.data/` (vrai Postgres, mêmes migrations), servi par `npm run db` ;
  - connexion locale par choix d'un compte fictif (`AUTH_MODE=local`), **refusée par l'application** sur Vercel ou avec une base distante ;
  - mails écrits dans un dossier local et consultables dans l'application (bloc B5) ; cron déclenché par une commande ;
  - test mobile réel (QR codes) sur le wifi local.
- Restent à vérifier lors de la mise en ligne : connexion Supabase Auth + 2FA, envoi réel des mails, cron Vercel.
- **Aucune donnée réelle** (même technique) avant le feu vert écrit de la direction/DSI. D'ici là : seed fictif uniquement.
- `supabase db reset` doit rejouer migrations + seed de zéro sans erreur, à chaque commit touchant la base.

### 3.2 Hébergement UE, de bout en bout

- Supabase : région **Paris (`eu-west-3`)** ou Francfort.
- Vercel : les fonctions s'exécutent par défaut aux **États-Unis (`iad1`)** → forcer la région `cdg1` (Paris) dans `vercel.json`, sinon les données transitent hors UE.
- Resend : région d'envoi UE. Contenu des mails réduit au strict nécessaire (libellé + échéance + lien), jamais de commentaire libre.

### 3.3 Fiabilité des dates (la base est la dernière ligne de défense)

- Dates métier en `date`, horodatages en `timestamptz`. Jamais de `timestamp` sans fuseau.
- « Aujourd'hui » = date à **Paris** : en SQL `(now() at time zone 'Europe/Paris')::date` via la fonction `aujourdhui()`, **jamais `current_date`** (UTC sur Supabase : décalage d'un jour entre 0 h et 2 h).
- Contraintes `CHECK` en base, en plus de Zod : périodicité entre 1 et 120 mois, `date_fin ≥ date_debut`, `date_levee ≥ date_constat`, statut `levee` ⇔ `date_levee` renseignée, intervention `terminee`/`annulee` ⇔ `date_cloture` renseignée.
- Une date de réalisation de contrôle dans le futur est refusée (trigger).
- Le seuil « à échéance » (60 jours) est lu dans `parametres`, jamais codé en dur.

### 3.4 Sécurité renforcée

- **Pas d'inscription publique** : comptes créés uniquement par un admin (invitation). Nouveau compte = rôle `lecture` par défaut.
- **2FA TOTP obligatoire pour les admins** (Supabase Auth MFA), recommandée pour les autres.
- Suppression physique bloquée **au niveau des droits Postgres** (`REVOKE DELETE`), pas seulement dans l'UI. L'archivage est réservé aux admins (trigger).
- `journal_audit` : écrit uniquement par trigger `SECURITY DEFINER`, aucun droit d'écriture pour les rôles applicatifs, lecture admin.
- Clé `service_role` utilisée **uniquement** dans les routes cron/export, jamais dans un parcours utilisateur.
- Comparaison des secrets (cron, export) en temps constant.
- En-têtes HTTP : CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- `qr_token` aléatoire (122 bits), distinct de l'`id` ; la page reste derrière authentification.
- Champs libres limités en longueur (2 000 caractères) et accompagnés du rappel « aucune donnée patient ».
- RGPD : seules données personnelles = utilisateurs et contacts prestataires (nom, mail, téléphone). Rien d'autre.

### 3.5 Anti-oubli de l'outil lui-même

- Le **récapitulatif hebdomadaire part même s'il est vide** (« rien en retard cette semaine ») : l'absence de mail le lundi = l'outil est en panne. C'est le signal d'alerte.
- L'anti-doublon des rappels inclut la **date d'échéance** visée : un nouveau contrôle ouvre un nouveau cycle J-60/J-30/J-7.
- Si le cron rate un jour, le seuil franchi est rattrapé au passage suivant (on teste « échéance ≤ aujourd'hui + seuil » et non « = »).

## 4. Stack technique

| Couche | Choix |
|---|---|
| Framework | Next.js (App Router) + TypeScript strict |
| Hébergement | Vercel (déploiement dès le premier bloc) |
| Base de données | PostgreSQL via Supabase (free tier), **région UE** |
| Authentification | Supabase Auth (email + mot de passe, 2FA TOTP) en production ; mode local de développement |
| Sécurité des données | Row Level Security (RLS) activée sur toutes les tables |
| Accès aux données | SQL direct (`postgres`), chaque requête dans une transaction sous l'identité de l'utilisateur (`role authenticated` + claims) : la RLS s'applique comme via PostgREST, même code en local et en production. Migrations SQL versionnées dans `/supabase/migrations` |
| UI | Tailwind CSS + composants shadcn/ui |
| Validation | Zod (schémas partagés client/serveur) |
| Mails | Resend (ou équivalent), expéditeur sur un domaine à définir |
| Tâches planifiées | Vercel Cron (1 appel quotidien) vers une route sécurisée |
| Tests | Vitest pour la logique métier (échéances, statuts) ; Vitest + PGlite pour la base (migrations, RLS, audit, parité SQL/TS) ; Playwright pour 2-3 parcours critiques |
| Dates | `date-fns` (+ `date-fns-tz`), jamais de calcul de dates « à la main » |

**Pas de backend FastAPI** : tout reste dans Next.js (route handlers + server actions) pour limiter le nombre de pièces à maintenir.

**Fichiers/PDF** : pas d'upload en phase 1. Utiliser un champ texte `reference_rapport` (nom de fichier, chemin réseau ou lien vers la GED existante).

## 5. Modèle de données (socle)

Conventions : clés primaires `uuid`, colonnes `created_at`, `updated_at`, `created_by`, noms de tables et colonnes en français sans accents (`snake_case`), suppression logique (`archive_le`) plutôt que `DELETE`.

### 5.1 Référentiels

- `profils` : id (= auth.users.id), nom, role (`admin` | `technicien` | `lecture`).
- `localisations` : id, batiment, niveau, local, libelle_complet.
- `prestataires` : id, nom, contact_nom, email, telephone, notes.
- `familles_controle` : id, libelle (ex. électricité, SSI, ascenseurs…). Liste alimentée via l'annexe A.

### 5.2 Parc matériel

- `equipements` : id, code (unique, lisible), libelle, famille, localisation_id, marque, modele, numero_serie, date_mise_en_service, statut (`en_service` | `hors_service` | `reforme`), qr_token (unique), notes.

### 5.3 Contrôles réglementaires (cœur du MVP)

- `types_controle` : id, libelle, famille_id, **caractere** (`reglementaire` | `obligatoire` | `interne`), periodicite_mois, reference_texte (texte de loi ou référentiel, saisi par l'utilisateur), notes.
- `plans_controle` : id, type_controle_id, equipement_id (nullable : un contrôle peut porter sur une installation entière), perimetre_libelle, prestataire_id, contrat_id (nullable), periodicite_mois_surcharge (nullable), actif.
- `controles` : id, plan_controle_id, date_realisation, resultat (`conforme` | `avec_reserves` | `non_conforme`), nb_reserves_declare, reference_rapport, commentaire.
- `reserves` : id, controle_id, description, gravite (`mineure` | `majeure` | `critique`), date_constat, echeance_levee (nullable), date_levee (nullable), statut (`ouverte` | `levee`), commentaire.

> Le nombre de réserves affiché dans l'UI est **calculé** à partir de la table `reserves` (ouvertes / levées / total). `nb_reserves_declare` ne sert qu'à la saisie rapide : si rempli sans détail, créer des réserves « à détailler ».

### 5.4 Interventions et chantiers

- `interventions` : id, type (`corrective` | `preventive` | `autre`), titre, description, equipement_id (nullable), plan_controle_id (nullable), chantier_id (nullable), statut (`a_faire` | `en_cours` | `en_attente` | `terminee` | `annulee`), priorite (`basse` | `normale` | `haute` | `urgente`), date_demande, date_prevue, date_cloture, assignee_id, prestataire_id (nullable).
- `chantiers` : id, titre, description, statut (`prevu` | `en_cours` | `suspendu` | `termine` | `annule` — proposé, à valider), date_debut, date_fin_prevue, date_fin_reelle, responsable_id, notes.

### 5.5 Contrats

- `contrats` : id, prestataire_id, objet, reference, date_debut, date_fin, reconduction_tacite (bool), preavis_jours, montant_annuel (nullable), reference_document, notes.

### 5.6 Transverse

- `rappels_envoyes` : id, cible_type, cible_id, seuil (`J60` | `J30` | `J7` | `retard`), **echeance** (date visée), envoye_le. Unicité sur (cible_type, cible_id, seuil, echeance). Évite les doublons sans bloquer le cycle suivant.
- `journal_audit` : id, table_cible, enregistrement_id, action (`insert` | `update` | `archive`), utilisateur_id, avant (jsonb), apres (jsonb), cree_le. Alimenté par **triggers Postgres**, non modifiable depuis l'application.
- `parametres` : clé/valeur (seuils de rappel, destinataires, jour du récap hebdo).

### 5.7 Squelettes (tables créées, aucune logique pour l'instant)

- `articles_stock`, `mouvements_stock` : **vides**, module construit en dernier.
- Statistiques : prévoir uniquement des **vues SQL** à définir plus tard.

## 6. Règles métier

### 6.1 Calcul de l'échéance (à écrire en **vue SQL ET en fonction TypeScript testée**, mêmes résultats)

```
periodicite = plans_controle.periodicite_mois_surcharge ?? types_controle.periodicite_mois
dernier_controle = max(controles.date_realisation) du plan
prochaine_echeance = dernier_controle + periodicite mois
```

- Gérer la fin de mois (31 janvier + 1 mois = 28/29 février) via `date-fns` `addMonths`.
- Si aucun contrôle enregistré : statut **`jamais_controle`** (à traiter en priorité visuelle, c'est un trou à combler pendant l'amorçage).
- Ne **pas** stocker l'échéance en dur : toujours calculée (vue), pour éviter toute dérive.

### 6.2 Statut d'un plan de contrôle (axe « échéance »)

| Statut | Condition |
|---|---|
| `jamais_controle` | aucun contrôle enregistré |
| `en_retard` | échéance < aujourd'hui (échéance = aujourd'hui → encore `a_echeance`) |
| `a_echeance` | échéance ≤ aujourd'hui + seuil (`parametres.seuil_a_echeance_jours`, 60 par défaut) |
| `a_jour` | sinon |

Exclus du calcul et des alertes : plans inactifs ou archivés, types archivés, plans liés à un équipement `reforme` ou archivé.

Le calcul SQL repose sur deux fonctions immuables (`prochaine_echeance`, `statut_echeance`) testées avec **les mêmes cas** que la fonction TypeScript (test de parité automatique).

Un second axe, indépendant : **`reserves_ouvertes`** (au moins une réserve ouverte). Un contrôle peut donc être « à jour » ET « avec réserves ouvertes ». Afficher les deux.

### 6.3 Rappels par mail

- Cron quotidien (route `/api/cron/rappels`, protégée par secret `CRON_SECRET`).
- Seuils : **J-60, J-30, J-7** avant échéance + **récapitulatif hebdomadaire des retards** (lundi matin).
- Rappels aussi pour : fin de contrat (selon `preavis_jours`), réserves dont l'échéance de levée approche.
- Anti-doublon via `rappels_envoyes`. Seuils et destinataires dans `parametres`.
- Un seul mail récapitulatif par exécution plutôt qu'un mail par objet.

### 6.3 bis Alerte de fin de contrat (proposée, à valider)

- Date utile = **limite de préavis** = date de fin − préavis (jours) ; sans préavis, la date de fin.
- `echu` : date de fin passée · `preavis_depasse` : limite passée, fin à venir · `a_decider` : limite ≤ aujourd'hui + seuil (même seuil que les contrôles).
- Sans date de fin : aucune alerte. Fonction pure `alerteContrat`, testée.

### 6.4 Historique

- Un nouveau contrôle **crée une ligne**, il n'écrase jamais l'ancien.
- Suppression physique interdite côté application (archivage uniquement).
- Contrôle saisi par erreur : retiré (archivé) par un admin, tracé au journal ; l'échéance est recalculée.
- Garde-fous de saisie (pas des règles réglementaires) : « conforme » ⇒ 0 réserve, « avec réserves » ⇒ au moins 1 ; date de réalisation ou de levée jamais dans le futur.

## 7. Sécurité et rôles

- RLS sur toutes les tables, politiques testées.
- Rôles : `admin` (tout, y compris paramètres et utilisateurs), `technicien` (créer/modifier, pas supprimer ni paramétrer), `lecture`.
- Aucune clé secrète côté client. Variables d'environnement Vercel uniquement.
- Routes cron et webhooks protégées par secret.
- Entrées validées avec Zod côté serveur, systématiquement.
- **Sauvegarde indépendante** : script/route d'export complet (base en JSON ou CSV) à lancer périodiquement, stocké hors Vercel/Supabase. Plan de repli papier/Excel conservé pour les échéances critiques tant que l'outil n'a pas fait ses preuves.

## 8. Écrans et expérience

1. **Aujourd'hui** (page d'accueil) : retards, échéances à 60 jours, réserves ouvertes, interventions urgentes, contrats arrivant à terme. Classé par priorité, actions directes (« j'ai fait le contrôle ») depuis la liste.
2. **Recherche globale (Ctrl+K / bouton sur mobile)** : équipements, contrôles, prestataires, contrats, interventions. Tolérante aux fautes et accents.
3. **Saisie rapide d'un contrôle** : formulaire minimal (plan, date, résultat, nb réserves, référence rapport). Pré-remplir la date du jour et la périodicité. En option plus tard : saisie en phrase libre avec pré-remplissage, toujours validée par l'utilisateur.
4. **Fiche équipement** accessible par **QR code** (page publique interdite : authentification obligatoire) : historique, contrôles liés, interventions, bouton « déclarer une intervention ».
5. **Import Excel/CSV** (équipements, types et plans de contrôle) avec prévisualisation, détection des erreurs ligne par ligne, et aucun import silencieux.
6. Design sobre, sombre/clair automatique, gros éléments tactiles, navigation basse sur mobile.

## 9. Plan de réalisation

### Phase A : socle (génération en une seule passe)

Claude Code génère, sans logique métier approfondie :

- Projet Next.js + TypeScript + Tailwind + shadcn/ui, structure de dossiers, lint, formatage.
- Connexion Supabase, authentification, middleware de protection, rôles.
- **Schéma complet** (section 5) en migrations SQL, RLS, triggers d'audit.
- Navigation (desktop + mobile) et **squelettes de pages** pour chaque module.
- Seed de **données fictives** (aucune donnée réelle, aucune donnée patient).
- `README.md` : installation, variables d'environnement, déploiement Vercel.
- Premier déploiement fonctionnel.

**Validation Phase A** : en local d'abord (tests PGlite verts, `next build` OK, connexion des 3 rôles en mode local), puis seulement déploiement Vercel accessible.

### Phase B : finalisation, un bloc à la fois (on valide, puis on passe au suivant)

| Bloc | Contenu | Critère de validation |
|---|---|---|
| B1 | Contrôles réglementaires : types, plans, saisie d'un contrôle, réserves, calcul des échéances et statuts | Tests unitaires verts sur les cas limites (fin de mois, jamais contrôlé, surcharge de périodicité) |
| B2 | Écran « Aujourd'hui » | Les retards et échéances proches s'affichent et correspondent aux données |
| B3 | Import Excel/CSV | Import réel de la liste exhaustive, erreurs lisibles |
| B4 | Recherche globale Ctrl+K | Résultat pertinent en moins d'une seconde sur les données réelles |
| B5 | Rappels mail (cron, anti-doublon, récap hebdo) | Mails reçus en test, aucun doublon sur deux exécutions |
| B6 | Parc matériel + QR codes | Scan mobile → fiche en moins de 3 secondes |
| B7 | Interventions et chantiers | Cycle complet création → clôture |
| B8 | Contrats et préavis | Alerte de fin de contrat reçue |
| B9 | Sauvegarde/export indépendant | Restauration testée une fois |
| B10 | Statistiques | Indicateurs à définir ensemble |
| B11 | Stocks | Construit en dernier |

**Règle** : on n'ouvre pas le bloc suivant tant que le précédent n'est pas utilisé et validé par l'utilisateur.

## 10. Règles de travail pour Claude Code

1. Lire ce document avant chaque session ; proposer une mise à jour de ce fichier quand une décision est prise.
2. Un bloc à la fois, un commit par étape logique, messages de commit en français clair.
3. Toute règle métier = fonction pure + tests. Pas de logique métier dans les composants UI.
4. Ne rien supposer sur la réglementation : demander ou laisser le champ configurable.
5. Avant d'écrire du code, annoncer en quelques lignes ce qui va être fait et quels fichiers sont touchés.
6. Signaler toute ambiguïté plutôt que deviner. Ne pas ajouter de fonctionnalité non listée.
7. Ne jamais journaliser ni afficher de secrets ; ne jamais committer `.env`.
8. En cas de limite technique (Vercel Hobby, Supabase free tier : pause d'inactivité, quotas), le dire explicitement au lieu de contourner.

## 11. Points ouverts

- Nom définitif de l'outil et nom de domaine.
- Feu vert écrit de la direction/DSI pour l'hébergement externe des données techniques (à obtenir avant toute donnée réelle).
- Plan Vercel : le plan Hobby est restreint à un usage non commercial ; vérifier que l'usage professionnel interne est autorisé, sinon prévoir le plan payant.
- Supabase free tier : mise en pause après 7 jours d'inactivité — le cron quotidien interroge la base et suffit à l'éviter. **En revanche le free tier n'offre aucune sauvegarde téléchargeable** : le bloc B9 (export indépendant) est indispensable avant toute donnée réelle, ou passer au plan Pro.
- Vercel Hobby : cron limité à 1 exécution/jour, précision à l'heure près. Suffisant ici.
- Hébergement de données de santé (HDS) : a priori non requis puisqu'aucune donnée patient — **à confirmer par écrit avec la DSI**.
- Statuts des chantiers (proposés ci-dessus) à valider.
- Liste exhaustive des contrôles à fournir (annexe A).
- Indicateurs statistiques (B10).

---

## Annexe A : Liste des contrôles et équipements (à compléter par l'utilisateur)

Tableau à remplir ; sert aussi de **fichier d'import initial** (bloc B3).

| Famille | Libellé du contrôle | Périmètre / équipement | Caractère (réglementaire / obligatoire / interne) | Périodicité (mois) | Référence du texte | Prestataire |
|---|---|---|---|---|---|---|
| | | | | | | |

## Annexe B : Contrats prestataires (à compléter)

| Prestataire | Objet | Début | Fin | Reconduction tacite | Préavis (jours) |
|---|---|---|---|---|---|
| | | | | | |

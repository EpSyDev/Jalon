# Audit de Jalon : 07/10/2026 (branche `audit-nuit`)

Classement : **sécurité > fiabilité des dates > ergonomie terrain > performance**. « Corrigé » = commité sur
`audit-nuit`, testé (236 tests Vitest, typage, lint, build de production verts). Rien n'a été touché en production.

## 1. Constats

### Sécurité

| # | Constat | Statut |
|---|---|---|
| S1 | La CSP de production (`style-src` au nonce) bloque tout attribut `style` : **les barres des graphiques de Statistiques n'ont aucune hauteur en production** (en-tête vérifié sur jalon-eight.vercel.app). | Corrigé : `style-src-attr 'unsafe-inline'`, les balises `<style>` restent au nonce. |
| S2 | Aucune limitation des tentatives. Celles de Supabase Auth comptent par IP de l'appelant, c'est-à-dire le serveur Vercel : elles ne distinguent pas l'attaquant de l'utilisateur. | Corrigé (migration 0100) : 5 échecs par adresse et 30 par IP sur 15 min, 5 codes 2FA faux par compte, 3 demandes « mot de passe oublié » par heure. Empreintes SHA-256 seulement, purge à 24 h, schéma `prive` non exposé. Si la migration manque, la connexion reste possible. |
| S3 | Niveau 2FA (`aal`) lu par `getAuthenticatorAssuranceLevel`, sans revérifier la signature. | Corrigé : lu dans les claims vérifiés par `getClaims`. |
| S4 | Pas de page d'invitation ni de « mot de passe oublié ». Avec le modèle de mail par défaut et le rendu serveur, un lien d'invitation n'aboutit à rien d'utilisable (fonctionnement standard de Supabase, non vérifié en réel). | Corrigé : `/connexion/lien` (le lien n'est consommé qu'au clic, à l'abri des analyseurs de liens d'Outlook), `/connexion/oubli`, `/connexion/mot-de-passe`. **Nécessite les modèles de mail et un SMTP (§6).** |
| S5 | Les mails de rappel reprenaient la description des réserves (texte libre), contraire au briefing §3.2. | Corrigé : « Réserve <gravité> — <contrôle> ». Test dédié. |
| S6 | Cron : le secret était lu avec la configuration des mails. Sans mails, toute requête (même non autorisée) recevait une erreur 500. | Corrigé : secret lu seul. Sans mails, réponse 200 `statut: "non_configure"` ; la base est lue, ce qui évite la mise en pause de Supabase. Bandeau admin sur « Aujourd'hui ». |
| S7 | Après connexion et 2FA, retour forcé à l'accueil : le scan d'un QR code perdait l'équipement visé. | Corrigé : la page demandée est conservée jusqu'au bout. |
| — | **Reste** : parcours Supabase réels jamais testés (connexion, 2FA, invitation, oubli, limitation). Liste de contrôle au §6. | À faire par Nico |
| — | **Reste** : l'API de données Supabase (PostgREST) expose le schéma `public`, inutile à Jalon (accès SQL direct). La RLS protège déjà ; désactiver l'API retire une surface d'attaque. | À faire par Nico (réglage) |
| — | **Reste** : la page 2FA recrée un facteur à chaque affichage tant que le premier n'est pas validé (le QR change au rechargement). Sans risque. | Connu |

### Fiabilité des dates

| # | Constat | Statut |
|---|---|---|
| D1 | Dates de levée, de clôture, de fin réelle, de mouvement et de mise en service : « jamais dans le futur » vérifié par Zod seulement. | Corrigé (migration 0200) : trigger en base, date de Paris, message lisible. |
| D2 | Vérifié sans défaut : `aujourdhui()` (Paris) partout, parité SQL/TS des échéances (fin de mois), anti-doublon des rappels par échéance, statistiques mensuelles cohérentes avec le fuseau. | OK |

### Ergonomie terrain

| # | Constat | Statut |
|---|---|---|
| E1 | Import : pas de colonne « Univers ». | Corrigé : colonne facultative, univers créé une seule fois (accents, casse, ponctuation tolérés). |
| E2 | Import : un code avec espace était accepté, mais l'équipement ne pouvait plus être modifié (le formulaire refuse les espaces). Textes trop longs : erreur générique à l'enregistrement. | Corrigé : même règle de code qu'à la saisie, longueurs vérifiées ligne par ligne. **Si des équipements déjà importés ont un code avec espace, leur modification est bloquée** : renommer le code. |
| E3 | Équipements sans univers, aucune action groupée. | Corrigé : mode sélection sur le parc (univers, localisation, statut de 500 équipements au plus, chaque ligne tracée au journal). |
| E4 | Journal d'audit illisible (aucune page). | Corrigé : page « Journal » (admin) et historique sur les fiches équipement, plan (avec ses contrôles et réserves) et contrat. |
| E5 | Réseau faible : une coupure pendant un enregistrement affichait une page d'erreur et la saisie était perdue. | Corrigé : bandeau « Hors ligne », message clair, saisie conservée (testé en coupant le réseau). |
| E6 | Pastilles de filtre de 32 px de haut. Pas de lien d'évitement au clavier. | Corrigé : 44 px, lien « Aller au contenu ». |
| — | **Reste** : pas de consultation hors ligne (installable en PWA). Pas de tests Playwright automatisés (parcours testés à la main dans un navigateur piloté). | Décision 5 |

### Performance

| # | Constat | Statut |
|---|---|---|
| P1 | Import : un aller-retour base par ligne (fonctions à Paris, base à Dublin). Un fichier de quelques milliers de lignes risquait le délai maximal de Vercel. | Corrigé : lots de 500 (1 200 lignes testées). |
| P2 | Liste du parc non paginée. | Corrigé : 100 par page, total exact, filtres conservés. |
| P3 | Clés étrangères sans index (interventions → chantier, plan ; plans → prestataire, contrat). | Corrigé (migration 0200). |
| — | Recherche (normalisation à chaque frappe) et vue des échéances (recalculée à chaque page) : suffisants à l'échelle d'un service (quelques milliers d'objets). Journal sans purge : quelques Mo par an. | À surveiller |

### Code

Cinq copies des mêmes briques Zod regroupées dans `src/lib/metier/saisie.ts`. Nouveau harnais de test
`tests/db/pilote.ts` : les requêtes de l'application passent par le vrai pilote `postgres` sur PGlite, sous RLS.

## 2. Ce que font les GMAO, et ce qui sert Jalon

Carl Source et Coswin (GMAO hospitalières lourdes : arborescences, magasins, budgets), MaintainX, UpKeep et Limble
(mobile, checklists, demandes par QR), Fiix et Maintenance Connection (coûts, indicateurs de fiabilité),
Infraspeak (QR et prestataires), Hippo (plans d'étage). Jalon ne doit pas les rattraper : son terrain est
l'anti-oubli des échéances pour une équipe de 1 à 3 personnes.

| Piste | Valeur | Coût | Risque | Décision |
|---|---|---|---|---|
| Export Excel des listes | Forte (plan de repli Excel, direction) | Faible | Nul | **Fait** (parc filtré, échéances) |
| Demande d'intervention depuis le QR, même pour un compte lecture | Forte (les collègues signalent) | Moyen (droits) | Un compte lecture qui écrit | Décision 2 |
| Criticité des équipements, tri des alertes | Moyenne (le caractère réglementaire trie déjà) | Faible | Une saisie de plus | Plus tard, si le parc dépasse 300 équipements |
| Coût et temps passé par équipement / univers | Moyenne (arbitrer un remplacement) | Moyen | Champs jamais remplis | Décision 4 |
| Modèles d'intervention avec checklist | Moyenne | Moyen | Lourdeur ; les prestataires font l'essentiel | Plus tard, sur un cas concret de tournée interne |
| Plans préventifs générant des interventions | Faible : les plans de contrôle et leurs échéances le font déjà | Moyen | Doublons | Non |
| Arborescence jusqu'aux composants | Faible aujourd'hui (univers et familles existent) | Moyen | Spéculatif | Non |
| Tableau de bord par univers | Moyenne | Faible | Nul | En partie (pastilles et export par univers) |
| Calendrier iCal à s'abonner | Moyenne | Faible | URL secrète hors authentification | Décision 3 |
| Vue semaine | Faible (« Aujourd'hui » et la tournée couvrent) | Faible | Nul | Non |

## 3. Idées propres à Jalon

| Idée | Statut |
|---|---|
| **Jalon du jour** : une action recommandée et sa raison, par un ordre de priorité écrit (pas de score) | Fait, décision 1 |
| **Une seule visite ?** : contrôles d'un même prestataire dans la même fenêtre | Fait |
| **Détecteur d'oubli silencieux** (`/verifications`) : plus de 2 périodes sans contrôle, réserves « à détailler », contrôles réglementaires sans prestataire, contrats sans fin, équipements sans contrôle | Fait |
| **Journal lisible sur chaque fiche** | Fait (admin) |
| **Mode tournée** : local par local, « Conforme » en deux touches | Fait |
| **Passage de relais** : état du service imprimable | Fait |
| Relecture hebdomadaire de 2 minutes | Non faite : recoupe « Aujourd'hui » et `/verifications`. Plus utile : « Lever » une réserve en un geste depuis « Aujourd'hui » |

## 4. Décisions pour Nico

1. **Ordre du jalon du jour** (`src/lib/metier/aujourdhui.ts`) : préavis de contrat à moins de 14 jours, puis
   retard (réglementaire, obligatoire, interne ; le plus ancien), réserve critique dépassée, intervention urgente,
   jamais contrôlé, préavis plus lointain, échéance la plus proche. *Recommandation : valider tel quel.*
2. **Demande d'intervention par un compte « lecture »** depuis le QR (création seule, statut « à faire »,
   priorité normale). Demande une politique RLS dédiée. *Recommandation : oui, c'est l'usage n° 1 du QR pour les collègues.*
3. **Flux iCal des échéances** : impose une adresse secrète lisible sans connexion. *Recommandation : non tant que
   la DSI n'a pas validé l'hébergement.*
4. **Coût et temps passé** sur les interventions. *Recommandation : non, sauf besoin précis d'arbitrage budgétaire.*
5. **2FA pour tous les comptes** et **installation en PWA** (consultation hors ligne). *Recommandation : 2FA pour
   tous, oui (coût nul) ; PWA plus tard.*

## 5. Migrations à appliquer en production (dans l'ordre, avant de fusionner)

Relues ligne par ligne, rejouées de zéro par les tests. Même procédure que les précédentes (API de gestion ou
`npx supabase db push`, puis version enregistrée dans `supabase_migrations.schema_migrations`).

1. `20261007000100_limitation_connexion.sql` : schéma `prive`, table `tentatives_connexion`, fonctions
   `limite_atteinte` et `noter_echec` (`security definer`, exécutables par `service_role` seulement). Ne touche à
   aucune donnée existante.
2. `20261007000200_garde_fous_dates.sql` : fonction `refuser_date_future`, 5 triggers (écritures de la colonne de
   date seulement), 4 index. Avant d'appliquer, vérifier qu'aucune donnée n'a déjà une date future (sinon sa
   prochaine modification serait refusée) ; résultat attendu : 0.

   ```sql
   select (select count(*) from reserves where date_levee > aujourdhui())
        + (select count(*) from interventions where date_cloture > aujourdhui())
        + (select count(*) from chantiers where date_fin_reelle > aujourdhui())
        + (select count(*) from mouvements_stock where date_mouvement > aujourdhui())
        + (select count(*) from equipements where date_mise_en_service > aujourdhui()) as dates_futures;
   ```

Le code tolère l'absence de la migration 0100 (journal d'erreur, pas de blocage) ; la 0200 ne conditionne aucun
écran. Les appliquer avant la fusion reste la bonne pratique.

## 6. À faire par Nico (hors code)

1. Révoquer le jeton Supabase partagé précédemment.
2. Supabase → Authentication → Emails : poser les modèles « Invite user » et « Reset password » (README, §Déploiement).
3. Configurer un SMTP (Resend, région UE) : le service intégré de Supabase n'envoie qu'aux membres de l'équipe du
   projet, quelques mails par heure. Puis `MAIL_MODE`, `RESEND_API_KEY`, `MAIL_EXPEDITEUR` sur Vercel.
4. Tester en réel, après fusion : connexion ; 6 mots de passe faux → « Trop de tentatives » ; enrôlement 2FA admin ;
   scan d'un QR code déconnecté → retour sur l'équipement après 2FA ; invitation d'un compte ; « mot de passe oublié ».
5. Supabase → Settings → Data API : désactiver l'API ou retirer `public` des schémas exposés.
6. Feu vert écrit de la DSI avant toute donnée réelle ; région Supabase eu-west-1 (Irlande) à lui signaler.

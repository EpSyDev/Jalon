# Tâche autonome : audit complet de Jalon et montée en gamme

> À lire en entier, avec `briefing-service-technique.md` et `README.md`. Modèle visé : Opus 5.5, effort maximal.
> Utilisateur : Nico, parle français, veut des réponses courtes. Tout en français dans l'interface.

## Garde-fous (non négociables)

1. **Travailler sur la branche `audit-nuit`**, jamais sur `main` (main déploie en production sur Vercel). Aucun `git push` sur main.
2. Aucune donnée réelle ni patient. Aucune règle réglementaire inventée (les périodicités viennent de l'utilisateur).
3. Aucun secret lu, écrit ou affiché. Ne pas toucher aux variables Vercel ni aux réglages Supabase de production.
4. Toute migration SQL est **nouvelle** (jamais modifier une migration existante), rejouable de zéro, testée en PGlite (`npm test`). Elle sera appliquée à la production par Nico après relecture : le dire explicitement dans le rapport.
5. À chaque étape : `npx tsc --noEmit`, `npx eslint`, `npm test` verts ; un commit par étape logique en français.
6. Tests navigateur autorisés en local (`npm run dev`), mais **fermer Playwright** et arrêter les serveurs par port après usage.
7. Ne pas ajouter de dépendance lourde ni de service externe sans le signaler. Pas d'upload de fichiers (feu vert DSI requis).

## Phase 1 : audit (produire `AUDIT.md`, court et priorisé)

Faire le tour du code, des migrations, des tests et de l'UX, et classer par gravité **sécurité > fiabilité des dates/échéances > ergonomie terrain > performance**. Points faibles déjà connus à vérifier et corriger en priorité :

- **2FA/Supabase réel jamais testé** : relire `src/lib/auth.ts`, la page `connexion/2fa`, le comportement avec un admin sans MFA, les boucles de redirection possibles.
- **Page d'invitation / définition du mot de passe** inexistante (comptes créés à la main) ; pas de « mot de passe oublié ».
- **Pas de limitation de débit** applicative sur la connexion (compter sur Supabase ?), vérifier l'enveloppe CSP en production.
- **Import** : l'univers n'est pas géré ; pas de colonne « univers » ; déplacement en masse d'équipements impossible.
- **Équipements existants sans univers** ; pas d'action groupée (changer univers/localisation/statut de plusieurs équipements).
- **Accessibilité** (focus, contrastes en sombre, libellés ARIA), cibles tactiles, hors-ligne/réseau faible (local technique).
- **Performance** : requêtes N+1 éventuelles, index manquants, pagination des listes (équipements, journal, mouvements).
- **Journal d'audit** : aucune page pour le consulter (alors qu'il existe). Utile pour « qui a changé cette échéance ».
- **Cron** : renvoie 500 si les mails ne sont pas configurés ; préférer une réponse explicite.
- **Doublons de code** dans les pages (formulaires, listes) : extraire ce qui est répété seulement si cela simplifie.
- Chercher aussi tout ce qui n'est pas listé ici (erreurs de logique, cas limites de dates, fuseau Paris, RLS, droits `anon`).

## Phase 2 : s'inspirer des GMAO existantes pour mieux faire

Passer en revue ce que font les GMAO courantes (Carl Source, Coswin, Mainsys, Infraspeak, MaintainX, Fiix, UpKeep, Limble, Hippo CMMS, Maintenance Connection) et ne retenir que ce qui sert **un référent technique seul à trois dans un établissement de soin**. Pistes à évaluer (chacune : valeur, coût, risque, décision) :

- ordres de travail avec checklists réutilisables (modèles d'intervention) ;
- plans de maintenance préventive générant des interventions ;
- historique de coût et temps passé par équipement/univers ;
- criticité des équipements et tri des alertes par criticité ;
- arborescence (univers → famille → équipement → composants) et nomenclature ;
- demande d'intervention simplifiée (formulaire minimal depuis le QR, y compris pour un collègue en lecture) ;
- tableau de bord par univers ; export Excel des listes ;
- calendrier des échéances (flux iCal à s'abonner) ; vue semaine.

Règle : **transcender, pas copier**. Garder la sobriété du produit (principes 1 à 8 du briefing). Pas de fonctionnalité spéculative : chaque ajout doit être utilisable réellement et testé.

## Phase 3 : idées propres à Jalon (à concevoir, valider par le sens, implémenter les meilleures)

Idées de départ, à challenger et compléter avec les tiennes :

- **« Jalon du jour »** : une seule action recommandée en tête de l'écran Aujourd'hui, expliquée (« pourquoi celle-ci »), sans score inventé.
- **Anticipation des regroupements** : suggérer de grouper les contrôles d'un même prestataire à échéances proches (une seule visite).
- **Détecteur d'oubli silencieux** : signaler les plans actifs jamais rattachés à un prestataire, contrats sans date de fin, équipements sans plan, plans sans contrôle depuis > 2 périodes.
- **Journal lisible sur chaque fiche** (« Qui a changé quoi et quand »), issu de `journal_audit`.
- **Mode « tournée »** : liste des contrôles à faire par localisation, cochables d'une main, pour passer d'un local à l'autre.
- **Relecture hebdomadaire de 2 minutes** : écran qui passe en revue les réserves ouvertes et contrats à décider, en un geste chacun.
- **Passage de relais** : fiche synthétique imprimable/PDF « état du service » pour un remplaçant (retards, contrats, prestataires clés).

## Livrables

1. `AUDIT.md` : constats priorisés, ce qui est corrigé, ce qui reste.
2. Corrections et améliorations commitées sur `audit-nuit`, tests verts.
3. `AUDIT.md` : section « Décisions pour Nico » (3 à 5 choix, avec ta recommandation), section « Migrations à appliquer en production » (liste ordonnée, chaque fichier relu).
4. Mise à jour de `briefing-service-technique.md` (décisions) et du `README.md` si besoin.
5. Ouvrir une pull request `audit-nuit` → `main` **sans la fusionner**, description en français.

Réponse finale à Nico : courte, 10 lignes maximum, avec le lien de la PR et les 3 changements les plus utiles.

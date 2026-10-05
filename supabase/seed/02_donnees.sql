-- Données FICTIVES de démonstration. Aucune donnée réelle, aucune donnée patient.
-- Les périodicités ci-dessous sont des exemples, PAS des valeurs réglementaires.
-- Dates relatives à aujourd'hui pour couvrir tous les statuts.

insert into public.familles_controle (libelle) values
  ('Électricité'), ('Sécurité incendie'), ('Ascenseurs'), ('Biomédical'), ('Fluides');

insert into public.localisations (batiment, niveau, local) values
  ('Bâtiment A', 'RDC', 'Local TGBT'),
  ('Bâtiment A', 'R+1', 'Couloir est'),
  ('Bâtiment B', 'Sous-sol', 'Chaufferie'),
  ('Bâtiment B', 'RDC', 'Hall');

insert into public.prestataires (nom, contact_nom, email, telephone) values
  ('Élec Contrôle Exemple', 'M. Dupont', 'contact@elec-exemple.test', '01 00 00 00 01'),
  ('Ascenseurs Démo', 'Mme Martin', 'sav@ascenseurs-demo.test', '01 00 00 00 02'),
  ('BioMaint Fictif', 'M. Leroy', 'planning@biomaint.test', '01 00 00 00 03');

insert into public.contrats (prestataire_id, objet, reference, date_debut, date_fin, reconduction_tacite, preavis_jours, montant_annuel)
select p.id, c.objet, c.ref, public.aujourdhui() + c.debut, public.aujourdhui() + c.fin, c.tacite, c.preavis, c.montant
from (values
  ('Élec Contrôle Exemple', 'Vérifications électriques périodiques', 'CTR-ELEC-01', -700, 30, true, 90, 4800.00),
  ('Ascenseurs Démo', 'Maintenance ascenseurs', 'CTR-ASC-01', -300, 400, false, 60, 9600.00),
  ('BioMaint Fictif', 'Suivi maintenance biomédicale', 'CTR-BIO-01', -100, 600, true, 30, null)
) as c (prestataire, objet, ref, debut, fin, tacite, preavis, montant)
join public.prestataires p on p.nom = c.prestataire;

insert into public.equipements (code, libelle, famille_id, localisation_id, marque, modele, statut)
select e.code, e.libelle, f.id, l.id, e.marque, e.modele, e.statut
from (values
  ('TGBT-A', 'Tableau général basse tension A', 'Électricité', 'Bâtiment A / RDC / Local TGBT', 'Marque X', 'TG-400', 'en_service'),
  ('ASC-B1', 'Ascenseur hall B', 'Ascenseurs', 'Bâtiment B / RDC / Hall', 'Marque Y', 'Lift 8', 'en_service'),
  ('CHAUD-B', 'Chaudière gaz B', 'Fluides', 'Bâtiment B / Sous-sol / Chaufferie', 'Marque Z', 'CG-90', 'en_service'),
  ('ECL-SEC-A1', 'Bloc éclairage sécurité couloir est', 'Sécurité incendie', 'Bâtiment A / R+1 / Couloir est', 'Marque W', 'BAES-1', 'hors_service'),
  ('ANC-01', 'Ancien groupe froid', 'Fluides', 'Bâtiment B / Sous-sol / Chaufferie', 'Marque V', 'GF-2', 'reforme')
) as e (code, libelle, famille, localisation, marque, modele, statut)
join public.familles_controle f on f.libelle = e.famille
join public.localisations l on l.libelle_complet = e.localisation;

insert into public.types_controle (libelle, famille_id, caractere, periodicite_mois, reference_texte)
select t.libelle, f.id, t.caractere, t.periodicite, 'Donnée fictive — à remplacer par la référence réelle'
from (values
  ('Vérification installations électriques (exemple)', 'Électricité', 'reglementaire', 12),
  ('Thermographie TGBT (exemple)', 'Électricité', 'interne', 24),
  ('Visite ascenseur (exemple)', 'Ascenseurs', 'reglementaire', 6),
  ('Contrôle chaudière (exemple)', 'Fluides', 'obligatoire', 12),
  ('Contrôle éclairage de sécurité (exemple)', 'Sécurité incendie', 'reglementaire', 12),
  ('Visite prestataire biomédical (exemple)', 'Biomédical', 'obligatoire', 12)
) as t (libelle, famille, caractere, periodicite)
join public.familles_controle f on f.libelle = t.famille;

insert into public.plans_controle (type_controle_id, equipement_id, perimetre_libelle, prestataire_id, contrat_id, periodicite_mois_surcharge)
select t.id, e.id, p.perimetre, pr.id, c.id, p.surcharge
from (values
  ('Vérification installations électriques (exemple)', null, 'Ensemble du site', 'Élec Contrôle Exemple', 'CTR-ELEC-01', null),
  ('Thermographie TGBT (exemple)', 'TGBT-A', null, 'Élec Contrôle Exemple', 'CTR-ELEC-01', 12),
  ('Visite ascenseur (exemple)', 'ASC-B1', null, 'Ascenseurs Démo', 'CTR-ASC-01', null),
  ('Contrôle chaudière (exemple)', 'CHAUD-B', null, null, null, null),
  ('Contrôle éclairage de sécurité (exemple)', 'ECL-SEC-A1', null, null, null, null),
  ('Visite prestataire biomédical (exemple)', null, 'Parc biomédical', 'BioMaint Fictif', 'CTR-BIO-01', null),
  ('Contrôle chaudière (exemple)', 'ANC-01', null, null, null, null)
) as p (type_libelle, equipement_code, perimetre, prestataire, contrat_ref, surcharge)
join public.types_controle t on t.libelle = p.type_libelle
left join public.equipements e on e.code = p.equipement_code
left join public.prestataires pr on pr.nom = p.prestataire
left join public.contrats c on c.reference = p.contrat_ref;

-- Contrôles : électricité en retard, thermographie à échéance, ascenseur à jour (avec réserves),
-- chaudière à jour, éclairage et biomédical jamais contrôlés.
insert into public.controles (plan_controle_id, date_realisation, resultat, nb_reserves_declare, reference_rapport)
select pl.id, public.aujourdhui() + c.decalage, c.resultat, c.nb, c.rapport
from (values
  ('Vérification installations électriques (exemple)', -400, 'avec_reserves', 2, 'GED/Elec/2025-rapport.pdf'),
  ('Vérification installations électriques (exemple)', -800, 'conforme', 0, 'GED/Elec/2024-rapport.pdf'),
  ('Thermographie TGBT (exemple)', -340, 'conforme', 0, 'GED/Thermo/rapport.pdf'),
  ('Visite ascenseur (exemple)', -30, 'avec_reserves', 1, 'GED/Asc/visite.pdf'),
  ('Contrôle chaudière (exemple)', -90, 'conforme', 0, null)
) as c (type_libelle, decalage, resultat, nb, rapport)
join public.types_controle t on t.libelle = c.type_libelle
join public.plans_controle pl on pl.type_controle_id = t.id and pl.equipement_id is distinct from (select id from public.equipements where code = 'ANC-01');

insert into public.reserves (controle_id, description, gravite, date_constat, echeance_levee, date_levee, statut)
select c.id, r.description, r.gravite, c.date_realisation, c.date_realisation + r.delai, r.levee, r.statut
from (values
  ('Vérification installations électriques (exemple)', -400, 'Repérage des circuits à compléter (exemple)', 'mineure', 90, null::date, 'ouverte'),
  ('Vérification installations électriques (exemple)', -400, 'Protection différentielle à remplacer (exemple)', 'majeure', 30, public.aujourdhui() - 350, 'levee'),
  ('Visite ascenseur (exemple)', -30, 'À détailler', null, 60, null::date, 'ouverte')
) as r (type_libelle, decalage, description, gravite, delai, levee, statut)
join public.types_controle t on t.libelle = r.type_libelle
join public.plans_controle pl on pl.type_controle_id = t.id
join public.controles c on c.plan_controle_id = pl.id and c.date_realisation = public.aujourdhui() + r.decalage;

insert into public.chantiers (titre, description, statut, date_debut, date_fin_prevue, responsable_id)
values ('Rénovation éclairage couloir est (exemple)', 'Remplacement des blocs BAES', 'en_cours',
  public.aujourdhui() - 10, public.aujourdhui() + 20, '00000000-0000-4000-a000-000000000002');

insert into public.interventions (type, titre, equipement_id, chantier_id, statut, priorite, date_demande, date_prevue, assignee_id)
select i.type, i.titre, e.id, ch.id, i.statut, i.priorite, public.aujourdhui() + i.demande, public.aujourdhui() + i.prevue,
  '00000000-0000-4000-a000-000000000002'
from (values
  ('corrective', 'BAES couloir est hors service', 'ECL-SEC-A1', true, 'en_cours', 'urgente', -3, 1),
  ('preventive', 'Nettoyage filtres chaudière', 'CHAUD-B', false, 'a_faire', 'normale', -1, 14)
) as i (type, titre, equipement_code, lie_chantier, statut, priorite, demande, prevue)
join public.equipements e on e.code = i.equipement_code
left join public.chantiers ch on i.lie_chantier;

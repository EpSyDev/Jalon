-- Prestataires : intervention sous contrat ou sur devis (tous n'ont pas de contrat, certains reviennent chaque année
-- sur devis). Non renseigné (null) tant que l'utilisateur n'a pas choisi : aucune valeur n'est devinée.

alter table public.prestataires
  add column mode_intervention text check (mode_intervention in ('contrat', 'devis'));

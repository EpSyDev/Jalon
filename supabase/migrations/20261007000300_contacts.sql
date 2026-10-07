-- Contacts : annuaire central des personnes à joindre (prestataires, secours, services de l'établissement…).
-- Les coordonnées des prestataires sont copiées une fois à la création (doublon voulu : l'annuaire vit sa vie).
-- Coordonnées professionnelles uniquement, aucune donnée patient.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 1 and 200),
  organisation text check (char_length(organisation) <= 200),
  fonction text check (char_length(fonction) <= 120),
  telephone text check (char_length(telephone) <= 30),
  email text check (char_length(email) <= 254),
  notes text check (char_length(notes) <= 2000),
  -- Lien informatif vers le prestataire d'origine (facultatif).
  prestataire_id uuid references public.prestataires (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profils (id),
  archive_le timestamptz
);

create index on public.contacts (prestataire_id);

create trigger maj_updated_at before update on public.contacts
for each row execute function public.maj_updated_at();
create trigger journaliser after insert or update on public.contacts
for each row execute function public.journaliser();
create trigger verifier_archivage before update of archive_le on public.contacts
for each row execute function public.verifier_archivage();
create trigger interdire_suppression before delete on public.contacts
for each row execute function public.interdire_suppression();

revoke all on public.contacts from anon;
revoke delete, truncate, references, trigger on public.contacts from authenticated;

alter table public.contacts enable row level security;
create policy lecture on public.contacts for select to authenticated
  using (public.role_utilisateur() is not null);
create policy creation on public.contacts for insert to authenticated
  with check (public.role_utilisateur() in ('admin', 'technicien'));
create policy modification on public.contacts for update to authenticated
  using (public.role_utilisateur() in ('admin', 'technicien'))
  with check (public.role_utilisateur() in ('admin', 'technicien'));

-- Reprise des prestataires qui ont au moins un contact, un mail ou un téléphone.
insert into public.contacts (nom, organisation, telephone, email, prestataire_id)
select coalesce(p.contact_nom, p.nom), p.nom, p.telephone, p.email, p.id
from public.prestataires p
where p.archive_le is null
  and (p.contact_nom is not null or p.email is not null or p.telephone is not null);

-- Recherche globale (Ctrl+K) : les contacts s'y ajoutent (même définition + une branche).
create or replace view public.v_recherche with (security_invoker = true) as
select 'equipement'::text as type, e.id, e.code || ' — ' || e.libelle as titre,
  l.libelle_complet as sous_titre, '/equipements/' || e.id as lien,
  public.normaliser(concat_ws(' ', e.code, e.libelle, e.marque, e.modele, e.numero_serie, l.libelle_complet)) as texte
from public.equipements e
left join public.localisations l on l.id = e.localisation_id
where e.archive_le is null
union all
select 'plan', p.id, t.libelle, coalesce(e.code || ' — ' || e.libelle, p.perimetre_libelle),
  '/controles/plans/' || p.id,
  public.normaliser(concat_ws(' ', t.libelle, f.libelle, e.code, e.libelle, p.perimetre_libelle, pr.nom))
from public.plans_controle p
join public.types_controle t on t.id = p.type_controle_id
join public.familles_controle f on f.id = t.famille_id
left join public.equipements e on e.id = p.equipement_id
left join public.prestataires pr on pr.id = p.prestataire_id
where p.archive_le is null
union all
select 'reserve', r.id, r.description, t.libelle, '/controles/plans/' || c.plan_controle_id,
  public.normaliser(concat_ws(' ', r.description, r.commentaire, t.libelle))
from public.reserves r
join public.controles c on c.id = r.controle_id and c.archive_le is null
join public.plans_controle p on p.id = c.plan_controle_id
join public.types_controle t on t.id = p.type_controle_id
where r.archive_le is null and r.statut = 'ouverte'
union all
select 'prestataire', pr.id, pr.nom, pr.contact_nom, '/prestataires/' || pr.id,
  public.normaliser(concat_ws(' ', pr.nom, pr.contact_nom, pr.email))
from public.prestataires pr
where pr.archive_le is null
union all
select 'contrat', c.id, c.objet, pr.nom, '/contrats/' || c.id,
  public.normaliser(concat_ws(' ', c.objet, c.reference, pr.nom))
from public.contrats c
join public.prestataires pr on pr.id = c.prestataire_id
where c.archive_le is null
union all
select 'intervention', i.id, i.titre, e.code, '/interventions/' || i.id,
  public.normaliser(concat_ws(' ', i.titre, i.description, e.code, e.libelle))
from public.interventions i
left join public.equipements e on e.id = i.equipement_id
where i.archive_le is null
union all
select 'chantier', ch.id, ch.titre, null, '/chantiers/' || ch.id,
  public.normaliser(concat_ws(' ', ch.titre, ch.description))
from public.chantiers ch
where ch.archive_le is null
union all
select 'contact', ct.id, ct.nom, concat_ws(' · ', ct.organisation, ct.fonction, ct.telephone), '/contacts/' || ct.id,
  public.normaliser(concat_ws(' ', ct.nom, ct.organisation, ct.fonction, ct.telephone, ct.email))
from public.contacts ct
where ct.archive_le is null;

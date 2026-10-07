import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entourageEquipement } from "@/lib/requetes/entourage-equipement";
import { ficheEquipement } from "@/lib/requetes/parc";
import { demarrerPilote, enTantQueUtilisateur, type Pilote } from "./pilote";

let p: Pilote;

beforeAll(async () => {
  p = await demarrerPilote();
}, 60_000);

afterAll(async () => {
  await p?.fermer();
});

describe("entourage d'un équipement (pilote postgres)", () => {
  it("prestataire du contrôle, ses contacts, contrat rattaché, chantier d'une intervention, interventions du plan", async () => {
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const [{ id: eq }] = await tx<
        { id: string }[]
      >`insert into public.equipements (code, libelle) values ('ENT-1', 'Entouré') returning id`;
      const [{ id: pr }] = await tx<
        { id: string }[]
      >`insert into public.prestataires (nom) values ('Presta entourage') returning id`;
      await tx`insert into public.contacts (nom, prestataire_id, telephone) values ('Contact E', ${pr}, '0102030405')`;
      const [{ id: ct }] = await tx<
        { id: string }[]
      >`insert into public.contrats (prestataire_id, objet) values (${pr}, 'Contrat E') returning id`;
      const [{ id: ty }] = await tx<{ id: string }[]>`select id from public.types_controle limit 1`;
      const [{ id: pl }] = await tx<{ id: string }[]>`
        insert into public.plans_controle (type_controle_id, equipement_id, prestataire_id, contrat_id)
        values (${ty}, ${eq}, ${pr}, ${ct}) returning id`;
      const [{ id: ch }] = await tx<
        { id: string }[]
      >`insert into public.chantiers (titre) values ('Chantier E') returning id`;
      await tx`insert into public.interventions (titre, equipement_id, chantier_id) values ('Directe', ${eq}, ${ch})`;
      await tx`insert into public.interventions (titre, plan_controle_id) values ('Via le plan', ${pl})`;
      return { e: await entourageEquipement(tx, eq), fiche: await ficheEquipement(tx, eq) };
    });
    expect(r.e.partenaires.map((x) => [x.nom, x.contacts.map((c) => c.nom)])).toEqual([
      ["Presta entourage", ["Contact E"]],
    ]);
    expect(r.e.contrats.map((c) => c.objet)).toEqual(["Contrat E"]);
    expect(r.e.chantiers.map((c) => c.titre)).toEqual(["Chantier E"]);
    expect(r.fiche.interventions.map((i) => i.titre).sort()).toEqual(["Directe", "Via le plan"]);
  });
});

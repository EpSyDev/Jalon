import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lireTableau, planifierControles, planifierEquipements, type Cellule } from "@/lib/metier/import";
import { executerControles, executerEquipements, lireExistant } from "@/lib/requetes/import";
import { demarrerPilote, enTantQueUtilisateur, type Pilote } from "./pilote";

let p: Pilote;

beforeAll(async () => {
  p = await demarrerPilote();
}, 60_000);

afterAll(async () => {
  await p?.fermer();
});

const ENTETE_EQUIPEMENTS = ["Code", "Libellé", "Univers", "Famille", "Bâtiment", "Niveau", "Local", "N° inventaire"];

describe("import réel (pilote postgres, RLS technicien)", () => {
  it("équipements par lots : univers et localisations créés une fois, rattachements corrects", async () => {
    const lignes: Cellule[][] = [ENTETE_EQUIPEMENTS];
    for (let i = 1; i <= 1200; i++) {
      lignes.push([
        `IMP-${i}`,
        `Équipement ${i}`,
        i % 2 ? "Chauffage-ventilation" : "Électricité",
        null,
        "Bât. Z",
        "R+1",
        null,
        `INV-${i}`,
      ]);
    }
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const lu = lireTableau(lignes, "equipements");
      if (lu.erreur) throw new Error(lu.erreur);
      const plan = planifierEquipements(lu.lignes!, await lireExistant(tx));
      expect(plan.importable).toBe(true);
      const bilan = await executerEquipements(tx, plan.operations);
      const [compte] = await tx<{ n: number; univers: number; locs: number }[]>`
        select count(*)::int as n, count(distinct univers_id)::int as univers, count(distinct localisation_id)::int as locs
        from public.equipements where code like 'IMP-%'`;
      const [chauffage] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.equipements e join public.univers u on u.id = e.univers_id
        where u.libelle = 'Chauffage-ventilation' and e.code like 'IMP-%'`;
      const [notes] = await tx<{ notes: string }[]>`select notes from public.equipements where code = 'IMP-7'`;
      return { bilan, compte, chauffage, notes };
    });
    // Les colonnes en plus arrivent bien en base (elles étaient calculées mais jamais enregistrées).
    expect(r.notes.notes).toBe("N° inventaire : INV-7");
    expect(r.bilan).toMatchObject({ equipements: 1200, univers: 2, localisations: 1 });
    expect(r.compte).toEqual({ n: 1200, univers: 2, locs: 1 });
    expect(r.chauffage.n).toBe(600);
  }, 60_000);

  it("contrôles : plans, derniers contrôles et réserves « à détailler » reliés", async () => {
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const lu = lireTableau(
        [
          [
            "Famille",
            "Libellé du contrôle",
            "Périmètre / équipement",
            "Caractère",
            "Périodicité (mois)",
            "Prestataire",
            "Date du dernier contrôle",
            "Résultat du dernier contrôle",
          ],
          ["Famille import", "Vérif A", "Site entier", "interne", "12", "Presta import", "01/03/2026", "avec réserves"],
          ["Famille import", "Vérif B", "Site entier", "interne", "6", "Presta import", null, null],
        ],
        "controles",
      );
      if (lu.erreur) throw new Error(lu.erreur);
      const plan = planifierControles(lu.lignes!, await lireExistant(tx));
      const bilan = await executerControles(tx, plan.operations);
      const reserves = await tx<{ description: string; plan: string }[]>`
        select r.description, t.libelle as plan from public.reserves r
        join public.controles c on c.id = r.controle_id
        join public.plans_controle pl on pl.id = c.plan_controle_id
        join public.types_controle t on t.id = pl.type_controle_id
        where t.libelle = 'Vérif A'`;
      const [presta] = await tx<{ n: number }[]>`
        select count(*)::int as n from public.plans_controle pl join public.prestataires pr on pr.id = pl.prestataire_id
        where pr.nom = 'Presta import'`;
      return { bilan, reserves, presta };
    });
    expect(r.bilan).toMatchObject({ familles: 1, prestataires: 1, types: 2, plans: 2, controles: 1 });
    expect(r.reserves).toEqual([{ description: "À détailler (reprise de l'import)", plan: "Vérif A" }]);
    expect(r.presta.n).toBe(2);
  });
});

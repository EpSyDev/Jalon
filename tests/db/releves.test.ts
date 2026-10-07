import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { statutReleve } from "@/lib/metier/releves";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { avecEtat, historiqueReleves, listerPoints } from "@/lib/requetes/releves";
import { demarrerPilote, enTantQueUtilisateur, type Pilote } from "./pilote";

let p: Pilote;

beforeAll(async () => {
  p = await demarrerPilote();
}, 60_000);

afterAll(async () => {
  await p?.fermer();
});

describe("relevés périodiques (pilote postgres, RLS)", () => {
  it("dernier relevé retenu, état calculé, hors seuil détecté, relevé futur refusé", async () => {
    const r = await enTantQueUtilisateur(p.sql, "technicien", async (tx) => {
      const [{ id }] = await tx<{ id: string }[]>`
        insert into public.points_releve (libelle, unite, periodicite_jours, seuil_min, seuil_max)
        values ('Eau chaude départ', '°C', 7, 55, 65) returning id`;
      await tx`insert into public.releves (point_id, date_releve, valeur) values (${id}, '2026-09-20', 60)`;
      await tx`insert into public.releves (point_id, date_releve, valeur) values (${id}, '2026-09-27', 52.5)`;
      const point = (await listerPoints(tx, true)).find((x) => x.id === id)!;
      const historique = await historiqueReleves(tx, id);
      await tx`savepoint s`;
      let futur = "";
      try {
        await tx`insert into public.releves (point_id, date_releve, valeur) values (${id}, public.aujourdhui() + 1, 1)`;
      } catch (e) {
        futur = (e as Error).message;
        await tx`rollback to savepoint s`;
      }
      return { point, historique, futur };
    });
    expect(r.point).toMatchObject({
      derniere_valeur: 52.5,
      dernier_releve: "2026-09-27",
      seuil_min: 55,
      seuil_max: 65,
    });
    expect(avecEtat(r.point, "2026-10-07")).toMatchObject({ statut: "en_retard", hors_seuil: "bas" });
    expect(statutReleve(r.point.dernier_releve, r.point.periodicite_jours, aujourdhuiParis())).toBe("en_retard");
    expect(r.historique.map((h) => h.valeur)).toEqual([52.5, 60]);
    expect(r.futur).toMatch(/futur/);
  });

  it("seuils incohérents refusés par la base ; lecture seule ne crée rien ; personne ne supprime", async () => {
    await expect(
      enTantQueUtilisateur(
        p.sql,
        "technicien",
        (tx) =>
          tx`insert into public.points_releve (libelle, periodicite_jours, seuil_min, seuil_max) values ('X', 1, 10, 5)`,
      ),
    ).rejects.toThrow();
    await expect(
      enTantQueUtilisateur(
        p.sql,
        "lecture",
        (tx) => tx`insert into public.points_releve (libelle, periodicite_jours) values ('X', 1)`,
      ),
    ).rejects.toThrow();
    await expect(enTantQueUtilisateur(p.sql, "admin", (tx) => tx`delete from public.releves`)).rejects.toThrow();
  });
});

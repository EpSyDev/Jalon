"use client";

import { useState } from "react";
import { ChampListe, ChampTexte, ChampZoneTexte, versOptions } from "@/components/champs";
import { aujourdhuiParis } from "@/lib/metier/echeance";
import { LIBELLES_STATUT_EQUIPEMENT } from "@/lib/metier/parc";
import type { EquipementDetail, OptionsEquipement } from "@/lib/requetes/parc";

/**
 * Champs d'un équipement. Les catégories proposées sont celles de l'univers choisi :
 * changer d'univers change la liste. Le statut n'est saisi qu'à la création (ensuite : panneau « Statut » de la fiche).
 */
export function ChampsEquipement({
  options,
  equipement,
  universParDefaut,
  categorieParDefaut,
  avecStatut = false,
}: {
  options: OptionsEquipement;
  equipement?: EquipementDetail;
  universParDefaut?: string;
  categorieParDefaut?: string;
  avecStatut?: boolean;
}) {
  const [univers, setUnivers] = useState(equipement?.univers_id ?? universParDefaut ?? "");
  const categorieInitiale = equipement?.categorie_id ?? categorieParDefaut ?? "";
  // Dans un univers : ses seules catégories (une transversale n'apparaît que si c'est déjà celle de l'équipement).
  const categories = options.categories.filter((c) =>
    univers ? c.univers_id === univers || (c.univers_id === null && c.id === categorieInitiale) : c.univers_id === null,
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampListe
          nom="univers_id"
          libelle="Univers"
          value={univers}
          onChange={(e) => setUnivers(e.target.value)}
          vide="Aucun univers"
          options={options.univers.map((u) => ({ valeur: u.id, libelle: u.libelle }))}
        />
        <ChampListe
          // Nouvelle liste à chaque univers : la catégorie d'un autre univers n'est jamais envoyée.
          key={univers}
          nom="categorie_id"
          libelle="Catégorie"
          defaultValue={categories.some((c) => c.id === categorieInitiale) ? categorieInitiale : ""}
          vide={categories.length ? "Sans catégorie" : "Aucune catégorie dans cet univers"}
          options={categories.map((c) => ({ valeur: c.id, libelle: c.libelle }))}
        />
      </div>
      <ChampTexte
        nom="categorie_nouvelle"
        libelle="Ou nouvelle catégorie"
        maxLength={120}
        placeholder="Ex. : Oxymètres, Lits médicalisés…"
        aide="Seulement si elle n'est pas dans la liste : elle sera créée dans l'univers choisi."
      />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <ChampTexte
          nom="code"
          libelle="Code"
          required
          maxLength={60}
          defaultValue={equipement?.code}
          placeholder="Ex. : TGBT-A"
          aide="Unique, sans espace."
        />
        <ChampTexte nom="libelle" libelle="Libellé" required maxLength={200} defaultValue={equipement?.libelle} />
      </div>
      {avecStatut && (
        <ChampListe
          nom="statut"
          libelle="Statut"
          defaultValue="en_service"
          options={versOptions(LIBELLES_STATUT_EQUIPEMENT)}
        />
      )}
      <ChampListe
        nom="localisation_id"
        libelle="Localisation"
        defaultValue={equipement?.localisation_id ?? ""}
        vide="Non renseignée"
        options={options.localisations.map((l) => ({ valeur: l.id, libelle: l.libelle }))}
        aide="Nouvelle localisation : Parc → Localisations."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampTexte nom="marque" libelle="Marque" maxLength={120} defaultValue={equipement?.marque ?? ""} />
        <ChampTexte nom="modele" libelle="Modèle" maxLength={120} defaultValue={equipement?.modele ?? ""} />
        <ChampTexte
          nom="numero_serie"
          libelle="N° de série"
          maxLength={120}
          defaultValue={equipement?.numero_serie ?? ""}
        />
        <ChampTexte
          nom="date_mise_en_service"
          libelle="Mise en service"
          type="date"
          max={aujourdhuiParis()}
          defaultValue={equipement?.date_mise_en_service ?? ""}
        />
      </div>
      <ChampZoneTexte nom="notes" libelle="Notes" defaultValue={equipement?.notes ?? ""} />
    </>
  );
}

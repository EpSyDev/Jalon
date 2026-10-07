// Mode tournée : les contrôles à faire regroupés par local, pour passer de l'un à l'autre.

export type ArretTournee<P> = { localisation_id: string | null; localisation: string; plans: P[] };

/** Regroupe en conservant l'ordre reçu (celui des locaux) ; les contrôles sans local à la fin. */
export function grouperParLocal<P extends { localisation_id: string | null; localisation: string | null }>(
  plans: P[],
): ArretTournee<P>[] {
  const arrets = new Map<string, ArretTournee<P>>();
  for (const p of plans) {
    const cle = p.localisation_id ?? "";
    if (!arrets.has(cle)) {
      arrets.set(cle, {
        localisation_id: p.localisation_id,
        localisation: p.localisation ?? "Sans local (installation ou périmètre)",
        plans: [],
      });
    }
    arrets.get(cle)!.plans.push(p);
  }
  return [...arrets.values()].sort((a, b) => Number(a.localisation_id === null) - Number(b.localisation_id === null));
}

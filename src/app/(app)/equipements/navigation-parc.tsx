"use client";

import { useRouter } from "next/navigation";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/** Liste déroulante qui mène directement à la liste filtrée (adresses calculées côté serveur). */
export function ListeNavigante({
  libelle,
  valeur,
  options,
}: {
  libelle: string;
  valeur: string;
  options: { valeur: string; libelle: string; adresse: string }[];
}) {
  const router = useRouter();
  return (
    <label className="grid gap-1 text-xs text-muted-foreground sm:max-w-sm">
      {libelle}
      <NativeSelect
        value={valeur}
        onChange={(e) => {
          const cible = options.find((o) => o.valeur === e.target.value);
          if (cible) router.push(cible.adresse);
        }}
        className="w-full [&_select]:h-11 [&_select]:text-base"
      >
        {options.map((o) => (
          <NativeSelectOption key={o.valeur} value={o.valeur}>
            {o.libelle}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}

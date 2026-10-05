import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

function Champ({
  id,
  libelle,
  aide,
  children,
}: {
  id: string;
  libelle: string;
  aide?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{libelle}</Label>
      {children}
      {aide && <p className="text-xs text-muted-foreground">{aide}</p>}
    </div>
  );
}

type PropsBase = { nom: string; libelle: string; aide?: ReactNode };

export function ChampTexte({ nom, libelle, aide, ...props }: PropsBase & Omit<ComponentProps<"input">, "name" | "id">) {
  return (
    <Champ id={nom} libelle={libelle} aide={aide}>
      <Input id={nom} name={nom} className="h-12 text-base" {...props} />
    </Champ>
  );
}

export function ChampZoneTexte({
  nom,
  libelle,
  aide,
  ...props
}: PropsBase & Omit<ComponentProps<"textarea">, "name" | "id">) {
  return (
    <Champ id={nom} libelle={libelle} aide={aide ?? "Aucune donnée patient."}>
      <Textarea id={nom} name={nom} maxLength={2000} className="min-h-24 text-base" {...props} />
    </Champ>
  );
}

export function ChampListe({
  nom,
  libelle,
  aide,
  options,
  vide,
  ...props
}: PropsBase & {
  options: { valeur: string; libelle: string }[];
  /** Libellé de l'option vide (champ facultatif) ; absent = choix obligatoire. */
  vide?: string;
} & Omit<ComponentProps<"select">, "name" | "id" | "size">) {
  return (
    <Champ id={nom} libelle={libelle} aide={aide}>
      <NativeSelect id={nom} name={nom} className="w-full [&_select]:h-12 [&_select]:text-base" {...props}>
        {vide !== undefined && <NativeSelectOption value="">{vide}</NativeSelectOption>}
        {options.map((o) => (
          <NativeSelectOption key={o.valeur} value={o.valeur}>
            {o.libelle}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Champ>
  );
}

/** Convertit un dictionnaire de libellés en options de liste. */
export function versOptions(libelles: Record<string, string>) {
  return Object.entries(libelles).map(([valeur, libelle]) => ({ valeur, libelle }));
}

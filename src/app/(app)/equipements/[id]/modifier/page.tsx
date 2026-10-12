import { notFound, redirect } from "next/navigation";
import { z } from "zod";

/** Ancienne page de modification : l'équipement se modifie désormais sur sa fiche. */
export default async function PageModifierEquipement({ params }: PageProps<"/equipements/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  redirect(`/equipements/${id}?modifier=1`);
}

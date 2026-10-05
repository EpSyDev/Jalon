import { LogOut } from "lucide-react";
import { seDeconnecter } from "@/app/connexion/actions";
import { Button } from "@/components/ui/button";

export function BoutonDeconnexion() {
  return (
    <form action={seDeconnecter}>
      <Button type="submit" variant="outline" className="w-full justify-start gap-2">
        <LogOut className="size-4" aria-hidden />
        Se déconnecter
      </Button>
    </form>
  );
}

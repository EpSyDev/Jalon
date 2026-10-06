import { LogOut } from "lucide-react";
import { seDeconnecter } from "@/app/connexion/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BoutonDeconnexion({ className }: { className?: string }) {
  return (
    <form action={seDeconnecter}>
      <Button type="submit" variant="outline" className={cn("w-full justify-start gap-2", className)}>
        <LogOut className="size-4" aria-hidden />
        Se déconnecter
      </Button>
    </form>
  );
}

"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BoutonImprimer() {
  return (
    <Button type="button" onClick={() => window.print()} className="h-12 w-fit text-base">
      <Printer className="size-5" aria-hidden />
      Imprimer
    </Button>
  );
}

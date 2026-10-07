import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Écran centré des parcours de connexion secondaires (2FA, lien reçu par mail, mot de passe). */
export function CarteConnexion({
  titre,
  description,
  children,
}: {
  titre: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{titre}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">{children}</CardContent>
      </Card>
    </main>
  );
}

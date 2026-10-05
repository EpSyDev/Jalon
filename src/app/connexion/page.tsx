import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormulaireConnexion } from "./formulaires";

export const metadata = { title: "Connexion — Jalon" };

export default function PageConnexion() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Jalon</CardTitle>
          <CardDescription>Service technique — accès réservé à l&apos;équipe.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormulaireConnexion />
        </CardContent>
      </Card>
    </main>
  );
}

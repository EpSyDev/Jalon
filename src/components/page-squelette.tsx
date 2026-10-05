import { Badge } from "@/components/ui/badge";

/** Page de module pas encore construit (Phase A). */
export function PageSquelette({ titre, description, bloc }: { titre: string; description: string; bloc: string }) {
  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{titre}</h1>
        <Badge variant="secondary">Bloc {bloc}</Badge>
      </div>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

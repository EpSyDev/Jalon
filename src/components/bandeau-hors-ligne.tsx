"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function abonner(rappel: () => void) {
  window.addEventListener("online", rappel);
  window.addEventListener("offline", rappel);
  return () => {
    window.removeEventListener("online", rappel);
    window.removeEventListener("offline", rappel);
  };
}

/** Local technique sans réseau : prévenir avant qu'une saisie échoue. */
export function BandeauHorsLigne() {
  const enLigne = useSyncExternalStore(
    abonner,
    () => navigator.onLine,
    () => true,
  );
  if (enLigne) return null;
  return (
    <p
      role="status"
      className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-sm font-medium text-black print:hidden"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      Hors ligne : les données affichées peuvent dater, les enregistrements attendront le retour du réseau.
    </p>
  );
}

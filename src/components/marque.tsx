import { cn } from "@/lib/utils";

/** Jalon de géomètre : piquet rayé orange et blanc. Symbole de l'application. */
export function Jalon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 40" className={cn("h-7 w-auto", className)} aria-hidden>
      <path d="M6 40 3.6 34h4.8z" fill="currentColor" opacity="0.55" />
      <path d="M2.5 34V1.5A1.5 1.5 0 0 1 4 0h4a1.5 1.5 0 0 1 1.5 1.5V34z" fill="#fff" />
      {/* Bandes orange : seule la première épouse le sommet arrondi. */}
      <path d="M2.5 6.8V1.5A1.5 1.5 0 0 1 4 0h4a1.5 1.5 0 0 1 1.5 1.5v5.3z" fill="var(--jalon)" />
      <rect x="2.5" y="13.6" width="7" height="6.8" fill="var(--jalon)" />
      <rect x="2.5" y="27.2" width="7" height="6.8" fill="var(--jalon)" />
      <path
        d="M2.5 34V1.5A1.5 1.5 0 0 1 4 0h4a1.5 1.5 0 0 1 1.5 1.5V34z"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Logotype : jalon + nom en grotesque large. */
export function Marque({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Jalon />
      <span className="font-heading text-xl font-extrabold tracking-tight" style={{ fontStretch: "125%" }}>
        Jalon
      </span>
    </span>
  );
}

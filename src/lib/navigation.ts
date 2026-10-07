import {
  BarChart3,
  Boxes,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Contact,
  FileText,
  Handshake,
  History,
  HardHat,
  Package,
  Settings,
  Upload,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/roles";

export type Module = {
  href: string;
  libelle: string;
  icone: LucideIcon;
  /** Affiché dans la barre basse mobile. */
  principal?: boolean;
  roles?: Role[];
};

export const MODULES: Module[] = [
  { href: "/", libelle: "Aujourd'hui", icone: CalendarCheck, principal: true },
  { href: "/controles", libelle: "Contrôles", icone: ClipboardCheck, principal: true },
  { href: "/equipements", libelle: "Parc", icone: Boxes, principal: true },
  { href: "/interventions", libelle: "Interventions", icone: Wrench, principal: true },
  { href: "/chantiers", libelle: "Chantiers", icone: HardHat },
  { href: "/contrats", libelle: "Contrats", icone: FileText },
  { href: "/prestataires", libelle: "Prestataires", icone: Building2 },
  { href: "/contacts", libelle: "Contacts", icone: Contact },
  { href: "/statistiques", libelle: "Statistiques", icone: BarChart3 },
  { href: "/stocks", libelle: "Stocks", icone: Package },
  { href: "/relais", libelle: "Passage de relais", icone: Handshake },
  { href: "/import", libelle: "Import", icone: Upload, roles: ["admin", "technicien"] },
  { href: "/journal", libelle: "Journal", icone: History, roles: ["admin"] },
  { href: "/parametres", libelle: "Paramètres", icone: Settings, roles: ["admin"] },
];

export function modulesVisibles(role: Role): Module[] {
  return MODULES.filter((m) => !m.roles || m.roles.includes(role));
}

export function estActif(href: string, chemin: string): boolean {
  return href === "/" ? chemin === "/" : chemin === href || chemin.startsWith(`${href}/`);
}

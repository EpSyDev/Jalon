export type Role = "admin" | "technicien" | "lecture";

export const LIBELLES_ROLE: Record<Role, string> = {
  admin: "Administrateur",
  technicien: "Technicien",
  lecture: "Lecture seule",
};

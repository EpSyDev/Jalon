import Link from "next/link";
import type { ComponentProps } from "react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Lien de navigation présenté comme un bouton. */
export function LienBouton({
  variante = "default",
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: VariantProps<typeof buttonVariants>["variant"] }) {
  return <Link className={cn(buttonVariants({ variant: variante }), className)} {...props} />;
}

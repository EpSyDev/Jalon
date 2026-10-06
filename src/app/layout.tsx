import type { Metadata, Viewport } from "next";
import { Archivo, Atkinson_Hyperlegible_Next, JetBrains_Mono } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

// Titres : grotesque large (signalétique) · texte : conçue pour la lisibilité · codes et dates : chasse fixe.
const titre = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-titre" });
const texte = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-texte" });
const chasseFixe = JetBrains_Mono({ subsets: ["latin"], variable: "--font-chasse-fixe" });

export const metadata: Metadata = {
  title: "Jalon",
  description: "Suivi du service technique : contrôles, parc, interventions, contrats.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#14171d" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Rendu dynamique partout : sans cela le nonce CSP n'est pas appliqué et les scripts sont bloqués.
  await connection();
  return (
    <html lang="fr" className={`${titre.variable} ${texte.variable} ${chasseFixe.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

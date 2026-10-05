import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist_Mono, Inter } from "next/font/google";
import { getSettings } from "@/lib/settings";
import "./globals.css";

// Brand typography, matching the logo: a high-contrast serif for the brand
// name, titles and key numbers; a clean sans for everything else.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Settings (app name, accent color) are read from the database on every
// request so admin changes take effect immediately, without a rebuild.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { appName, companyName } = await getSettings();
  return {
    title: companyName || appName,
    description: "Rough-to-sale diamond manufacturing and stock.",
  };
}

export const viewport: Viewport = {
  themeColor: "#1d1d1f",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { accentColor } = await getSettings();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${geistMono.variable} h-full antialiased`}
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      <body className="min-h-full flex flex-col bg-[var(--canvas)] text-zinc-900">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Settings (app name, accent color) are read from the database on every
// request so admin changes take effect immediately, without a rebuild.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { appName } = await getSettings();
  return {
    title: appName,
    description: "Track stock levels and inward/outward transactions.",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { accentColor } = await getSettings();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}

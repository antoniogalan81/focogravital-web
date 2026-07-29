import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/src/components/ClientProviders";
import { BRAND, SITE_URL } from "@/src/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Focogravital es el sistema para convertir tus metas en acciones diarias: metas, tareas y agenda en una sola app.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND} — Deja de pensar. Empieza a ejecutar.`,
    template: `%s · ${BRAND}`,
  },
  description: DESCRIPTION,
  applicationName: BRAND,
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: {
    type: "website",
    siteName: BRAND,
    locale: "es_ES",
    url: SITE_URL,
    title: `${BRAND} — Deja de pensar. Empieza a ejecutar.`,
    description: DESCRIPTION,
    images: [{ url: "/logo.png", width: 512, height: 512, alt: BRAND }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND} — Deja de pensar. Empieza a ejecutar.`,
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: { index: true, follow: true },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: BRAND,
  url: SITE_URL,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Android, Web",
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}

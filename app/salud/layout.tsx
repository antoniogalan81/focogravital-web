import type { Metadata } from "next";
import { Guardia } from "@/src/salud/ui";

export const metadata: Metadata = { title: "Salud", robots: { index: false, follow: false } };

export default function SaludLayout({ children }: { children: React.ReactNode }) {
  return <Guardia>{children}</Guardia>;
}

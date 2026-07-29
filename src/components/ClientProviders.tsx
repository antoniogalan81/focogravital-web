"use client";

import { AuthProvider } from "@/src/contexts/AuthContext";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}


import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viralefy Backoffice",
  description: "Painel administrativo Viralefy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

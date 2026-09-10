import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Planning Poker",
  description: "Planning poker multiusuário e em tempo real",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

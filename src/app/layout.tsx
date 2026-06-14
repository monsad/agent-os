import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Agent OS", description: "Mission Control" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SVstockmining | Virtual Wallet",
  description: "A virtual USD wallet and account approval dashboard. Demo balances only."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

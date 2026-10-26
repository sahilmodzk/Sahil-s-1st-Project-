import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Gather — A little closer",
  description:
    "Your people, your ideas, your little corner of the internet. Connect on Gather.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

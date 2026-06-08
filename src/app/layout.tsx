import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales OS",
  description:
    "Your sales team as a roster of AI agents. AI owns the system, the human owns the close.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

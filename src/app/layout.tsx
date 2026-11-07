import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrandShield AI — Enterprise Marketing Claim Governance",
  description:
    "Evidence-linked marketing claim governance platform for cross-functional compliance, legal, and brand review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-[#090D16] text-slate-100 antialiased dark">
      <body className="min-h-full flex flex-col font-sans text-slate-100 bg-[#090D16]">
        {children}
      </body>
    </html>
  );
}

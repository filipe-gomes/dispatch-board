import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Dispatch Board",
  description: "Schedule fuel loads, dispatch them to drivers and carriers, and track deliveries as they happen.",
};

export const viewport: Viewport = {
  themeColor: "#f4f6fb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans antialiased", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}

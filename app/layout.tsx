import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "greek"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Inside the Wire — Ohm's law, up close",
  description:
    "Lock one of voltage, current or resistance, drag another, and watch the third respond — on gauges and inside a magnified wire.",
};

export const viewport: Viewport = {
  themeColor: "#f2ede3",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

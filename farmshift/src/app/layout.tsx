import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://farmshift.earth"),
  title: "FarmShift | NASA-Powered Crop Rotation Decision Support",
  description:
    "FarmShift transforms NASA Earth observations into clear environmental insights and crop-rotation scenarios for farmers adapting to climate change. Built for the NASA Space Apps Challenge 2026.",
  keywords: ["NASA", "agriculture", "crop rotation", "earth observation", "farming", "climate adaptation", "SMAP", "MODIS", "decision support"],
  icons: {
    icon: "/favicon-farmshift.jpg",
    shortcut: "/favicon-farmshift.jpg",
    apple: "/favicon-farmshift.jpg",
  },
  openGraph: {
    title: "FarmShift | NASA-Powered Crop Rotation Decision Support",
    description:
      "Transform NASA satellite data into actionable crop-rotation strategies. Built for NASA Space Apps Challenge 2026.",
    type: "website",
    siteName: "FarmShift",
    images: [
      {
        url: "/hero-satellite-farm.jpg",
        width: 1200,
        height: 630,
        alt: "Aerial view of agricultural farmland analyzed by FarmShift",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FarmShift | NASA-Powered Crop Rotation Decision Support",
    description:
      "Transform NASA satellite data into actionable crop-rotation strategies.",
    images: ["/hero-satellite-farm.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon-farmshift.jpg" />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}

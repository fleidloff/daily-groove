import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import localFont from "next/font/local";
import { branding } from "@/lib/snippets";
import { LanguageProvider } from "./LanguageContext";
import "./globals.css";

const { appName: APP_NAME, tagline: TAGLINE } = branding;

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const jazzHand = localFont({
  src: "./fonts/PetalumaScript.woff2",
  variable: "--font-jazz-hand",
  display: "swap",
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: TAGLINE,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${dmSans.variable} ${jazzHand.variable} antialiased`}
    >
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

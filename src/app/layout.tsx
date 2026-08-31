import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import localFont from "next/font/local";
import { APP_NAME, TAGLINE } from "@/lib/branding";
import "./globals.css";

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

// The hand-lettered jazz face the large headings are set in. Self-hosted from
// the repository (see ./fonts/OFL.txt) so the page asks no third-party host for
// it. One weight is enough: headings render at font-normal throughout.
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
      <body>{children}</body>
    </html>
  );
}

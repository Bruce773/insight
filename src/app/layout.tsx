import type { Metadata } from "next";
import "./globals.css";
import "./personality-insights.css";

export const metadata: Metadata = {
  title: "InSight | Explore your next step",
  description: "A thoughtful place to explore your career aspirations and plan your next step.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

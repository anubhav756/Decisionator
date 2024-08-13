import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Decisionator",
  description: "Fun app that helps you decide with a Snap!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black font-bold text-white tracking-tight`}>{children}</body>
    </html>
  );
}

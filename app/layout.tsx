import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "LoomiFlow AI — Commerce Operations Cockpit",
  description: "Autonomous Commerce Operations Agent | Loomi Connect AI Hackathon 2026",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-bg text-white antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  )
}

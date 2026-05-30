// app/layout.tsx
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "LoomiFlow AI — Commerce Operations Cockpit",
  description: "Autonomous Commerce Operations Agent | Loomi Connect AI Hackathon 2026",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#05060A] text-white antialiased min-h-screen font-mono">
        {children}
      </body>
    </html>
  )
}

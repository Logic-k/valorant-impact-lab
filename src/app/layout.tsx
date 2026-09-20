import type { Metadata } from "next"

import "@/app/globals.css"

export const metadata: Metadata = {
  title: "VALORANT Impact Lab",
  description: "Temporary HenrikDev-backed VALORANT performance analysis beta.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

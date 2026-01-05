import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ScheduleSync',
  description: 'Scheduling and attendance management for education centres',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

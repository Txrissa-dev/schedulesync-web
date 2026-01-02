import './globals.css';

export const metadata = {
  title: 'ScheduleSync',
  description: 'ScheduleSync Web App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

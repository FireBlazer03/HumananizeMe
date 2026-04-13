import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HumanizeAI - Make AI Text Sound Human',
  description: 'Transform AI-generated text into natural, human-sounding writing in seconds. Premium algorithmic humanization.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="body-gradient text-gray-800 antialiased" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HumanizeAI - Transform AI Text into Natural Writing',
  description: 'Transform AI-generated text into natural, human-sounding prose using pure algorithmic processing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}

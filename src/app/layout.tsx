import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'DispatchHub — EDCC Services',
  description: 'Dispatch, scheduling & operations for NYC demolition and carting',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full min-h-screen bg-background flex flex-col">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#191b22',
              border: '1px solid #2a2d38',
              color: '#f0f1f4',
            },
          }}
        />
      </body>
    </html>
  );
}

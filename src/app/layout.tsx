import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import Sidebar from '@/components/Sidebar';
import ScheduledPaymentsRunner from '@/components/ScheduledPaymentsRunner';

export const metadata: Metadata = {
  title: 'ArcPilot - AI-Native Crypto Account',
  description: 'Manage assets, payments, and smart transaction logic using natural language prompts.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <ScheduledPaymentsRunner />
          <div className="app-container">
            <Sidebar />
            <main style={{ flexGrow: 1, height: '100%', overflowY: 'auto', backgroundColor: 'var(--background)' }}>
              {children}
            </main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}

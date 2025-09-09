import type { Metadata } from "next";
import "./globals.css";
import AppLayout from "@/components/layout/app-layout";
import { AuthProvider } from "@/contexts/auth-context";

export const metadata: Metadata = {
  title: "Evently - Discover and Book Amazing Events",
  description: "Book tickets for concerts, workshops, conferences, and more. Create and manage your own events with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}

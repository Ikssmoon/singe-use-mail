import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "High-End Disposable Email Generator",
  description: "Receive emails anonymously with our free, private, and secure temporary email address generator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

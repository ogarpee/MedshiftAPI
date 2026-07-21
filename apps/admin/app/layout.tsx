import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "MedShift Admin",
  description: "MedShift operational dashboard."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

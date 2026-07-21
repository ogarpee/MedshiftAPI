import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "MedShift",
  description: "Fill healthcare shifts fast with verified local professionals."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

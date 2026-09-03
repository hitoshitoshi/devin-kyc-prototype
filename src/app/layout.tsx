import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KYC Compliance Queue · Internal Tools",
  description: "Internal KYC review console for compliance operations.",
};

const themeScript = `(function(){try{var t=localStorage.getItem('it-theme');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans text-[13px]">{children}</body>
    </html>
  );
}

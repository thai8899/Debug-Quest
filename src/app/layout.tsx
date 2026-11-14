import "./globals.css";
import Backdrop from "@/components/Backdrop";

export const metadata = { title: "Debug Quest", description: "Your AI did the work. Now earn it." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Backdrop />
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}

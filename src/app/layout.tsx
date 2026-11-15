import "./globals.css";
import Backdrop from "@/components/Backdrop";

export const metadata = { title: "Debug Quest", description: "Your AI did the work. Now earn it." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Backdrop />
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}

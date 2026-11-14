export const metadata = { title: "Debug Quest", description: "Your AI did the work. Now earn it." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0f1020", color: "#e8e8f5", fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}

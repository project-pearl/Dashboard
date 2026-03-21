/**
 * Minimal emergency layout - bypasses all complex logic
 * Use this to test if layout is causing the crash
 */

export default function MinimalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Emergency Mode</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ fontFamily: 'Arial', padding: '20px' }}>
        <div style={{ backgroundColor: '#fff3cd', padding: '10px', marginBottom: '20px', border: '1px solid #ffc107' }}>
          ⚠️ <strong>Emergency Mode:</strong> Minimal layout active
        </div>
        {children}
      </body>
    </html>
  );
}
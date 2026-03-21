/**
 * Ultra-simple test page - no dependencies, no auth, no database calls
 * Tests basic Next.js functionality only
 */

export default function TestPage() {
  return (
    <html>
      <head>
        <title>Emergency Test Page</title>
      </head>
      <body style={{ fontFamily: 'Arial', padding: '20px', backgroundColor: '#f0f0f0' }}>
        <h1 style={{ color: 'green' }}>✅ SUCCESS!</h1>
        <p><strong>Deployment is working!</strong></p>
        <p>Timestamp: {new Date().toISOString()}</p>
        <p>If you see this page, Next.js is functional.</p>
        <hr />
        <p><strong>Next steps:</strong></p>
        <ul>
          <li>Main app crash is isolated to specific components</li>
          <li>Authentication or database issues likely</li>
          <li>Layout or middleware problems</li>
        </ul>
        <a href="/" style={{ color: 'blue' }}>← Try main page</a>
      </body>
    </html>
  );
}
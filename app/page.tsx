export default function MinimalHome() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>✅ Site is Working</h1>
      <p>Basic Next.js page loads successfully</p>
      <p>Timestamp: {new Date().toISOString()}</p>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <h2>Status Check</h2>
        <ul>
          <li>✅ React rendering</li>
          <li>✅ Next.js routing</li>
          <li>✅ Basic styling</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px' }}>
        <a href="/dashboard/federal" style={{ color: 'blue', textDecoration: 'underline' }}>
          → Try Federal Dashboard
        </a>
      </div>
    </div>
  );
}
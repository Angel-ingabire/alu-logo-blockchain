export default function App() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: "2rem",
      background: "#f8fafc",
      color: "#0f172a",
      fontFamily: "sans-serif",
    }}>
      <div style={{
        maxWidth: "640px",
        background: "#ffffff",
        border: "1px solid #dbeafe",
        borderRadius: "16px",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        padding: "2rem",
      }}>
        <h1 style={{ margin: 0, fontSize: "2rem" }}>ALU Asset Registry</h1>
        <p style={{ marginTop: "1rem", lineHeight: 1.7 }}>
          The canonical application for this assignment lives in the <code>frontend/</code> folder.
        </p>
        <p style={{ marginTop: "0.75rem", lineHeight: 1.7 }}>
          Use the repo-root commands (<code>npm run dev</code>, <code>npm run build</code>) to serve the single functional app from there.
        </p>
      </div>
    </div>
  );
}

// Empty / first-run state — new session
function Empty({ setRoute }) {
  const cards = [
    { ttl: "Decision", body: "“We're keeping the LED driver as a separate SMPS stage. The PWM was coupling into the bus.”" },
    { ttl: "Test result", body: "“MPPT settled at 6.2 V, 0.4 A indoors today, charged the supercap 1 V → 4.8 V in 14 minutes.”" },
    { ttl: "Question", body: "“Is the 3.3 Ω bleed resistor really necessary, or can the buck-boost sink enough current?”" },
  ];

  return (
    <div className="body">
      <div className="empty">
        <span className="stamp">New session · Y2-PMS-001</span>
        <h2>What did you change, decide, or learn today?</h2>
        <p>The assistant will file your update into the right section of <code>project_memory.md</code> and surface anything related from previous sessions.</p>

        <div className="cards">
          {cards.map((c, i) => (
            <div className="card" key={i} onClick={() => setRoute("chat")}>
              <div className="ttl">{c.ttl}</div>
              <div className="body">{c.body}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn primary" onClick={() => setRoute("chat")}>
            <Icons.Chat /><span>Open chat</span>
          </button>
          <button className="btn" onClick={() => setRoute("memory")}>
            <Icons.Memory /><span>Read memory first</span>
          </button>
        </div>

        <div style={{ marginTop: 36, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Tip · <span className="kbd">⌘K</span> opens command palette · <span className="kbd">B</span> toggles Boost
        </div>
      </div>
    </div>
  );
}

window.Empty = Empty;

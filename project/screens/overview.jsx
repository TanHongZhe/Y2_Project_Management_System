// Dashboard / Overview — project status at a glance.
function Overview({ data, setRoute }) {
  const spent = data.components.filter(c => c.status !== "planned").reduce((s, c) => s + c.cost, 0);
  const remain = data.project.budgetCap - spent;
  const pct = spent / data.project.budgetCap;

  const statusBreakdown = ["installed", "received", "ordered", "planned"].map(s => ({
    status: s,
    n: data.components.filter(c => c.status === s).length,
  }));

  // Demo countdown
  const today = new Date("2026-05-14");
  const due = new Date("2026-06-09");
  const daysLeft = Math.round((due - today) / 86400000);

  // Subsystem health (mocked from test data + cost commit)
  const subsystems = [
    { id: "pv", name: "PV + MPPT",      health: "ok",   note: "Indoor 2.6 W @ 6.2 V",     last: "T-021 · 1d ago" },
    { id: "supercap", name: "Supercap",  health: "ok",   note: "Charge 1→4.8 V in 14:28", last: "T-020 · 2d ago" },
    { id: "bus", name: "3.30 V bus",     health: "warn", note: "Ripple 95 mVpp > 50 target", last: "T-017 · 5d ago" },
    { id: "led", name: "LED driver",     health: "ok",   note: "PWM linear from 10–100 %", last: "T-018 · 6d ago" },
    { id: "comms", name: "Comms / I²C",  health: "fail", note: "I²C locks during PWM ISR", last: "Q-003 open" },
    { id: "sys", name: "Integration",    health: "idle", note: "End-to-end test pending",  last: "—" },
  ];

  // Sparkline data — last 7 days, normalized 0..1
  const sparks = {
    spend: [0.10, 0.18, 0.18, 0.34, 0.45, 0.62, 0.71],
    ripple: [0.20, 0.20, 0.45, 0.85, 0.95, 0.95, 0.95], // mVpp/100
    bus:   [0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.55],  // 3.30 / 6
  };

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Overview</div>
          <h1>{data.project.name}</h1>
        </div>
        <div className="actions">
          <button className="btn ghost sm"><Icons.Clock /><span>Today, 11:42</span></button>
          <button className="btn sm" onClick={() => setRoute("chat")}><Icons.Chat /><span>Continue chat</span></button>
          <button className="btn primary sm" onClick={() => setRoute("empty")}><Icons.Plus /><span>New session</span></button>
        </div>
      </header>

      <div className="body">
        <div className="dash">

          {/* Hero: AI brief */}
          <div className="card brief">
            <div className="kicker">
              <span className="dot" /> AI Brief · {data.project.lastSync}
            </div>
            <div className="brief-body">
              <p>Since yesterday: <strong>1 decision logged</strong> (defer RAG), <strong>1 test recorded</strong> (MPPT @ 2.6 W indoors), and you closed <strong>0 of 3</strong> open questions. The 3.30 V rail still misses ripple target under LED PWM — <a className="lnk" onClick={() => setRoute("decisions")}>see D-011 proposal</a>. Budget is <strong>71 % spent</strong> with <strong>{daysLeft} days</strong> to demo.</p>
            </div>
            <div className="brief-tags">
              <span className="micro">Top blocker</span>
              <span className="tag bus">3.3 V ripple under PWM</span>
              <span className="micro" style={{ marginLeft: 16 }}>Next action</span>
              <span className="tag bom">Add 22 µF cap, retest T-017</span>
            </div>
          </div>

          {/* KPI strip */}
          <div className="kpi">
            <div className="kpi-cell">
              <div className="kpi-label">Days to demo</div>
              <div className="kpi-value">{daysLeft}<span className="kpi-unit">d</span></div>
              <div className="kpi-sub">due 2026-06-09</div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-label">Budget remaining</div>
              <div className="kpi-value">£{remain.toFixed(2)}</div>
              <div className="kpi-sub">{Math.round(pct * 100)}% of £{data.project.budgetCap.toFixed(0)} spent</div>
              <Spark data={sparks.spend} color="var(--accent)" />
            </div>
            <div className="kpi-cell">
              <div className="kpi-label">Bus voltage</div>
              <div className="kpi-value">3.30<span className="kpi-unit">V</span></div>
              <div className="kpi-sub">±2 % · ripple 95 mVpp ⚠</div>
              <Spark data={sparks.bus} color="var(--info)" flat />
            </div>
            <div className="kpi-cell">
              <div className="kpi-label">Open questions</div>
              <div className="kpi-value">3</div>
              <div className="kpi-sub">1 blocker · 2 minor</div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-label">Decisions</div>
              <div className="kpi-value">10</div>
              <div className="kpi-sub">last 14 days: <span style={{ color: "var(--accent-fg)" }}>+3</span></div>
            </div>
            <div className="kpi-cell">
              <div className="kpi-label">Tests on record</div>
              <div className="kpi-value">21</div>
              <div className="kpi-sub">5 this week · 0 failing</div>
            </div>
          </div>

          {/* Main grid */}
          <div className="dash-grid">

            {/* Subsystem status */}
            <div className="card span-2">
              <div className="card-head">
                <h3>Subsystem status</h3>
                <button className="btn ghost sm" onClick={() => setRoute("tests")}>
                  <span>All tests</span><Icons.Open size={11} />
                </button>
              </div>
              <div className="subsys-grid">
                {subsystems.map(s => (
                  <div key={s.id} className={"subsys " + s.health}>
                    <div className="bar" />
                    <div className="name">{s.name}</div>
                    <div className="note">{s.note}</div>
                    <div className="last">{s.last}</div>
                  </div>
                ))}
              </div>
              <div className="legend">
                <span><span className="lh ok" />ok</span>
                <span><span className="lh warn" />needs attention</span>
                <span><span className="lh fail" />blocker</span>
                <span><span className="lh idle" />not yet tested</span>
              </div>
            </div>

            {/* Components by status */}
            <div className="card">
              <div className="card-head">
                <h3>Components</h3>
                <button className="btn ghost sm" onClick={() => setRoute("components")}>
                  <Icons.Open size={11} />
                </button>
              </div>
              <div className="status-stack">
                {statusBreakdown.map(b => (
                  <div className="status-row" key={b.status}>
                    <span className={"status-chip " + b.status}>{b.status}</span>
                    <div className="status-bar"><span style={{ width: `${(b.n / data.components.length) * 100}%` }} /></div>
                    <span className="status-n">{b.n}</span>
                  </div>
                ))}
              </div>
              <div className="cost-mini">
                <div>
                  <span className="micro">Committed</span>
                  <div className="mono-big">£{spent.toFixed(2)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="micro">of cap</span>
                  <div className="mono-big">£{data.project.budgetCap.toFixed(2)}</div>
                </div>
                <div className="cap-bar" style={{ gridColumn: "1 / -1" }}>
                  <span style={{ width: `${pct * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Recent decisions */}
            <div className="card span-2">
              <div className="card-head">
                <h3>Recent decisions</h3>
                <button className="btn ghost sm" onClick={() => setRoute("decisions")}>
                  <span>Decision log</span><Icons.Open size={11} />
                </button>
              </div>
              <div className="decision-mini">
                {data.decisions.slice(0, 5).map(d => (
                  <div key={d.id} className="dm-row">
                    <span className="dm-date">{d.date.slice(5)}</span>
                    <span className="dm-id">{d.id}</span>
                    <span className="dm-title">{d.title}</span>
                    <span className={"tag " + d.tags[0]}>{d.tags[0]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Open questions */}
            <div className="card">
              <div className="card-head">
                <h3>Open questions</h3>
                <button className="btn ghost sm" onClick={() => setRoute("memory")}>
                  <Icons.Open size={11} />
                </button>
              </div>
              <div className="q-list">
                <div className="q-item q-block">
                  <div className="q-id">Q-003 <span className="q-flag">blocker</span></div>
                  <div className="q-text">STM32 I²C bus locks when PWM ISR fires every 200 µs. DMA or coarser PWM?</div>
                </div>
                <div className="q-item">
                  <div className="q-id">Q-001</div>
                  <div className="q-text">Can we share the buck-boost clock with the MCU without jitter?</div>
                </div>
                <div className="q-item">
                  <div className="q-id">Q-002</div>
                  <div className="q-text">Is the 3.3 Ω bleed resistor really necessary?</div>
                </div>
              </div>
              <button className="btn sm" style={{ width: "100%", marginTop: 8, justifyContent: "center" }} onClick={() => setRoute("chat")}>
                <Icons.Chat size={11} /><span>Ask the assistant</span>
              </button>
            </div>

            {/* Memory activity */}
            <div className="card span-2">
              <div className="card-head">
                <h3>Memory activity</h3>
                <span className="micro">last 24 h</span>
              </div>
              <div className="activity">
                {data.recentMemoryActivity.map((a, i) => (
                  <div key={i} className="act-row">
                    <span className="act-ts">{a.ts}</span>
                    <span className={"act-who " + a.who}>{a.who === "ai" ? "AI" : "you"}</span>
                    <span className="act-text">{a.what}</span>
                  </div>
                ))}
                <div className="act-row">
                  <span className="act-ts">Yesterday</span>
                  <span className="act-who ai">AI</span>
                  <span className="act-text">Linked T-019 ↔ D-002 (bus voltage choice)</span>
                </div>
              </div>
            </div>

            {/* Latest tests */}
            <div className="card">
              <div className="card-head">
                <h3>Latest tests</h3>
                <button className="btn ghost sm" onClick={() => setRoute("tests")}>
                  <Icons.Open size={11} />
                </button>
              </div>
              <div className="test-mini">
                {data.tests.slice(0, 3).map(t => (
                  <div key={t.id} className="tm-row">
                    <span className="tm-id">{t.id}</span>
                    <span className="tm-title">{t.title}</span>
                    <span className="tm-metric">
                      {t.metrics[0][1]}<span style={{ color: "var(--text-faint)", marginLeft: 2 }}>{t.metrics[0][2]}</span>
                    </span>
                    <span className="tm-ts">{t.date.slice(5, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

function Spark({ data, color = "var(--accent)", flat }) {
  const w = 100, h = 22;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - v * (h - 2) - 1;
    return [x, y];
  });
  const path = "M " + pts.map(p => p.join(" ")).join(" L ");
  const area = path + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={area} fill={color} opacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" />
      {!flat && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.8" fill={color} />}
    </svg>
  );
}

window.Overview = Overview;

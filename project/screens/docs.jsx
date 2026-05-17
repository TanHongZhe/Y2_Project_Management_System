// Docs viewer — file tree + content viewer with realistic sample.
const { useState: useStateDocs } = React;

const DOC_CONTENTS = {
  "README.md": {
    type: "md",
    body: (
      <>
        <h1>Smart Grid System</h1>
        <div className="doc-meta">
          <span>README.md</span>
          <span>4.2 kB</span>
          <span>Last edited 2026-05-10</span>
        </div>
        <p>Indoor demonstrator for a small autonomous power system. A 4-cell PV panel charges a 100 F supercap stack through an MPPT-style buck converter (<code>U1</code>). A second SMPS regulates the bus to <code>3.30 V</code> to drive an 8-LED string and an STM32-based comms board.</p>
        <h2>Hardware blocks</h2>
        <pre>{`PV ──▶ U1 (MPPT buck) ──▶ Supercap stack ──▶ U2 (buck-boost) ──▶ 3.30 V bus
                                                                    ├── U3 (LED driver, 8 × 20 mA)
                                                                    └── STM32G031 + I²C peripherals`}</pre>
        <h2>Targets</h2>
        <ul>
          <li>Bus held at <code>3.30 V ± 2%</code> across the full supercap range (1.8 → 5.4 V).</li>
          <li>Ripple ≤ <code>50 mVpp</code> at 20 mA load, 1 kHz PWM injected.</li>
          <li>Total spend ≤ £60. Running tally lives in the component register.</li>
        </ul>
        <h2>Build</h2>
        <pre>{`# firmware
cd firmware/
make PROFILE=mppt flash`}</pre>
      </>
    ),
  },
  "schematic-rev3.pdf": {
    type: "pdf",
    body: (
      <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
        <div style={{
          margin: "0 auto 16px",
          width: 360,
          height: 460,
          background: "repeating-linear-gradient(45deg, var(--bg-sunk) 0, var(--bg-sunk) 8px, var(--bg-elev) 8px, var(--bg-elev) 16px)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-faint)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}>
          schematic preview · 1 / 3
        </div>
        <p style={{ marginBottom: 6 }}>schematic-rev3.pdf · 284 kB · KiCad export, 3 pages</p>
        <button className="btn sm"><Icons.Open /><span>Open in new tab</span></button>
      </div>
    ),
  },
  "mppt.c": {
    type: "code",
    body: (
      <>
        <h1>mppt.c</h1>
        <div className="doc-meta">
          <span>firmware/mppt.c</span>
          <span>5.1 kB</span>
          <span>last edit 2026-05-09</span>
        </div>
        <pre>{`// Perturb-and-Observe MPPT for U1.
// Step: 50 mV / 200 ms. Target: maximise P = V_pv * I_pv.

#include "mppt.h"
#include "stm32g0xx_hal.h"

static int16_t  vref_mv  = 6000;     // start at 6.0 V
static const int16_t STEP = 50;      // mV
static int8_t   dir = +1;
static int32_t  last_p = 0;

void mppt_tick(int16_t v_mv, int16_t i_ma) {
    int32_t p = (int32_t)v_mv * i_ma;
    if (p < last_p) dir = -dir;
    vref_mv += dir * STEP;
    if (vref_mv > 8000) vref_mv = 8000;
    if (vref_mv < 3000) vref_mv = 3000;
    last_p = p;
    set_buck_vref(vref_mv);
}`}</pre>
      </>
    ),
  },
};

function Docs({ data }) {
  const [active, setActiveDocs] = useStateDocs("README.md");
  const [query, setQuery] = useStateDocs("");

  const doc = DOC_CONTENTS[active] || {
    type: "default",
    body: (
      <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
        <div style={{
          margin: "0 auto 16px",
          width: 280,
          height: 320,
          background: "repeating-linear-gradient(45deg, var(--bg-sunk) 0, var(--bg-sunk) 8px, var(--bg-elev) 8px, var(--bg-elev) 16px)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-faint)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}>
          {active.split(".").pop()} · {active}
        </div>
        <p>Preview not rendered for this file type in v1.</p>
      </div>
    )
  };

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · project_docs/</div>
          <h1>Docs <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", marginLeft: 8 }}>{data.docs.reduce((s, g) => s + g.items.length, 0)} files · sync’d from /project_docs</span></h1>
        </div>
        <div className="actions">
          <button className="btn ghost sm"><Icons.Branch /><span>Re-index</span></button>
          <button className="btn primary sm"><Icons.Plus /><span>Upload</span></button>
        </div>
      </header>

      <div className="docs-grid">
        <aside className="docs-side">
          <div className="search">
            <Icons.Search />
            <input
              placeholder="Search docs…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="docs-list">
            {data.docs.map(group => (
              <React.Fragment key={group.group}>
                <div className="group-label">{group.group}</div>
                {group.items
                  .filter(f => !query || f.name.toLowerCase().includes(query.toLowerCase()))
                  .map(f => (
                    <div
                      key={f.name}
                      className={"docs-item" + (active === f.name ? " active" : "")}
                      onClick={() => setActiveDocs(f.name)}
                    >
                      {iconFor(f.name)}
                      <span>{f.name}</span>
                      <span className="size">{f.size}</span>
                    </div>
                  ))}
              </React.Fragment>
            ))}
          </div>
          <div className="docs-drop">
            Drag files here<br />
            <span style={{ color: "var(--text-faint)" }}>to /project_docs</span>
          </div>
        </aside>

        <div className="docs-viewer">
          <div className="doc-content">{doc.body}</div>
        </div>
      </div>
    </>
  );
}

function iconFor(name) {
  if (name.endsWith(".pdf")) return <Icons.Pdf />;
  if (name.endsWith(".c") || name.endsWith(".h") || name.endsWith(".js")) return <Icons.Code />;
  if (name.endsWith(".csv")) return <Icons.File />;
  return <Icons.File />;
}

window.Docs = Docs;

// Decision log — chronological, filterable, exportable.
const { useState: useStateDec } = React;

function Decisions({ data }) {
  const [filter, setFilter] = useStateDec("all");
  const filtered = filter === "all" ? data.decisions : data.decisions.filter(d => d.tags.includes(filter));

  const counts = {
    all: data.decisions.length,
    arch: data.decisions.filter(d => d.tags.includes("arch")).length,
    bus: data.decisions.filter(d => d.tags.includes("bus")).length,
    pv: data.decisions.filter(d => d.tags.includes("pv")).length,
    bom: data.decisions.filter(d => d.tags.includes("bom")).length,
    cost: data.decisions.filter(d => d.tags.includes("cost")).length,
  };

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Decision Log</div>
          <h1>Decisions <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", marginLeft: 8 }}>{data.decisions.length} entries · newest first</span></h1>
        </div>
        <div className="actions">
          <button className="btn ghost sm"><Icons.Filter /><span>Filter</span></button>
          <button className="btn sm"><Icons.Download /><span>Export .md</span></button>
          <button className="btn primary sm"><Icons.Plus /><span>Log decision</span></button>
        </div>
      </header>

      <div style={{ padding: "16px 32px 0", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
        {[
          ["all", "All"], ["arch", "Arch"], ["bus", "Bus"], ["pv", "PV / MPPT"],
          ["bom", "BOM"], ["cost", "Cost"]
        ].map(([k, label]) => (
          <button
            key={k}
            className={"chip" + (filter === k ? " active" : "")}
            onClick={() => setFilter(k)}
            style={{ marginBottom: 12 }}
          >
            {label} <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="body">
        <div className="decision-list">
          {filtered.map(d => (
            <div className="decision" key={d.id}>
              <div className="left">
                <span className="date">{d.date}</span>
                <span className="id">{d.id}</span>
              </div>
              <div className="right">
                <div className="title">{d.title}</div>
                <div className="why">{d.why}</div>
                <div className="tags">
                  {d.tags.map(t => <span key={t} className={"tag " + t}>{t}</span>)}
                  <span style={{ marginLeft: "auto" }} />
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
              No decisions match this filter.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

window.Decisions = Decisions;

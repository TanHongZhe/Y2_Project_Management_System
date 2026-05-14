// Component register — sortable table, status chips, cost tally.
const { useState: useStateComp, useMemo: useMemoComp } = React;

function Components({ data }) {
  const [sort, setSort] = useStateComp({ key: "id", dir: 1 });
  const [filter, setFilter] = useStateComp("all");
  const [query, setQuery] = useStateComp("");

  const filtered = useMemoComp(() => {
    let xs = data.components;
    if (filter !== "all") xs = xs.filter(c => c.status === filter);
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter(c => (c.part + c.model + c.supplier + c.specs).toLowerCase().includes(q));
    }
    const dir = sort.dir;
    xs = [...xs].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return xs;
  }, [data, sort, filter, query]);

  const spent = data.components.filter(c => c.status !== "planned").reduce((s, c) => s + c.cost, 0);
  const committed = data.components.reduce((s, c) => s + c.cost, 0);
  const remain = data.project.budgetCap - spent;
  const pct = Math.min(1, spent / data.project.budgetCap);

  function header(label, key, align) {
    return (
      <th onClick={() => setSort(s => ({ key, dir: s.key === key ? -s.dir : 1 }))} style={align ? { textAlign: align } : null}>
        {label}
        {sort.key === key && <span className="sort">{sort.dir > 0 ? "↑" : "↓"}</span>}
      </th>
    );
  }

  const statusCounts = {
    all: data.components.length,
    installed: data.components.filter(c => c.status === "installed").length,
    received: data.components.filter(c => c.status === "received").length,
    ordered: data.components.filter(c => c.status === "ordered").length,
    planned: data.components.filter(c => c.status === "planned").length,
  };

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · Component Register</div>
          <h1>Components <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-faint)", marginLeft: 8 }}>{data.components.length} parts · £{committed.toFixed(2)} committed</span></h1>
        </div>
        <div className="actions">
          <button className="btn ghost sm"><Icons.Download /><span>CSV</span></button>
          <button className="btn primary sm"><Icons.Plus /><span>Add part</span></button>
        </div>
      </header>

      <div className="table-wrap">
        <div className="filter-row">
          <div className="search">
            <Icons.Search />
            <input
              placeholder="Search parts, models, suppliers…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <span className="kbd">⌘K</span>
          </div>
          <div className="chip-group">
            {[
              ["all", "All"],
              ["installed", "Installed"],
              ["received", "Received"],
              ["ordered", "Ordered"],
              ["planned", "Planned"],
            ].map(([k, l]) => (
              <button
                key={k}
                className={"chip" + (filter === k ? " active" : "")}
                onClick={() => setFilter(k)}
              >
                {l} <span style={{ opacity: 0.5, marginLeft: 4 }}>{statusCounts[k]}</span>
              </button>
            ))}
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              {header("ID", "id")}
              {header("Part", "part")}
              {header("Model", "model")}
              {header("Supplier", "supplier")}
              <th>Key specs</th>
              {header("Status", "status")}
              {header("Cost (£)", "cost", "right")}
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td className="mono" style={{ color: "var(--text-muted)" }}>{c.id}</td>
                <td>{c.part}</td>
                <td className="mono">{c.model}</td>
                <td>{c.supplier}</td>
                <td className="mono" style={{ color: "var(--text-muted)" }}>{c.specs}</td>
                <td><span className={"status-chip " + c.status}>{c.status}</span></td>
                <td className="mono right">{c.cost.toFixed(2)}</td>
                <td className="right">
                  <button className="btn ghost icon-only row-actions" title="More"><Icons.More /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="cost-footer">
          <div className="cell">
            <span className="l">Spent / committed</span>
            <span className="v">£{spent.toFixed(2)}</span>
          </div>
          <div className="cell">
            <span className="l">Budget cap</span>
            <span className="v">£{data.project.budgetCap.toFixed(2)}</span>
          </div>
          <div className="cell">
            <span className="l">Remaining</span>
            <span className={"v" + (remain < 0 ? " over" : "")}>£{remain.toFixed(2)}</span>
          </div>
          <div className={"progress" + (pct > 0.85 ? " warn" : "")}>
            <span style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="cell" style={{ alignItems: "flex-end" }}>
            <span className="l">Used</span>
            <span className="v">{Math.round(pct * 100)}%</span>
          </div>
        </div>
      </div>
    </>
  );
}

window.Components = Components;

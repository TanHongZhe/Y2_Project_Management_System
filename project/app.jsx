// Main app — routing, tweaks, theming.
const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "green",
  "density": "comfortable",
  "surface": "clean",
  "dense": false,
  "debug": false
}/*EDITMODE-END*/;

function App() {
  const [route, setRoute] = useStateApp("overview");
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply theming dataset attributes
  useEffectApp(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.accent = tweaks.accent;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.dataset.surface = tweaks.surface;
  }, [tweaks]);

  const data = window.APP_DATA;

  let screen = null;
  if (route === "overview")       screen = <Overview data={data} setRoute={setRoute} />;
  else if (route === "chat")      screen = <Chat data={data} tweaks={tweaks} setRoute={setRoute} />;
  else if (route === "memory")     screen = <Memory data={data} />;
  else if (route === "decisions")  screen = <Decisions data={data} />;
  else if (route === "components") screen = <Components data={data} />;
  else if (route === "tests")      screen = <Tests data={data} />;
  else if (route === "docs")       screen = <Docs data={data} />;
  else if (route === "settings")   screen = <Settings tweaks={tweaks} setTweak={setTweak} data={data} />;
  else if (route === "empty")      screen = <Empty setRoute={setRoute} />;

  return (
    <div className="app">
      <Sidebar route={route} setRoute={setRoute} data={data} accent={tweaks.accent} />
      <main className="main" data-screen-label={routeLabel(route)}>
        {screen}
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio
          label="Mode"
          value={tweaks.theme}
          onChange={v => setTweak("theme", v)}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
        <TweakRadio
          label="Accent"
          value={tweaks.accent}
          onChange={v => setTweak("accent", v)}
          options={[
            { value: "green", label: "Green" },
            { value: "amber", label: "Amber" },
            { value: "blue", label: "Blue" },
          ]}
        />
        <TweakSection label="Layout" />
        <TweakRadio
          label="Density"
          value={tweaks.density}
          onChange={v => setTweak("density", v)}
          options={[
            { value: "comfortable", label: "Comfy" },
            { value: "compact", label: "Compact" },
          ]}
        />
        <TweakRadio
          label="Surface"
          value={tweaks.surface}
          onChange={v => setTweak("surface", v)}
          options={[
            { value: "clean", label: "Clean" },
            { value: "notebook", label: "Notebook" },
          ]}
        />
        <TweakToggle
          label="Hide chat rail"
          value={tweaks.dense}
          onChange={v => setTweak("dense", v)}
        />

        <TweakSection label="Jump to screen" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "2px 0 4px" }}>
          {[
            ["overview", "Overview"],
            ["chat", "Chat"],
            ["memory", "Memory"],
            ["decisions", "Decisions"],
            ["components", "Components"],
            ["tests", "Tests"],
            ["docs", "Docs"],
            ["settings", "Settings"],
            ["empty", "Empty"],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setRoute(k)}
              style={{
                border: "1px solid var(--line)",
                background: route === k ? "var(--text)" : "var(--bg-elev)",
                color: route === k ? "var(--bg)" : "var(--text)",
                borderRadius: 4,
                padding: "6px 8px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >{l}</button>
          ))}
        </div>
      </TweaksPanel>
    </div>
  );
}

function routeLabel(r) {
  const labels = {
    overview: "Overview", chat: "Chat", memory: "Project Memory", decisions: "Decision Log",
    components: "Component Register", tests: "Test Results", docs: "Docs",
    settings: "Settings", empty: "New Session",
  };
  return labels[r] || r;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

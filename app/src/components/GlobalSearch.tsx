'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import * as Icons from './Icons';

interface GlobalSearchProps {
  setRoute: (r: string) => void;
  onSelectDoc?: (docId: string) => void;
  onSelectMeeting?: (meetingId: string) => void;
}

const ROUTE_FOR: Record<string, string> = {
  components: "components",
  memory: "memory",
  tests: "tests",
  meetings: "meetings",
  chunks: "docs",
};

export default function GlobalSearch({ setRoute, onSelectDoc, onSelectMeeting }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery(
    api.search.globalSearch,
    debounced.length >= 2 ? { q: debounced } : "skip",
  );

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function navigate(route: string) {
    setRoute(route);
    setQuery("");
    setDebounced("");
    setOpen(false);
  }

  const hasResults =
    results &&
    (results.chunks.length > 0 ||
      results.components.length > 0 ||
      results.memory.length > 0 ||
      results.tests.length > 0 ||
      results.meetings.length > 0);

  return (
    <div ref={containerRef} className="gs-wrap">
      <div className={"gs-field" + (open ? " gs-field-open" : "")}>
        <Icons.Search size={13} />
        <input
          ref={inputRef}
          className="gs-input"
          placeholder="Search everything…"
          value={query}
          autoComplete="off"
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setQuery(""); setOpen(false); inputRef.current?.blur(); }
          }}
        />
        {query && (
          <button
            className="gs-clear"
            onClick={() => { setQuery(""); setDebounced(""); inputRef.current?.focus(); }}
          >
            ×
          </button>
        )}
      </div>

      {open && debounced.length >= 2 && (
        <div className="gs-dropdown">
          {!results && <div className="gs-status">Searching…</div>}
          {results && !hasResults && (
            <div className="gs-status">No results for &ldquo;{debounced}&rdquo;</div>
          )}

          {results?.chunks && results.chunks.length > 0 && (
            <Group label="Documents" onNavigate={() => navigate("docs")}>
              {results.chunks.slice(0, 4).map((c, i) => (
                <Item key={i} icon={<Icons.Folder size={12} />} title={c.documentName} sub={c.text.slice(0, 70)} onClick={() => { onSelectDoc?.(c.documentId); navigate("docs"); }} />
              ))}
            </Group>
          )}

          {results?.components && results.components.length > 0 && (
            <Group label="Components" onNavigate={() => navigate("components")}>
              {results.components.map((c, i) => (
                <Item key={i} icon={<Icons.Chip size={12} />} title={c.name} sub={`${c.ref} · ${c.status}`} onClick={() => navigate("components")} />
              ))}
            </Group>
          )}

          {results?.memory && results.memory.length > 0 && (
            <Group label="Project Memory" onNavigate={() => navigate("memory")}>
              {results.memory.map((m, i) => (
                <Item key={i} icon={<Icons.Memory size={12} />} title={m.section} onClick={() => navigate("memory")} />
              ))}
            </Group>
          )}

          {results?.tests && results.tests.length > 0 && (
            <Group label="Test Results" onNavigate={() => navigate("tests")}>
              {results.tests.map((t, i) => (
                <Item key={i} icon={<Icons.Wave size={12} />} title={t.title} sub={t.subsystem} onClick={() => navigate("tests")} />
              ))}
            </Group>
          )}

          {results?.meetings && results.meetings.length > 0 && (
            <Group label="Meeting Notes" onNavigate={() => navigate("meetings")}>
              {results.meetings.map((m, i) => (
                <Item
                  key={i}
                  icon={<Icons.Chat size={12} />}
                  title={m.title}
                  sub={new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  onClick={() => { onSelectMeeting?.(m._id); navigate("meetings"); }}
                />
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, children, onNavigate }: { label: string; children: React.ReactNode; onNavigate: () => void }) {
  return (
    <div className="gs-group">
      <div className="gs-group-label" onClick={onNavigate}>{label}</div>
      {children}
    </div>
  );
}

function Item({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub?: string; onClick: () => void }) {
  return (
    <div className="gs-item" onClick={onClick}>
      <span className="gs-item-icon">{icon}</span>
      <div className="gs-item-body">
        <span className="gs-item-title">{title}</span>
        {sub && <span className="gs-item-sub">{sub}</span>}
      </div>
    </div>
  );
}

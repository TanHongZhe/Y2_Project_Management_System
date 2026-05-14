'use client';

import React, { useState, useRef } from 'react';
import { AppData, MemoryBlock } from '@/lib/data';
import * as Icons from '../Icons';

interface MemoryProps {
  data: AppData;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
    else parts.push(<code key={m.index}>{t.slice(1, -1)}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderBlocks(blocks: MemoryBlock[]): React.ReactNode {
  return blocks.map((b, i) => {
    if (b.type === "p" && b.text) return <p key={i}>{renderInline(b.text)}</p>;
    if (b.type === "ul" && b.items) return <ul key={i}>{b.items.map((x, j) => <li key={j}>{renderInline(x)}</li>)}</ul>;
    if (b.type === "ol" && b.items) return <ol key={i}>{b.items.map((x, j) => <li key={j}>{renderInline(x)}</li>)}</ol>;
    if (b.type === "kv" && b.rows) {
      return (
        <div key={i} className="kv">
          {b.rows.map((r, j) => (
            <React.Fragment key={j}>
              <div className="k">{r[0]}</div>
              <div>{r[1]}</div>
            </React.Fragment>
          ))}
        </div>
      );
    }
    return null;
  });
}

export default function Memory({ data }: MemoryProps) {
  const [activeId, setActiveId] = useState(data.memorySections[0].id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  function jump(id: string) {
    setActiveId(id);
    const el = refs.current[id];
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 20, behavior: "smooth" });
    }
  }

  const totalEntries = data.memorySections.length;
  const lastUpdate = "2026-05-14 11:42";
  const sizeKb = "2.8";

  return (
    <>
      <header className="screen-header">
        <div className="title-block">
          <div className="crumb">Workspace · project_memory.md</div>
          <h1>Project Memory</h1>
        </div>
        <div className="actions">
          <button className="btn ghost sm"><Icons.Eye /><span>Raw markdown</span></button>
          <button className="btn sm"><Icons.Download /><span>Export</span></button>
          <button className="btn primary sm"><Icons.Plus /><span>New section</span></button>
        </div>
      </header>

      <div className="two-col">
        <div className="toc">
          <div style={{ padding: "0 10px 10px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-faint)" }}>
            Sections · {totalEntries}
          </div>
          {data.memorySections.map(s => (
            <div
              key={s.id}
              className={"toc-item" + (activeId === s.id ? " active" : "")}
              onClick={() => jump(s.id)}
            >
              <span className="dot" />
              <span>{s.title}</span>
              <span className="num">{s.id === "decisions" ? "10" : ""}</span>
            </div>
          ))}
        </div>

        <div className="memory-doc" ref={scrollRef}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>
            project_memory.md
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            {data.project.name} — Living Memory
          </h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
            last updated {lastUpdate} · {sizeKb} kB · {totalEntries} sections
          </div>

          <div className="memory-meta-row">
            <div className="meta-card">
              <div className="l">AI writes today</div>
              <div className="v">7</div>
            </div>
            <div className="meta-card">
              <div className="l">Manual edits today</div>
              <div className="v">2</div>
            </div>
            <div className="meta-card">
              <div className="l">Context size</div>
              <div className="v">38 kB</div>
            </div>
            <div className="meta-card">
              <div className="l">Sections</div>
              <div className="v">{totalEntries}</div>
            </div>
          </div>

          {data.memorySections.map(s => (
            <section
              key={s.id}
              className={"memory-section" + (editingId === s.id ? " editing" : "")}
              ref={(el: HTMLElement | null) => { refs.current[s.id] = el; }}
              onMouseEnter={() => setActiveId(s.id)}
            >
              <header>
                <h2>## {s.title}</h2>
                <span className="author">{s.author}</span>
                <span className="updated">updated {s.updated}</span>
                <button className="btn ghost sm edit-btn" onClick={() => setEditingId(editingId === s.id ? null : s.id)}>
                  {editingId === s.id ? <><Icons.Check /><span>Done</span></> : <><Icons.Edit /><span>Edit</span></>}
                </button>
              </header>
              <div
                className="content"
                contentEditable={editingId === s.id}
                suppressContentEditableWarning
              >
                {renderBlocks(s.content)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

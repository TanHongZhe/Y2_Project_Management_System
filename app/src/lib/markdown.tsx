import React from "react";

type Node = React.ReactNode;

const MATH_SYMS: Record<string, string> = {
  rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐",
  leftrightarrow: "↔", Leftrightarrow: "⟺", uparrow: "↑", downarrow: "↓",
  to: "→", gets: "←",
  times: "×", div: "÷", cdot: "·", bullet: "•", pm: "±", mp: "∓",
  leq: "≤", geq: "≥", le: "≤", ge: "≥",
  neq: "≠", ne: "≠", approx: "≈", equiv: "≡", sim: "∼", simeq: "≃",
  infty: "∞", hbar: "ℏ", ell: "ℓ",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
  rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ",
  chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ",
  Pi: "Π", Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  nabla: "∇", partial: "∂",
  forall: "∀", exists: "∃",
  in: "∈", notin: "∉", subset: "⊂", supset: "⊃", subseteq: "⊆", supseteq: "⊇",
  cup: "∪", cap: "∩", emptyset: "∅", varnothing: "∅",
  sum: "∑", prod: "∏", int: "∫", oint: "∮",
  sqrt: "√", circ: "∘", oplus: "⊕", otimes: "⊗",
  ldots: "…", cdots: "⋯", vdots: "⋮",
  angle: "∠", perp: "⊥", parallel: "∥",
  degree: "°",
};

function convertMathSymbols(text: string): string {
  return text.replace(/\$\$?([^$\n]+?)\$\$?/g, (_, inner) => {
    let result = inner.trim();
    result = result.replace(/\\([a-zA-Z]+)\{([^}]*)\}/g, (_: string, name: string, arg: string) => {
      const sym = MATH_SYMS[name];
      return sym ? `${sym}${arg}` : arg;
    });
    result = result.replace(/\\([a-zA-Z]+)/g, (_: string, name: string) => MATH_SYMS[name] ?? `\\${name}`);
    result = result.replace(/[{}]/g, "");
    return result.trim();
  });
}

function parseInline(text: string): Node[] {
  const nodes: Node[] = [];
  // Patterns: **bold**, *italic*, `code`, [text](url)
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={m.index}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(<em key={m.index}>{m[3]}</em>);
    } else if (m[4] !== undefined) {
      nodes.push(<code key={m.index}>{m[4]}</code>);
    } else if (m[5] !== undefined && m[6] !== undefined) {
      nodes.push(
        <a key={m.index} href={m[6]} target="_blank" rel="noopener noreferrer">
          {m[5]}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isTableSeparator(line: string): boolean {
  return /^\|[-:\s|]+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
}

export function renderMarkdown(raw: string, isStreaming = false): Node {
  const text = convertMathSymbols(raw);
  const blocks: Node[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre key={key++}>
          {lang && <span style={{ color: "var(--text-faint)", fontSize: 10, display: "block", marginBottom: 4 }}>{lang}</span>}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // heading
    if (/^#{1,3} /.test(line)) {
      const level = (line.match(/^(#{1,3}) /) as RegExpMatchArray)[1].length;
      const content = line.replace(/^#{1,3} /, "");
      const Tag = `h${level + 2}` as "h3" | "h4" | "h5";
      blocks.push(<Tag key={key++} style={{ margin: "10px 0 4px", fontWeight: 600 }}>{parseInline(content)}</Tag>);
      i++;
      continue;
    }

    // table — header row starts with |
    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <table key={key++} className="md-table">
          <thead>
            <tr>{headers.map((h, hi) => <th key={hi}>{parseInline(h)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => <td key={ci}>{parseInline(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    // blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="md-blockquote">
          {quoteLines.map((ql, qi) => <p key={qi}>{parseInline(ql)}</p>)}
        </blockquote>
      );
      continue;
    }

    // bullet list
    if (/^[-*] /.test(line)) {
      const items: Node[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(<li key={i}>{parseInline(lines[i].replace(/^[-*] /, ""))}</li>);
        i++;
      }
      blocks.push(<ul key={key++}>{items}</ul>);
      continue;
    }

    // numbered list
    if (/^\d+\. /.test(line)) {
      const items: Node[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i}>{parseInline(lines[i].replace(/^\d+\. /, ""))}</li>);
        i++;
      }
      blocks.push(<ol key={key++}>{items}</ol>);
      continue;
    }

    // blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // paragraph
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !/^#{1,3} /.test(lines[i]) &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].startsWith("> ") &&
      !/^[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      blocks.push(<p key={key++}>{parseInline(paraLines.join(" "))}</p>);
    }
  }

  if (blocks.length === 0) return null;

  return (
    <>
      {blocks}
      {isStreaming && <span className="caret" />}
    </>
  );
}

import React from "react";

type Node = React.ReactNode;

function parseInline(text: string): Node[] {
  const nodes: Node[] = [];
  // patterns: **bold**, *italic*, `code`
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3] !== undefined) nodes.push(<em key={m.index}>{m[3]}</em>);
    else if (m[4] !== undefined) nodes.push(<code key={m.index}>{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderMarkdown(text: string, isStreaming = false): Node {
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
      i++; // consume closing ```
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

    // bullet list — collect consecutive items
    if (/^[-*] /.test(line)) {
      const items: Node[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(<li key={i}>{parseInline(lines[i].replace(/^[-*] /, ""))}</li>);
        i++;
      }
      blocks.push(<ul key={key++}>{items}</ul>);
      continue;
    }

    // numbered list — collect consecutive items
    if (/^\d+\. /.test(line)) {
      const items: Node[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i}>{parseInline(lines[i].replace(/^\d+\. /, ""))}</li>);
        i++;
      }
      blocks.push(<ol key={key++}>{items}</ol>);
      continue;
    }

    // blank line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // paragraph — collect until blank line
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("```") && !/^#{1,3} /.test(lines[i]) && !/^[-*] /.test(lines[i]) && !/^\d+\. /.test(lines[i])) {
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

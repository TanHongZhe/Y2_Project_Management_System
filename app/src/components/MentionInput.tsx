'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MENTION_HANDLES, MentionHandle } from '../lib/mentions';

interface MentionInputProps {
  value: string;
  onChange: (next: string) => void;
  currentUserId?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  onBlur?: () => void;
}

interface MentionState {
  from: number;     // index of `@` in textarea value
  query: string;
  index: number;
  filtered: MentionHandle[];
  coords: { left: number; top: number };
  placement: 'below' | 'above';
}

// Mirror the textarea into a hidden div so we can measure the pixel position
// of the caret. Without this the dropdown can only anchor to the textarea's
// edge, which lands far away from where the user is typing.
function caretCoords(el: HTMLTextAreaElement): { left: number; top: number; lineHeight: number } {
  const cs = window.getComputedStyle(el);
  const div = document.createElement('div');
  const copyProps = [
    'boxSizing', 'width', 'height',
    'overflowX', 'overflowY',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
    'lineHeight', 'fontFamily', 'textAlign', 'textTransform',
    'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize',
    'whiteSpace', 'wordWrap', 'wordBreak',
  ] as const;
  for (const p of copyProps) {
    (div.style as unknown as Record<string, string>)[p] = cs.getPropertyValue(p);
  }
  div.style.position = 'absolute';
  div.style.top = '0';
  div.style.left = '0';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';

  const sel = el.selectionStart ?? 0;
  div.textContent = el.value.substring(0, sel);
  const marker = document.createElement('span');
  marker.textContent = el.value.substring(sel) || '.';
  div.appendChild(marker);

  document.body.appendChild(div);
  const taRect = el.getBoundingClientRect();
  const left = taRect.left + marker.offsetLeft - el.scrollLeft;
  const top = taRect.top + marker.offsetTop - el.scrollTop;
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4 || 18;
  document.body.removeChild(div);

  return { left, top, lineHeight };
}

export default function MentionInput({
  value,
  onChange,
  currentUserId,
  placeholder,
  rows,
  className,
  disabled,
  autoFocus,
  style,
  onBlur,
}: MentionInputProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const stateRef = useRef<MentionState | null>(null);
  const [mention, setMention] = useState<MentionState | null>(null);
  stateRef.current = mention;

  const closeMention = useCallback(() => {
    stateRef.current = null;
    setMention(null);
  }, []);

  const detectMention = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const sel = ta.selectionStart ?? 0;
    const selEnd = ta.selectionEnd ?? 0;
    if (sel !== selEnd) { closeMention(); return; }
    const before = ta.value.substring(0, sel);
    const match = before.match(/(?:^|[\s(\[{"'`])@([a-zA-Z]*)$/);
    if (!match) { closeMention(); return; }
    const query = match[1].toLowerCase();
    const atPos = sel - match[1].length - 1;
    const filtered = query
      ? MENTION_HANDLES.filter((h) => h.handle.startsWith(query) || h.name.toLowerCase().includes(query))
      : MENTION_HANDLES;
    if (filtered.length === 0) { closeMention(); return; }
    const c = caretCoords(ta);
    const estHeight = Math.min(filtered.length * 34 + 8, 260);
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - (c.top + c.lineHeight);
    const placeAbove = spaceBelow < estHeight + 12 && c.top > spaceBelow;
    const top = placeAbove
      ? Math.max(8, c.top - estHeight - 4)
      : c.top + c.lineHeight + 4;
    const next: MentionState = {
      from: atPos,
      query,
      index: 0,
      filtered,
      coords: { left: c.left, top },
      placement: placeAbove ? 'above' : 'below',
    };
    stateRef.current = next;
    setMention(next);
  }, [closeMention]);

  function insertMention(handle: string) {
    const s = stateRef.current;
    const ta = taRef.current;
    if (!s || !ta) return;
    const caret = ta.selectionStart ?? 0;
    const before = value.substring(0, s.from);
    const after = value.substring(caret);
    const inserted = `@${handle} `;
    const next = before + inserted + after;
    onChange(next);
    closeMention();
    // Restore caret right after the inserted handle on the next frame so the
    // controlled re-render has landed.
    const newCaret = s.from + inserted.length;
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      taRef.current.focus();
      taRef.current.setSelectionRange(newCaret, newCaret);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const s = stateRef.current;
    if (!s || s.filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (s.index + 1) % s.filtered.length;
      stateRef.current = { ...s, index: next };
      setMention(stateRef.current);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (s.index - 1 + s.filtered.length) % s.filtered.length;
      stateRef.current = { ...s, index: next };
      setMention(stateRef.current);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(s.filtered[s.index].handle);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMention();
    }
  }

  useEffect(() => {
    // Selection change without a value change (e.g. arrow keys) should also
    // close a stale dropdown if the caret moved away from an @ region.
    const ta = taRef.current;
    if (!ta) return;
    const onSel = () => detectMention();
    ta.addEventListener('keyup', onSel);
    ta.addEventListener('click', onSel);
    return () => {
      ta.removeEventListener('keyup', onSel);
      ta.removeEventListener('click', onSel);
    };
  }, [detectMention]);

  return (
    <>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Run detection after the value commit so selection points to the new caret.
          requestAnimationFrame(detectMention);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Slight delay so dropdown clicks still register.
          setTimeout(() => { closeMention(); onBlur?.(); }, 120);
        }}
        placeholder={placeholder}
        rows={rows}
        className={className}
        disabled={disabled}
        autoFocus={autoFocus}
        style={style}
      />
      {mention && mention.filtered.length > 0 && (
        <div
          className={'mention-dropdown mention-' + mention.placement}
          style={{ left: mention.coords.left, top: mention.coords.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {mention.filtered.map((m, i) => {
            const isSelf = m.userId === currentUserId;
            return (
              <button
                key={m.userId}
                type="button"
                className={
                  'mention-item' +
                  (i === mention.index ? ' active' : '') +
                  (m.isBroadcast ? ' mention-broadcast' : '')
                }
                onMouseEnter={() => {
                  if (stateRef.current) {
                    stateRef.current = { ...stateRef.current, index: i };
                    setMention(stateRef.current);
                  }
                }}
                onClick={() => insertMention(m.handle)}
                title={
                  m.isBroadcast
                    ? 'Notify everyone on the team'
                    : isSelf
                      ? "That's you — won't notify yourself"
                      : `Notify ${m.name}`
                }
              >
                <span className="mention-avatar" style={{ background: m.color }}>
                  {m.isBroadcast ? '@' : m.initials}
                </span>
                <span className="mention-name">
                  {m.name}
                  {isSelf && <span className="mention-you"> (you)</span>}
                </span>
                <span className="mention-handle">@{m.handle}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

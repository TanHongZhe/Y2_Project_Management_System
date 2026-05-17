'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { USERS, AppUser } from '../lib/users';
import { MENTION_HANDLES, type MentionHandle } from '../lib/mentions';
import * as Icons from './Icons';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TeamChatProps {
  currentUser: AppUser;
  onNavigate: (route: string, id?: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  buddySprite?: string;
}

const ARIA_USER = USERS.find((u) => u.isAria)!;
const HUMAN_USERS = USERS.filter((u) => !u.isGuest && !u.isAria);

function getUserById(id: string): AppUser {
  return USERS.find((u) => u.id === id) ?? {
    id,
    name: id,
    initials: id.slice(0, 2).toUpperCase(),
    color: '#6b7280',
    avatarUrl: '',
  };
}

function Avatar({ user, size = 24, online }: { user: AppUser; size?: number; online?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="tc-avatar-wrap" style={{ width: size, height: size, flexShrink: 0 }}>
      {!failed && user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className="tc-avatar-img"
          style={{ width: size, height: size, borderRadius: user.isAria ? '50%' : 6 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="tc-avatar-fallback"
          style={{
            width: size,
            height: size,
            background: user.color,
            borderRadius: user.isAria ? '50%' : 6,
            fontSize: size * 0.36,
          }}
        >
          {user.initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className="tc-presence-dot"
          style={{ background: user.isAria ? '#7c3aed' : online ? '#22c55e' : 'transparent' }}
        />
      )}
    </div>
  );
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface MentionDropState {
  type: 'mention';
  query: string;
  atCharPos: number;
  filtered: MentionHandle[];
  index: number;
}

interface ArticleDropState {
  type: 'article';
  query: string;
  slashCharPos: number;
  filtered: Array<{ _id: string; title: string; source?: string }>;
  index: number;
}

type DropState = MentionDropState | ArticleDropState;

// Parse [note:<id> <title>] references from message content
function parseNoteRefs(text: string): Array<{ full: string; id: string; title: string }> {
  const re = /\[note:([a-z0-9]+)\s([^\]]+)\]/gi;
  const refs: Array<{ full: string; id: string; title: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    refs.push({ full: m[0], id: m[1], title: m[2] });
  }
  return refs;
}

// Render message content: split on [note:...] refs and @mentions, produce React nodes
function renderMessageContent(
  text: string,
  onNoteClick: (id: string) => void,
): React.ReactNode {
  const parts = text.split(/(\[note:[a-z0-9]+ [^\]]+\])/gi);
  return parts.map((part, i) => {
    const noteMatch = part.match(/^\[note:([a-z0-9]+)\s([^\]]+)\]$/i);
    if (noteMatch) {
      return (
        <button
          key={i}
          className="tc-note-ref"
          onClick={() => onNoteClick(noteMatch[1])}
        >
          <Icons.Memory size={11} />
          {noteMatch[2]}
        </button>
      );
    }
    // Render plain @mention tokens (no special highlight for @aria in group)
    const mentionParts = part.split(/(@[a-zA-Z]+)/g);
    return mentionParts.map((mp, j) => {
      if (/^@[a-zA-Z]+$/.test(mp)) {
        const handle = mp.slice(1).toLowerCase();
        const found = MENTION_HANDLES.find(h => h.handle === handle);
        if (found) {
          return (
            <span key={`${i}-${j}`} className="tc-mention-token" style={{ color: found.color }}>
              {mp}
            </span>
          );
        }
      }
      return <React.Fragment key={`${i}-${j}`}>{mp}</React.Fragment>;
    });
  });
}

const BUDDY_SPRITES = ['capybara', 'panda', 'hedgehog'] as const;
function pickSprite(s: string): string {
  return s === 'random' ? BUDDY_SPRITES[Math.floor(Math.random() * BUDDY_SPRITES.length)] : s;
}

export default function TeamChat({ currentUser, onNavigate, isOpen, onToggle, buddySprite = 'capybara' }: TeamChatProps) {
  const [activeThreadId, setActiveThreadId] = useState<Id<'chatThreads'> | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [dropState, setDropState] = useState<DropState | null>(null);
  const [attachedNotes, setAttachedNotes] = useState<Array<{ _id: string; title: string }>>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [capySpinning, setCapySpinning] = useState(false);
  const [capyIdling, setCapyIdling] = useState(false);
  const [resolvedSprite, setResolvedSprite] = useState(() => pickSprite(buddySprite));
  const capyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropRef = useRef<DropState | null>(null);
  dropRef.current = dropState;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesLengthRef = useRef(0);
  // "Follow the bottom" intent. Stays true until the user scrolls up. Re-using
  // a distance-based heuristic per-render misses bursts (Aria posts thinking +
  // 2 reply paragraphs back-to-back): the smooth scroll from message N hasn't
  // landed by the time N+1 arrives, so the distance check incorrectly thinks
  // the user scrolled up.
  const followBottomRef = useRef(true);
  // Programmatic scrolls fire onScroll too — guard so we don't mistake our own
  // animation for a user "scroll up" gesture.
  const autoScrollingRef = useRef(false);
  const autoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onlineIds = (useQuery((api as any).heartbeats.getOnlineUserIds, {}) ?? []) as string[];
  const threads = (useQuery((api as any).teamChat.listThreadsForUser, { userId: currentUser.id }) ?? []) as any[];
  const messages = (useQuery(
    (api as any).teamChat.listMessages,
    activeThreadId ? { threadId: activeThreadId } : 'skip',
  ) ?? []) as any[];
  const allNotes = (useQuery(api.meetings.list, {}) ?? []) as Array<{ _id: string; title: string; source?: string }>;
  const userChatState = useQuery(
    (api as any).teamChat.getUserChatState,
    { userId: currentUser.id },
  ) as { panelLastSeenAt: number } | null | undefined;

  const getOrCreateGroup = useMutation((api as any).teamChat.getOrCreateGroup);
  const getOrCreateDm = useMutation((api as any).teamChat.getOrCreateDm);
  const sendMessage = useMutation((api as any).teamChat.sendMessage);
  const clearThread = useMutation((api as any).teamChat.clearThread);
  const markThreadRead = useMutation((api as any).teamChat.markThreadRead);
  const markPanelSeen = useMutation((api as any).teamChat.markPanelSeen);

  // Outer pill badge tracking. Fire markPanelSeen on every open↔close transition,
  // plus on mount-when-open. Skip mount-when-closed so a page refresh while the
  // pill is collapsed does NOT silently clear unread state the user hasn't
  // actually looked at — that was a latent bug in the previous localStorage
  // implementation, where every mount stamped lastSeenAt=now regardless of isOpen.
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (isOpen || wasOpen) {
      void markPanelSeen({ userId: currentUser.id });
    }
  }, [isOpen, currentUser.id, markPanelSeen]);

  // Scroll to bottom instantly whenever the panel opens (even if already in a thread)
  useEffect(() => {
    if (isOpen) {
      followBottomRef.current = true;
      setTimeout(() => scrollMessagesToBottom('instant'), 30);
    }
  }, [isOpen]);

  // Badge only for threads where someone ELSE sent the last message after we last saw it
  const panelLastSeenAt = userChatState?.panelLastSeenAt ?? 0;
  const unreadCount = isOpen ? 0 : threads.filter((t: any) =>
    t.lastMessageAt &&
    t.lastMessageAt > panelLastSeenAt &&
    t.lastAuthorId !== currentUser.id
  ).length;

  // Scroll to bottom on new messages; instant on first load, smooth for new arrivals
  useEffect(() => {
    if (messages.length === 0) return;
    const isFirstLoad = prevMessagesLengthRef.current === 0;
    if (isFirstLoad || followBottomRef.current) {
      scrollMessagesToBottom(isFirstLoad ? 'instant' : 'smooth');
    }
    prevMessagesLengthRef.current = messages.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Focus input when thread opens; mark thread as read on the server; reset scroll tracking.
  // Cleanup on leave stamps a 6s forward-looking grace so Aria's reply chain
  // (thinking + 2 paragraphs + "View Note" footer can land 1-3s after click-back)
  // doesn't immediately re-light the dot. A real teammate message arriving
  // after the window will correctly relight it on their next send.
  useEffect(() => {
    if (activeThreadId) {
      prevMessagesLengthRef.current = 0;
      followBottomRef.current = true;
      setShowScrollDown(false);
      setAttachedNotes([]);
      setDropState(null);
      setTimeout(() => inputRef.current?.focus(), 80);
      const tid = activeThreadId as Id<'chatThreads'>;
      void markThreadRead({ threadId: tid, userId: currentUser.id, grace: 0 });
    }
    return () => {
      if (!activeThreadId) return;
      const tid = activeThreadId as Id<'chatThreads'>;
      void markThreadRead({ threadId: tid, userId: currentUser.id, grace: 6000 });
    };
  }, [activeThreadId, currentUser.id, markThreadRead]);

  const openGroup = useCallback(async () => {
    const id = await getOrCreateGroup({});
    setActiveThreadId(id as Id<'chatThreads'>);
  }, [getOrCreateGroup]);

  const openDm = useCallback(
    async (otherId: string) => {
      const id = await getOrCreateDm({ userId: currentUser.id, otherUserId: otherId });
      setActiveThreadId(id as Id<'chatThreads'>);
    },
    [currentUser.id, getOrCreateDm],
  );

  async function handleSend() {
    const text = inputVal.trim();
    if ((!text && attachedNotes.length === 0) || !activeThreadId) return;
    const noteTokens = attachedNotes.map(n => `[note:${n._id} ${n.title}]`).join(' ');
    const fullContent = noteTokens ? (text ? `${text} ${noteTokens}` : noteTokens) : text;
    setInputVal('');
    setAttachedNotes([]);
    setDropState(null);
    // The user just sent a message — they want to watch the reply. Re-arm
    // follow-bottom in case they were scrolled up reading history.
    followBottomRef.current = true;
    const mentions = (fullContent.match(/@[\w-]+/g) ?? []).map((m) => m.slice(1));
    await sendMessage({ threadId: activeThreadId, authorId: currentUser.id, content: fullContent, mentions });
  }

  function detectDrop(val: string, cursorPos: number) {
    const before = val.slice(0, cursorPos);

    // @mention detection
    const mentionMatch = before.match(/(?:^|[\s])@([a-zA-Z]*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const filtered = query
        ? MENTION_HANDLES.filter(h => h.handle.startsWith(query) || h.name.toLowerCase().includes(query))
        : MENTION_HANDLES;
      if (filtered.length > 0) {
        setDropState({ type: 'mention', query, atCharPos: cursorPos - mentionMatch[1].length - 1, filtered, index: 0 });
        return;
      }
    }

    // /article or /note detection
    const articleMatch = before.match(/(?:^|[\s])\/([a-zA-Z]*)$/);
    if (articleMatch) {
      const query = articleMatch[1].toLowerCase();
      const filtered = query
        ? allNotes.filter(n => n.title.toLowerCase().includes(query))
        : allNotes.slice(0, 8);
      setDropState({ type: 'article', query, slashCharPos: cursorPos - articleMatch[1].length - 1, filtered, index: 0 });
      return;
    }

    setDropState(null);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInputVal(val);
    detectDrop(val, e.target.selectionStart ?? val.length);
  }

  function insertMention(handle: string) {
    const d = dropRef.current;
    if (!d || d.type !== 'mention') return;
    const before = inputVal.slice(0, d.atCharPos);
    const after = inputVal.slice(inputRef.current?.selectionStart ?? inputVal.length);
    const next = before + `@${handle} ` + after;
    setInputVal(next);
    setDropState(null);
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + handle.length + 2;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  function insertNoteRef(note: { _id: string; title: string }) {
    const d = dropRef.current;
    if (!d || d.type !== 'article') return;
    // Already attached — don't duplicate
    if (attachedNotes.some(n => n._id === note._id)) {
      setDropState(null);
      return;
    }
    // Remove the /word trigger from the input
    const before = inputVal.slice(0, d.slashCharPos);
    const after = inputVal.slice(inputRef.current?.selectionStart ?? inputVal.length);
    setInputVal((before + after).replace(/\s+$/, '') + (before + after ? ' ' : ''));
    setAttachedNotes(prev => [...prev, note]);
    setDropState(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const d = dropRef.current;
    if (d) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const len = d.type === 'mention' ? d.filtered.length : d.filtered.length;
        setDropState({ ...d, index: (d.index + 1) % len } as DropState);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const len = d.type === 'mention' ? d.filtered.length : d.filtered.length;
        setDropState({ ...d, index: (d.index - 1 + len) % len } as DropState);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (d.type === 'mention') insertMention(d.filtered[d.index].handle);
        else insertNoteRef(d.filtered[d.index]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setDropState(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // Thread display name
  function threadLabel(t: any): string {
    if (t.type === 'group') return 'General';
    const other = t.participants.find((p: string) => p !== currentUser.id);
    return other ? getUserById(other).name : 'DM';
  }

  function threadOtherUser(t: any): AppUser | null {
    if (t.type === 'group') return null;
    const other = t.participants.find((p: string) => p !== currentUser.id);
    return other ? getUserById(other) : null;
  }

  function hasUnread(t: any): boolean {
    if (t._id === activeThreadId) return false; // currently reading
    const lastRead = t.readBy?.[currentUser.id] ?? 0;
    return !!(
      t.lastMessageAt &&
      t.lastMessageAt > lastRead &&
      t.lastAuthorId !== currentUser.id
    );
  }

  async function handleClearThread() {
    if (!activeThreadId || !activeOther?.isAria) return;
    await clearThread({ threadId: activeThreadId });
    void markThreadRead({ threadId: activeThreadId, userId: currentUser.id, grace: 0 });
  }

  function handleCapyClick(e: React.MouseEvent) {
    e.stopPropagation();
    setCapyIdling(false);
    if (capyTimerRef.current) clearTimeout(capyTimerRef.current);
    setCapySpinning(true);
    capyTimerRef.current = setTimeout(() => {
      setCapySpinning(false);
      capyTimerRef.current = null;
    }, 2800);
  }

  // Re-resolve sprite (re-rolls random) whenever the setting changes
  useEffect(() => {
    setResolvedSprite(pickSprite(buddySprite));
  }, [buddySprite]);

  // Random idle nudge: play one hover cycle at a random interval (5–30 s)
  useEffect(() => {
    if (buddySprite === 'none') return;
    let id: ReturnType<typeof setTimeout>;
    function loop() {
      id = setTimeout(() => {
        setCapyIdling(true);
        setTimeout(() => setCapyIdling(false), 850);
        loop();
      }, 5_000 + Math.random() * 25_000);
    }
    loop();
    return () => clearTimeout(id);
  }, [buddySprite]);

  useEffect(() => {
    return () => { if (capyTimerRef.current) clearTimeout(capyTimerRef.current); };
  }, []);

  function handleMsgsScroll() {
    const el = msgsRef.current;
    if (!el) return;
    // Ignore scroll events that came from our own scrollIntoView animation —
    // they would otherwise toggle follow-bottom off mid-animation.
    if (autoScrollingRef.current) {
      setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
      return;
    }
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    followBottomRef.current = distFromBottom < 120;
    setShowScrollDown(distFromBottom > 120);
  }

  // Scroll the messages list to the bottom and flag the action as programmatic
  // so the onScroll handler doesn't misinterpret it as the user scrolling.
  function scrollMessagesToBottom(behavior: ScrollBehavior = 'smooth') {
    autoScrollingRef.current = true;
    followBottomRef.current = true;
    setShowScrollDown(false);
    messagesEndRef.current?.scrollIntoView({ behavior });
    if (autoScrollTimerRef.current) clearTimeout(autoScrollTimerRef.current);
    // Smooth scroll typically settles within ~400ms even for long jumps. Hold
    // the guard a bit longer to cover slower devices and back-to-back animations.
    autoScrollTimerRef.current = setTimeout(() => {
      autoScrollingRef.current = false;
    }, behavior === 'instant' ? 60 : 700);
  }

  function scrollToBottom() {
    scrollMessagesToBottom('smooth');
  }

  // Active thread's partner (for DMs)
  const activeThread = threads.find((t: any) => t._id === activeThreadId);
  const activeOther = activeThread ? threadOtherUser(activeThread) : null;
  const activeLabel = activeThread ? threadLabel(activeThread) : '';

  // Online humans (excl. aria — she's always "on")
  const onlineHumans = HUMAN_USERS.filter((u) => onlineIds.includes(u.id) && u.id !== currentUser.id);

  return (
    <div className={'tc-root' + (isOpen ? ' open' : '')}>
      {/* ── Collapsed pill ─────────────────────────────────────── */}
      {!isOpen && (
        <>
        {/* Pixel buddy sitting above the pill — hover/idle to animate, click to spin */}
        {buddySprite !== 'none' && (
          <div
            className={`capy-sprite${capyIdling ? ' capy-idling' : ''}${capySpinning ? ' capy-spinning' : ''}`}
            onClick={handleCapyClick}
            title="(◕‿◕)"
            style={{ backgroundImage: `url('/${resolvedSprite}_sprite.png')` }}
          />
        )}
        <button className="tc-pill" onClick={onToggle} title="Team chat (C)">
          {unreadCount > 0 && (
            <span className="tc-unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
          <div className="tc-pill-avatars">
            {[...onlineHumans.slice(0, 2), ARIA_USER].map((u) => (
              <div key={u.id} className="tc-pill-avatar-wrap">
                <Avatar user={u} size={22} />
                <span
                  className="tc-presence-dot"
                  style={{ background: u.isAria ? '#7c3aed' : '#22c55e' }}
                />
              </div>
            ))}
          </div>
          <span className="tc-pill-label">Team</span>
        </button>
        </>
      )}

      {/* ── Expanded panel ─────────────────────────────────────── */}
      {isOpen && (
        <div className="tc-panel">
          {/* Header */}
          <div className="tc-header">
            {activeThreadId ? (
              <>
                <button className="tc-back" onClick={() => setActiveThreadId(null)}>
                  <Icons.ChevronLeft size={14} />
                </button>
                <div className="tc-header-title">
                  {activeOther ? (
                    <Avatar user={activeOther} size={20} online={activeOther.isAria || onlineIds.includes(activeOther.id)} />
                  ) : (
                    <span className="tc-group-icon">#</span>
                  )}
                  <span>{activeLabel}</span>
                  {activeOther?.isAria && <span className="tc-aria-tag">AI Agent</span>}
                </div>
                {activeOther?.isAria && (
                  <button className="tc-clear-btn" onClick={handleClearThread} title="Clear conversation">
                    <Icons.Trash size={12} />
                  </button>
                )}
              </>
            ) : (
              <span className="tc-header-title-text">Team Chat</span>
            )}
            <button className="tc-close" onClick={onToggle}>
              <Icons.X size={13} />
            </button>
          </div>

          {/* Thread list */}
          {!activeThreadId && (
            <div className="tc-thread-list">
              {/* Group */}
              {(() => {
                const gt = threads.find((t: any) => t.type === 'group');
                return (
                  <button className="tc-thread-row" onClick={openGroup}>
                    <span className="tc-group-icon-lg">#</span>
                    <div className="tc-thread-info">
                      <span className="tc-thread-name">General</span>
                      <span className="tc-thread-sub">Team · {onlineHumans.length + 1} online</span>
                    </div>
                    {gt && hasUnread(gt) && <span className="tc-unread-dot" />}
                    <Icons.ChevronRight size={13} />
                  </button>
                );
              })()}

              <div className="tc-divider"><span>Direct messages</span></div>

              {/* Aria DM */}
              {(() => {
                const at = threads.find((t: any) => t.type === 'dm' && t.participants?.includes('aria'));
                return (
                  <button className="tc-thread-row" onClick={() => openDm('aria')}>
                    <Avatar user={ARIA_USER} size={28} online />
                    <div className="tc-thread-info">
                      <span className="tc-thread-name">Aria <span className="tc-aria-tag">AI Agent</span></span>
                      <span className="tc-thread-sub">Always on · @aria to assign tasks</span>
                    </div>
                    {at && hasUnread(at) && <span className="tc-unread-dot" />}
                    <Icons.ChevronRight size={13} />
                  </button>
                );
              })()}

              {/* Human DMs */}
              {HUMAN_USERS.filter((u) => u.id !== currentUser.id).map((u) => {
                const isOnline = onlineIds.includes(u.id);
                const dt = threads.find((t: any) =>
                  t.type === 'dm' && t.participants?.includes(u.id) && t.participants?.includes(currentUser.id)
                );
                return (
                  <button key={u.id} className="tc-thread-row" onClick={() => openDm(u.id)}>
                    <Avatar user={u} size={28} online={isOnline} />
                    <div className="tc-thread-info">
                      <span className="tc-thread-name">{u.name}</span>
                      <span className="tc-thread-sub">{isOnline ? 'Online now' : 'Offline'}</span>
                    </div>
                    {dt && hasUnread(dt) && <span className="tc-unread-dot" />}
                    <Icons.ChevronRight size={13} />
                  </button>
                );
              })}
            </div>
          )}

          {/* Messages */}
          {activeThreadId && (
            <>
              <div className="tc-messages-wrap">
                <div className="tc-messages" ref={msgsRef} onScroll={handleMsgsScroll}>
                {messages.length === 0 && (
                  <div className="tc-empty">
                    {activeOther?.isAria
                      ? 'Say hi to Aria! Message her directly or use @aria anywhere to assign her a task.'
                      : 'No messages yet. Say something! 👋'}
                  </div>
                )}
                {messages.map((msg: any, i: number) => {
                  const isMe = msg.authorId === currentUser.id;
                  const author = getUserById(msg.authorId);
                  const isAria = msg.authorId === 'aria';
                  const showAvatar = i === 0 || messages[i - 1]?.authorId !== msg.authorId;
                  const groupGap = i > 0 && messages[i - 1]?.authorId !== msg.authorId;

                  return (
                    <div
                      key={msg._id}
                      className={'tc-msg-row' + (isMe ? ' me' : '') + (isAria ? ' aria' : '') + (groupGap ? ' tc-group-gap' : '')}
                    >
                      {!isMe && (
                        <div className="tc-msg-avatar">
                          {showAvatar ? <Avatar user={author} size={26} /> : <div style={{ width: 26 }} />}
                        </div>
                      )}
                      <div className="tc-msg-body">
                        {showAvatar && !isMe && (
                          <div className="tc-msg-meta">
                            <span className="tc-msg-name" style={{ color: author.color }}>
                              {author.name}
                              {isAria && <span className="tc-aria-tag">AI Agent</span>}
                            </span>
                            <span className="tc-msg-time">{fmtTime(msg.createdAt)}</span>
                          </div>
                        )}
                        <div className={'tc-bubble' + (isMe ? ' me' : '') + (isAria ? ' aria' : '')}>
                          <span className="tc-bubble-text">
                            {renderMessageContent(msg.content, (id) => {
                              onNavigate('meetings', id);
                              onToggle();
                            })}
                          </span>
                          {msg.ariaTaskNoteId && (
                            <button
                              className="tc-view-note-btn"
                              onClick={() => {
                                onNavigate('meetings', msg.ariaTaskNoteId);
                                onToggle();
                              }}
                            >
                              <Icons.Memory size={11} />
                              View Note
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                  <div ref={messagesEndRef} />
                </div>
              </div>{/* end tc-messages-wrap */}

              {/* Input */}
              <div className="tc-input-row" style={{ position: 'relative' }}>
                {showScrollDown && (
                  <button className="tc-scroll-down" onClick={scrollToBottom} title="Scroll to bottom">
                    <Icons.ChevronDown size={14} />
                  </button>
                )}
                {/* @ mention dropdown */}
                {dropState?.type === 'mention' && dropState.filtered.length > 0 && (
                  <div className="tc-drop" onMouseDown={(e) => e.preventDefault()}>
                    {dropState.filtered.map((m, i) => (
                      <button
                        key={m.userId}
                        type="button"
                        className={'tc-drop-item' + (i === dropState.index ? ' active' : '')}
                        onMouseEnter={() => setDropState({ ...dropState, index: i })}
                        onClick={() => insertMention(m.handle)}
                      >
                        {m.userId === 'aria' ? (
                          <span className="tc-drop-avatar tc-drop-avatar-img">
                            <img src={ARIA_USER.avatarUrl} alt="Aria" />
                          </span>
                        ) : (
                          <span className="tc-drop-avatar" style={{ background: m.color }}>
                            {m.isBroadcast ? '@' : m.initials}
                          </span>
                        )}
                        <span className="tc-drop-name">{m.name}</span>
                        <span className="tc-drop-handle">@{m.handle}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* /article note dropdown */}
                {dropState?.type === 'article' && dropState.filtered.length > 0 && (
                  <div className="tc-drop" onMouseDown={(e) => e.preventDefault()}>
                    {dropState.filtered.map((n, i) => (
                      <button
                        key={n._id}
                        type="button"
                        className={'tc-drop-item' + (i === dropState.index ? ' active' : '') + (attachedNotes.some(a => a._id === n._id) ? ' tc-drop-item-attached' : '')}
                        onMouseEnter={() => setDropState({ ...dropState, index: i })}
                        onClick={() => insertNoteRef(n)}
                      >
                        <Icons.Memory size={12} />
                        <span className="tc-drop-name">{n.title}</span>
                        <span className="tc-drop-handle">{n.source ?? 'note'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Attached note chips */}
                {attachedNotes.length > 0 && (
                  <div className="tc-attached-notes" onMouseDown={(e) => e.preventDefault()}>
                    {attachedNotes.map(n => (
                      <span key={n._id} className="tc-attached-chip">
                        <Icons.Memory size={14} />
                        <span className="tc-attached-title">{n.title}</span>
                        <button
                          type="button"
                          className="tc-attached-remove"
                          onClick={() => setAttachedNotes(prev => prev.filter(a => a._id !== n._id))}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
                <textarea
                  ref={inputRef}
                  className="tc-input"
                  value={inputVal}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onBlur={() => setTimeout(() => setDropState(null), 150)}
                  placeholder={activeOther?.isAria ? '@aria write me a note on…' : 'Message… (Enter to send, @ to mention, / for notes)'}
                  rows={2}
                />
                <button
                  className="tc-send-btn"
                  onClick={handleSend}
                  disabled={!inputVal.trim() && attachedNotes.length === 0}
                >
                  <Icons.Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

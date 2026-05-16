'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import * as Icons from './Icons';

interface NotificationBellProps {
  userId: string;
  onNotificationClick: (route: string, linkId?: string) => void;
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationBell({ userId, onNotificationClick }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const notifs = useQuery(api.notifications.list, { userId, limit: 20 });
  const unread = useQuery(api.notifications.unreadCount, { userId });
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function handleItemClick(n: NonNullable<typeof notifs>[number]) {
    if (!n.read) void markRead({ id: n._id as Id<'notifications'> });
    if (n.linkRoute) onNotificationClick(n.linkRoute, n.linkId);
    setOpen(false);
  }

  const count = unread ?? 0;

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className="btn ghost icon-only notif-bell"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
      >
        <Icons.Bell size={16} />
        {count > 0 && <span className="notif-badge">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">Notifications</span>
            {count > 0 && (
              <button
                className="notif-mark-all"
                onClick={() => void markAllRead({ userId })}
              >
                Mark all read
              </button>
            )}
          </div>
          {!notifs || notifs.length === 0 ? (
            <div className="notif-empty">No notifications yet.</div>
          ) : (
            <div className="notif-list">
              {notifs.map((n) => (
                <div
                  key={n._id}
                  className={'notif-item' + (n.read ? '' : ' unread')}
                  onClick={() => handleItemClick(n)}
                >
                  <div className="notif-msg">{n.message}</div>
                  <div className="notif-time">{relativeTime(n.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

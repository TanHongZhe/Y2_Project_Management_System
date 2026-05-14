'use client';

import React, { useState } from 'react';
import { USERS, AppUser } from '../../lib/users';

function UserAvatar({ user }: { user: AppUser }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="login-avatar-fallback" style={{ background: user.color }}>
        {user.initials}
      </div>
    );
  }

  return (
    <div className="login-avatar-wrap" title={user.name}>
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="login-avatar-img"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

interface LoginProps {
  onSelect: (user: AppUser) => void;
}

export default function Login({ onSelect }: LoginProps) {
  return (
    <div className="login-screen">
      <div className="login-inner">
        <div className="login-header">
          <div className="login-logo">Y2 PMS</div>
          <h1 className="login-title">Who's using this?</h1>
          <p className="login-sub">Solar Bus Demonstrator · ENG2-SYS · Spring 26</p>
        </div>

        <div className="login-grid">
          {USERS.map(user => (
            <button
              key={user.id}
              className="login-card"
              onClick={() => onSelect(user)}
            >
              <UserAvatar user={user} />
              <span className="login-name">{user.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

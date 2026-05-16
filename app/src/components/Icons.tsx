'use client';

import React from 'react';

interface IconProps {
  size?: number;
  fill?: string;
  stroke?: string;
  sw?: number;
  className?: string;
}

const Icon = ({ d, size = 14, fill = "none", stroke = "currentColor", sw = 1.6, children, vb = 24, className }: IconProps & { d?: string; children?: React.ReactNode; vb?: number }) => (
  <svg className={`icon${className ? ' ' + className : ''}`} width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

export const Dash = (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="8" height="9" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="14" width="8" height="7" rx="1"/></Icon>;
export const Chat = (p: IconProps) => <Icon {...p} d="M21 12a8 8 0 0 1-8 8H6l-3 3v-11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />;
export const Memory = (p: IconProps) => <Icon {...p}><path d="M4 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4z" /><path d="M4 9h16M4 15h16M9 5v14" /></Icon>;
export const Gavel = (p: IconProps) => <Icon {...p}><path d="M13 4l7 7-3 3-7-7z" /><path d="M9 11l-5 5 3 3 5-5" /><path d="M14 14l4 4" /></Icon>;
export const Chip = (p: IconProps) => <Icon {...p}><rect x="6" y="6" width="12" height="12" rx="1.5" /><path d="M9 6V3M12 6V3M15 6V3M9 21v-3M12 21v-3M15 21v-3M6 9H3M6 12H3M6 15H3M21 9h-3M21 12h-3M21 15h-3" /></Icon>;
export const Wave = (p: IconProps) => <Icon {...p}><path d="M3 12h3l2-6 4 12 3-8 2 4h4" /></Icon>;
export const Folder = (p: IconProps) => <Icon {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
export const Cog = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Icon>;
export const Send = (p: IconProps) => <Icon {...p}><path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></Icon>;
export const Bolt = (p: IconProps) => <Icon {...p} d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />;
export const Search = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>;
export const Plus = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const Edit = (p: IconProps) => <Icon {...p}><path d="M17 3a2.8 2.8 0 1 1 4 4L8 20l-5 1 1-5z" /></Icon>;
export const Check = (p: IconProps) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>;
export const X = (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const Eye = (p: IconProps) => <Icon {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Icon>;
export const EyeOff = (p: IconProps) => <Icon {...p}><path d="m1 1 22 22M9.9 5.1A10 10 0 0 1 12 4c7 0 11 8 11 8a17.3 17.3 0 0 1-3.4 4.6M6.6 6.6A17 17 0 0 0 1 12s4 8 11 8a10 10 0 0 0 5.4-1.6" /></Icon>;
export const File = (p: IconProps) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></Icon>;
export const Code = (p: IconProps) => <Icon {...p}><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></Icon>;
export const Pdf = (p: IconProps) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h1.5a1.5 1.5 0 1 1 0 3H8zM8 16v2M13 13v5M13 13h1.5a1.5 1.5 0 1 1 0 3H13M17 13v5M17 13h2.5M17 15.5h2" strokeWidth="1.2" /></Icon>;
export const ArrowUp = (p: IconProps) => <Icon {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>;
export const SwitchArrows = (p: IconProps) => <Icon {...p}><path d="M17 4l4 4-4 4M3 8h18M7 20l-4-4 4-4M21 16H3" /></Icon>;
export const ChevronLeft = (p: IconProps) => <Icon {...p}><path d="M15 18l-6-6 6-6" /></Icon>;
export const ChevronRight = (p: IconProps) => <Icon {...p}><path d="M9 18l6-6-6-6" /></Icon>;
export const Download = (p: IconProps) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>;
export const Filter = (p: IconProps) => <Icon {...p}><path d="M3 4h18l-7 9v6l-4-2v-4z" /></Icon>;
export const Clock = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const Branch = (p: IconProps) => <Icon {...p}><circle cx="6" cy="3" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 5v8a4 4 0 0 0 4 4h6"/></Icon>;
export const Trash = (p: IconProps) => <Icon {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6z" /></Icon>;
export const More = (p: IconProps) => <Icon {...p}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></Icon>;
export const Sun = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></Icon>;
export const Moon = (p: IconProps) => <Icon {...p} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>;
export const Open = (p: IconProps) => <Icon {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></Icon>;
export const Star = ({ fill = "none", ...p }: IconProps) => <Icon {...p} fill={fill}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Icon>;
export const Restart = (p: IconProps) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></Icon>;
export const Paperclip = (p: IconProps) => <Icon {...p}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></Icon>;
export const Menu = (p: IconProps) => <Icon {...p}><path d="M3 12h18M3 6h18M3 18h18" /></Icon>;
export const Image = (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></Icon>;
export const Bold = (p: IconProps) => <Icon {...p}><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></Icon>;
export const Italic = (p: IconProps) => <Icon {...p}><path d="M19 4h-9M14 20H5M15 4 9 20" /></Icon>;
export const ListBullet = (p: IconProps) => <Icon {...p}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/></Icon>;
export const TableIcon = (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></Icon>;
export const Mic = (p: IconProps) => <Icon {...p}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6"/></Icon>;
export const StopCircle = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none"/></Icon>;
export const Play = (p: IconProps) => <Icon {...p}><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/></Icon>;
export const Pause = (p: IconProps) => <Icon {...p}><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/></Icon>;
export const SkipBack = (p: IconProps) => <Icon {...p}><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></Icon>;
export const SkipForward = (p: IconProps) => <Icon {...p}><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></Icon>;
export const Bell = (p: IconProps) => <Icon {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></Icon>;

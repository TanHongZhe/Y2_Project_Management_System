// Inline SVG icons. Stroke-based, 14×14 default.
const Icon = ({ d, size = 14, fill = "none", stroke = "currentColor", sw = 1.6, children, vb = 24 }) => (
  <svg className="icon" width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

const Icons = {
  Dash:    (p) => <Icon {...p}><rect x="3" y="3" width="8" height="9" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="14" width="8" height="7" rx="1"/></Icon>,
  Chat:    (p) => <Icon {...p} d="M21 12a8 8 0 0 1-8 8H6l-3 3v-11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />,
  Memory:  (p) => <Icon {...p}><path d="M4 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4z" /><path d="M4 9h16M4 15h16M9 5v14" /></Icon>,
  Gavel:   (p) => <Icon {...p}><path d="M13 4l7 7-3 3-7-7z" /><path d="M9 11l-5 5 3 3 5-5" /><path d="M14 14l4 4" /></Icon>,
  Chip:    (p) => <Icon {...p}><rect x="6" y="6" width="12" height="12" rx="1.5" /><path d="M9 6V3M12 6V3M15 6V3M9 21v-3M12 21v-3M15 21v-3M6 9H3M6 12H3M6 15H3M21 9h-3M21 12h-3M21 15h-3" /></Icon>,
  Wave:    (p) => <Icon {...p}><path d="M3 12h3l2-6 4 12 3-8 2 4h4" /></Icon>,
  Folder:  (p) => <Icon {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  Cog:     (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Icon>,
  Send:    (p) => <Icon {...p}><path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></Icon>,
  Bolt:    (p) => <Icon {...p} d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
  Search:  (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>,
  Plus:    (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>,
  Edit:    (p) => <Icon {...p}><path d="M17 3a2.8 2.8 0 1 1 4 4L8 20l-5 1 1-5z" /></Icon>,
  Check:   (p) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>,
  X:       (p) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>,
  Eye:     (p) => <Icon {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Icon>,
  EyeOff:  (p) => <Icon {...p}><path d="m1 1 22 22M9.9 5.1A10 10 0 0 1 12 4c7 0 11 8 11 8a17.3 17.3 0 0 1-3.4 4.6M6.6 6.6A17 17 0 0 0 1 12s4 8 11 8a10 10 0 0 0 5.4-1.6" /></Icon>,
  File:    (p) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></Icon>,
  Code:    (p) => <Icon {...p}><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></Icon>,
  Pdf:     (p) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h1.5a1.5 1.5 0 1 1 0 3H8zM8 16v2M13 13v5M13 13h1.5a1.5 1.5 0 1 1 0 3H13M17 13v5M17 13h2.5M17 15.5h2" stroke-width="1.2" /></Icon>,
  ArrowUp: (p) => <Icon {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>,
  Download:(p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Icon>,
  Filter:  (p) => <Icon {...p}><path d="M3 4h18l-7 9v6l-4-2v-4z" /></Icon>,
  Clock:   (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>,
  Branch:  (p) => <Icon {...p}><circle cx="6" cy="3" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 5v8a4 4 0 0 0 4 4h6"/></Icon>,
  Trash:   (p) => <Icon {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6z" /></Icon>,
  More:    (p) => <Icon {...p}><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></Icon>,
  Sun:     (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></Icon>,
  Moon:    (p) => <Icon {...p} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>,
  Tweak:   (p) => <Icon {...p}><path d="M4 6h10M4 12h6M4 18h13"/><circle cx="18" cy="6" r="2"/><circle cx="14" cy="12" r="2"/><circle cx="21" cy="18" r="2"/></Icon>,
  Open:    (p) => <Icon {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/></Icon>,
  Boost:   (p) => <Icon {...p}><path d="M5 13l3 3 11-11"/><path d="M8 16l4-4 4 4"/></Icon>,
  Restart: (p) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></Icon>,
};

window.Icons = Icons;

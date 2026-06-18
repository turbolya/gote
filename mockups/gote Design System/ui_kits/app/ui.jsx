// Shared chrome + mini-primitives for the gote UI kit. Self-contained (no
// bundle dependency) so the prototype renders standalone; visuals mirror the
// design-system components 1:1.
const ACCENT_FG = {
  green: 'var(--accent-green-fg)', blue: 'var(--accent-blue-fg)',
  violet: 'var(--accent-violet-fg)', amber: 'var(--accent-amber-fg)',
  teal: 'var(--accent-teal-fg)', indigo: 'var(--accent-indigo-fg)',
  rose: 'var(--accent-rose-fg)', slate: 'var(--accent-slate-fg)',
};
const ACCENT_BG = {
  green: 'var(--accent-green-bg)', blue: 'var(--accent-blue-bg)',
  violet: 'var(--accent-violet-bg)', amber: 'var(--accent-amber-bg)',
  teal: 'var(--accent-teal-bg)', indigo: 'var(--accent-indigo-bg)',
  rose: 'var(--accent-rose-bg)', slate: 'var(--accent-slate-bg)',
};

// iOS status bar — white (over photo/hero) or dark (on light screens).
function StatusBar({ dark = false }) {
  const c = dark ? 'var(--text)' : '#fff';
  return (
    <div style={{ height: 54, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      padding: '0 28px 8px', flex: 'none' }}>
      <span style={{ color: c, fontWeight: 700, fontSize: 15, letterSpacing: 0.2 }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: c }}>
        <ion-icon name="cellular" style={{ fontSize: 16 }}></ion-icon>
        <ion-icon name="wifi" style={{ fontSize: 16 }}></ion-icon>
        <ion-icon name="battery-full" style={{ fontSize: 19 }}></ion-icon>
      </div>
    </div>
  );
}

function HomeIndicator({ dark = false }) {
  return (
    <div style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <div style={{ width: 134, height: 5, borderRadius: 999,
        background: dark ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.9)' }} />
    </div>
  );
}

// Sub-screen header: round back button, centered title, spacer.
function ScreenHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px 6px' }}>
      <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 'none',
        background: 'var(--faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <ion-icon name="chevron-back" style={{ fontSize: 22, color: 'var(--text)' }}></ion-icon>
      </button>
      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
      <div style={{ width: 40 }} />
    </div>
  );
}

// Menu/list row.
function ListRow({ icon, accent = 'green', title, sub, divider, trailing, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 0',
      cursor: 'pointer', borderTop: divider ? '1px solid var(--border)' : 'none' }}>
      <ion-icon name={icon} style={{ fontSize: 24, width: 28, textAlign: 'center', color: ACCENT_FG[accent] }}></ion-icon>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-row)', fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize: 'var(--text-sub)', color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}
      </div>
      {trailing !== undefined ? trailing :
        <ion-icon name="chevron-forward" style={{ fontSize: 20, color: 'var(--muted)' }}></ion-icon>}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 'var(--text-label)', fontWeight: 800, textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-label)', color: 'var(--section-label)', margin: '22px 0 4px 2px' }}>
      {children}
    </div>
  );
}

function Button({ variant = 'primary', tone = 'primary', icon, iconRight, children, onClick, style }) {
  const tints = {
    primary: { background: 'var(--action-primary-bg)', color: 'var(--action-primary-fg)', borderColor: '#b7dde8' },
    orange: { background: 'var(--action-orange-bg)', color: 'var(--action-orange-fg)', borderColor: '#f6d2b3' },
  };
  const variants = {
    primary: { background: 'var(--primary)', color: '#fff', fontWeight: 900, boxShadow: 'var(--shadow-primary)' },
    success: { background: 'var(--correct)', color: '#fff' },
    danger: { background: 'var(--wrong)', color: '#fff' },
    tinted: tints[tone],
    outline: { background: 'transparent', color: '#fff', border: '2px solid #fff' },
  };
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: 8, width: '100%', boxSizing: 'border-box', fontSize: 'var(--text-body)', fontWeight: 800, lineHeight: 1,
      padding: '15px 22px', borderRadius: 'var(--radius-lg)', border: '1px solid transparent', cursor: 'pointer',
      ...variants[variant], ...style }}>
      {icon && <ion-icon name={icon} style={{ fontSize: 19 }}></ion-icon>}
      <span>{children}</span>
      {iconRight && <ion-icon name={iconRight} style={{ fontSize: 19 }}></ion-icon>}
    </button>
  );
}

function StatPill({ icon, children, onBrand }) {
  const skin = onBrand ? { background: 'rgba(255,255,255,0.16)', color: '#fff' }
    : { background: 'var(--faint)', color: 'var(--text)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
      borderRadius: 999, fontSize: 'var(--text-sub)', fontWeight: 700, ...skin }}>
      {icon && <ion-icon name={icon} style={{ fontSize: 15 }}></ion-icon>}
      {children}
    </span>
  );
}

// A circular taxon-group thumbnail (stands in for a species photo thumbnail).
function GroupThumb({ group, size = 46 }) {
  const g = window.GOTE.GROUPS[group];
  // Amphibians use the brand newt silhouette (no good webfont glyph exists).
  const glyph = group === 'Amphibia'
    ? <div style={{ width: size * 0.56, height: size * 0.56,
        WebkitMask: `url(${(window.__resources&&window.__resources.newt)||'../../assets/newt.svg'}) center/contain no-repeat`,
        mask: `url(${(window.__resources&&window.__resources.newt)||'../../assets/newt.svg'}) center/contain no-repeat`, background: ACCENT_FG[g.accent] }} />
    : <span className={'mdi ' + g.icon} style={{ fontSize: size * 0.5, color: ACCENT_FG[g.accent], lineHeight: 1 }}></span>;
  return (
    <div style={{ width: size, height: size, borderRadius: 999, flex: 'none',
      background: ACCENT_BG[g.accent], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {glyph}
    </div>
  );
}

Object.assign(window.GOTE, { StatusBar, HomeIndicator, ScreenHeader, ListRow, SectionLabel, Button, StatPill, GroupThumb, ACCENT_FG, ACCENT_BG });

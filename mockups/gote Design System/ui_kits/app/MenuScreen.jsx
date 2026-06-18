// Main menu — full-bleed green hero (account + recent-accuracy chart) over a
// clean, hairline-divided list of game modes. Mirrors src/screens/MenuScreen.js.
function MenuScreen({ onSelectMode, onLexicon, onStats }) {
  const { StatusBar, ListRow, SectionLabel, StatPill, PLAY_MODES } = window.GOTE;
  const ICON_TEAL = '#147D8A'; // one muted teal across every menu icon
  const history = [62, 70, 55, 80, 74, 88, 66, 92, 78, 84, 71, 90, 86, 95, 82, 77, 91, 68, 88, 94];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Full-bleed hero */}
      <div style={{ position: 'relative', flex: 'none',
        background: 'linear-gradient(135deg, var(--hero-grad-1), var(--hero-grad-2) 55%, var(--hero-grad-3))',
        boxShadow: 'var(--shadow-banner)' }}>
        <StatusBar />
        {/* recent-accuracy bars — short, faint, kept clear of the title/pill */}
        <div style={{ position: 'absolute', left: 22, right: 22, bottom: 0, top: 138, display: 'flex',
          alignItems: 'flex-end', gap: 4, pointerEvents: 'none' }}>
          {history.map((p, i) => (
            <div key={i} style={{ width: 7, height: p + '%', borderRadius: '2px 2px 0 0',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.22), rgba(255,255,255,0.06))' }} />
          ))}
        </div>
        <div onClick={onStats} style={{ position: 'relative', padding: '4px 22px 18px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, flex: 'none', WebkitMask: `url(${(window.__resources&&window.__resources.newt)||'../../assets/newt.svg'}) center/contain no-repeat`,
              mask: `url(${(window.__resources&&window.__resources.newt)||'../../assets/newt.svg'}) center/contain no-repeat`, background: '#fff' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Fredoka', var(--font-system)", fontSize: '2.375rem', fontWeight: 600, color: '#fff', letterSpacing: '0.5px' }}>gote</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>fernsketch · 570 cards</div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <StatPill icon="stats-chart" onBrand>72% lifetime accuracy · 410/570</StatPill>
          </div>
        </div>
      </div>

      {/* Scrolling list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 28px' }}>
        <SectionLabel>Play</SectionLabel>
        <div>
          {PLAY_MODES.map((m, i) => (
            <ListRow key={m.key} divider={i > 0} icon={m.icon} accent={ICON_TEAL}
              title={m.title} sub={m.sub} onClick={() => onSelectMode(m.key)} />
          ))}
        </div>
        <SectionLabel>Learn</SectionLabel>
        <div>
          <ListRow icon="documents-outline" accent={ICON_TEAL} title="Flash cards" sub="Reveal the answer, then grade yourself" onClick={() => onSelectMode('flash')} />
          <ListRow divider icon="library-outline" accent={ICON_TEAL} title="Lexicon" sub="Browse all your species" onClick={onLexicon} />
        </div>
        <SectionLabel>Settings</SectionLabel>
        <div>
          <ListRow icon="settings-outline" accent={ICON_TEAL} title="Settings" sub="Account, language and study options" onClick={() => {}} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          marginTop: 26, color: 'var(--muted)', fontSize: 13.5, fontWeight: 600 }}>
          <ion-icon name="cafe-outline" style={{ fontSize: 16 }}></ion-icon> Buy me a coffee
        </div>
      </div>
    </div>
  );
}
window.GOTE.MenuScreen = MenuScreen;

// Lexicon — browse/search every observed species, filter by how well you know
// each, tap through to a detail page. Mirrors src/screens/LexiconScreen.js.
function LexiconScreen({ onBack }) {
  const { ScreenHeader, GroupThumb, SPECIES, STATUS_LABEL } = window.GOTE;
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('all');

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'strong', label: 'Known well' },
    { key: 'learning', label: 'Learning' },
    { key: 'new', label: 'New' },
  ];
  const STATUS_DOT = { strong: 'var(--correct)', learning: 'var(--flag)', new: 'var(--muted)' };

  const list = SPECIES.filter((s) =>
    (filter === 'all' || s.status === filter) &&
    (s.common.toLowerCase().includes(query.toLowerCase()) || s.sci.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <window.GOTE.StatusBar dark />
      <ScreenHeader title="Lexicon" onBack={onBack} />

      <div style={{ padding: '4px 20px 0' }}>
        {/* search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--faint)',
          borderRadius: 999, padding: '11px 14px' }}>
          <ion-icon name="search-outline" style={{ fontSize: 18, color: 'var(--muted)' }}></ion-icon>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your species"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15,
              color: 'var(--text)', fontFamily: 'var(--font-system)' }} />
        </div>
        {/* status filter chips */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 4 }}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{ border: '1px solid',
                borderColor: on ? 'var(--primary)' : 'var(--border)', background: on ? 'var(--primary)' : 'transparent',
                color: on ? '#fff' : 'var(--muted)', borderRadius: 999, padding: '7px 14px', fontSize: 13,
                fontWeight: 700, cursor: 'pointer' }}>{f.label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px' }}>
        {list.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0',
            borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
            <GroupThumb group={s.group} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{s.common}</div>
              <div style={{ fontStyle: 'italic', color: 'var(--muted)', fontSize: 13.5, marginTop: 1 }}>{s.sci}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_DOT[s.status] }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{STATUS_LABEL[s.status]}</span>
            </div>
            <ion-icon name="chevron-forward" style={{ fontSize: 18, color: 'var(--muted)' }}></ion-icon>
          </div>
        ))}
        {list.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, marginTop: 40 }}>No species match.</div>
        )}
      </div>
      <window.GOTE.HomeIndicator dark />
    </div>
  );
}
window.GOTE.LexiconScreen = LexiconScreen;

// End-of-round summary. Grade badge + message, big score, tinted secondary
// actions, emphasized "Main menu" CTA, and a missed-species list. Mirrors
// src/screens/ResultsScreen.js.
function ResultsScreen({ total, correct, missed, onPlayAgain, onMenu, onRevisit }) {
  const { Button, GroupThumb } = window.GOTE;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const grade = pct >= 90 ? { icon: 'trophy', msg: 'Outstanding!' }
    : pct >= 70 ? { icon: 'thumbs-up', msg: 'Great job!' }
    : pct >= 50 ? { icon: 'trending-up', msg: 'Nice work — keep going!' }
    : { icon: 'school-outline', msg: 'Keep practicing!' };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <window.GOTE.StatusBar dark />
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px' }}>
        <button onClick={onMenu} style={{ width: 40, height: 40, borderRadius: 999, border: 'none',
          background: 'var(--faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ion-icon name="close" style={{ fontSize: 22, color: 'var(--text)' }}></ion-icon>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 84, height: 84, borderRadius: 999, background: 'var(--faint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ion-icon name={grade.icon} style={{ fontSize: 36, color: 'var(--primary)' }}></ion-icon>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 16, letterSpacing: '-0.3px' }}>{grade.msg}</div>

        <div style={{ alignSelf: 'stretch', padding: '24px 0', textAlign: 'center', margin: '26px 0',
          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 16, color: 'var(--muted)', marginTop: 4 }}>{correct} of {total} correct</div>
        </div>

        <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {missed.length > 0 && (
            <Button variant="tinted" tone="orange" icon="eye-outline" onClick={onRevisit}>Revisit missed ({missed.length})</Button>
          )}
          <Button variant="tinted" tone="primary" icon="play" onClick={onPlayAgain}>Play again</Button>
          <Button variant="primary" icon="home" onClick={onMenu} style={{ padding: '17px 22px', fontSize: 18 }}>Main menu</Button>
        </div>

        {missed.length > 0 && (
          <div style={{ alignSelf: 'stretch', marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--section-label)', textTransform: 'uppercase',
              letterSpacing: '1px' }}>Species you missed</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, marginBottom: 4 }}>
              Tap a species to learn more, or flag it to study later</div>
            {missed.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <GroupThumb group={c.group} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{c.common}</div>
                  <div style={{ fontStyle: 'italic', color: 'var(--muted)', fontSize: 14, marginTop: 1 }}>{c.sci}</div>
                </div>
                <ion-icon name="flag-outline" style={{ fontSize: 20, color: 'var(--muted)' }}></ion-icon>
                <ion-icon name="chevron-forward" style={{ fontSize: 18, color: 'var(--muted)' }}></ion-icon>
              </div>
            ))}
          </div>
        )}
        <div style={{ color: 'var(--muted)', marginTop: 24, fontSize: 14 }}>Lifetime accuracy 72% · 410/570</div>
      </div>
      <window.GOTE.HomeIndicator dark />
    </div>
  );
}
window.GOTE.ResultsScreen = ResultsScreen;

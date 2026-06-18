// Quiz screen (multiple-choice "By name" mode). Fullscreen photo: a blurred,
// darkened cover fills the screen with the full image shown "contain" on top;
// all chrome is white over protection gradients. Mirrors src/screens/StudyScreen.js.
function StudyScreen({ card, index, total, score, onNext, onQuit }) {
  const { StatusBar, photo } = window.GOTE;
  const [phase, setPhase] = React.useState('front'); // front | choosing | answered
  const [picked, setPicked] = React.useState(null);

  React.useEffect(() => { setPhase('front'); setPicked(null); }, [card.kw]);

  const img = photo(card.kw, card.lock);
  const fallback = `https://picsum.photos/seed/gote${card.lock}/800/1100`;
  const onErr = (e) => { if (e.target.src.indexOf('picsum') === -1) e.target.src = fallback; };
  const choices = card.choices.slice(0, 5);
  const answered = phase === 'answered';
  const gotIt = picked === card.answer;
  const progress = ((index + 1) / total) * 100;

  const pick = (name) => { if (!answered) { setPicked(name); setPhase('answered'); } };

  return (
    <div style={{ position: 'relative', height: '100%', background: '#000', overflow: 'hidden' }}>
      {/* photo */}
      <img src={img} onError={onErr} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', filter: 'blur(30px)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <img src={img} onError={onErr} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />

      {/* top gradient + chrome */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '0 20px 28px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), rgba(0,0,0,0))' }}>
        <StatusBar />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={onQuit} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none',
            border: 'none', color: 'rgba(255,255,255,0.78)', cursor: 'pointer', fontSize: 16, fontWeight: 600, padding: 0 }}>
            <ion-icon name="close" style={{ fontSize: 18 }}></ion-icon> End
          </button>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{index + 1} / {total}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ion-icon name="flag-outline" style={{ fontSize: 20, color: '#fff' }}></ion-icon>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ion-icon name="star" style={{ fontSize: 15, color: '#fff' }}></ion-icon>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{score}</span>
            </div>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.3)' }}>
          <div style={{ height: '100%', width: progress + '%', borderRadius: 999, background: '#fff' }} />
        </div>
      </div>

      {/* centered answer panel */}
      {phase !== 'front' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '0 20px', pointerEvents: 'none' }}>
          <div style={{ width: '100%', background: 'rgba(0,0,0,0.32)', borderRadius: 20, padding: '16px 14px',
            pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
              {answered && <ion-icon name={gotIt ? 'checkmark-circle' : 'close-circle'}
                style={{ fontSize: 16, color: gotIt ? 'var(--correct)' : 'var(--wrong)' }}></ion-icon>}
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                {answered ? (gotIt ? 'Correct!' : `It was ${card.answer}`) : 'Which species is this?'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {choices.map((name) => {
                const isAns = name === card.answer, isPick = name === picked;
                const showC = answered && isAns, showW = answered && isPick && !isAns;
                const skin = showC ? { background: 'var(--correct)', borderColor: 'var(--correct)' }
                  : showW ? { background: 'var(--wrong)', borderColor: 'var(--wrong)' }
                  : { background: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.5)' };
                return (
                  <button key={name} onClick={() => pick(name)} disabled={answered}
                    style={{ width: '100%', textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: 700,
                      padding: '11px 14px', borderRadius: 14, borderWidth: 1.5, borderStyle: 'solid',
                      cursor: answered ? 'default' : 'pointer', ...skin }}>
                    {name}
                  </button>
                );
              })}
              {answered && (
                <button onClick={() => onNext(gotIt)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 16,
                  padding: '14px', fontSize: 17, fontWeight: 800, marginTop: 4, cursor: 'pointer' }}>
                  Next card <ion-icon name="arrow-forward" style={{ fontSize: 18 }}></ion-icon>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* bottom gradient + reveal */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '48px 20px 0',
        background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))' }}>
        {phase === 'front' && (
          <button onClick={() => setPhase('choosing')} style={{ width: '100%', border: '2px solid #fff',
            background: 'transparent', color: '#fff', borderRadius: 16, padding: '15px', fontSize: 17,
            fontWeight: 800, cursor: 'pointer' }}>Show choices</button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingBottom: 4 }}>
          <ion-icon name="grid-outline" style={{ fontSize: 20, color: '#fff' }}></ion-icon>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)' }}>© observer · iNaturalist</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 26 }}>
          <div style={{ width: 134, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.9)' }} />
        </div>
      </div>
    </div>
  );
}
window.GOTE.StudyScreen = StudyScreen;

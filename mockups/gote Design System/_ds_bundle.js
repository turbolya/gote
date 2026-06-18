/* @ds-bundle: {"format":3,"namespace":"GoteDesignSystem_1d5a8c","components":[{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"IconButton","sourcePath":"components/buttons/IconButton.jsx"},{"name":"ListRow","sourcePath":"components/data-display/ListRow.jsx"},{"name":"SectionLabel","sourcePath":"components/data-display/SectionLabel.jsx"},{"name":"StatPill","sourcePath":"components/data-display/StatPill.jsx"},{"name":"ChoiceButton","sourcePath":"components/quiz/ChoiceButton.jsx"},{"name":"ProgressBar","sourcePath":"components/quiz/ProgressBar.jsx"}],"sourceHashes":{"components/buttons/Button.jsx":"87fddae89cae","components/buttons/IconButton.jsx":"214ae59e999b","components/data-display/ListRow.jsx":"a3a1da17774d","components/data-display/SectionLabel.jsx":"6967f05951b3","components/data-display/StatPill.jsx":"d26dcbaab4cc","components/data-display/tweaks-panel.js":"6591467622ed","components/quiz/ChoiceButton.jsx":"c433c1e51375","components/quiz/ProgressBar.jsx":"435c61098c50","ui_kits/app/LexiconScreen.jsx":"757912e30dd5","ui_kits/app/MenuScreen.jsx":"dcb94b851376","ui_kits/app/ResultsScreen.jsx":"701499a84cfa","ui_kits/app/StudyScreen.jsx":"190c53060ee3","ui_kits/app/data.js":"8d86b41516f9","ui_kits/app/ui.jsx":"a330eb8bfbbd"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.GoteDesignSystem_1d5a8c = window.GoteDesignSystem_1d5a8c || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * gote Button — the app's primary action control.
 * Heavy 800-weight label, 16px radius, ~50px tall, full-width by default
 * (gote stacks buttons in a column). Renders an optional Ionicons glyph on
 * either side via <ion-icon> (load the ionicons CDN on the page).
 */
function Button({
  variant = 'primary',
  tone = 'primary',
  icon,
  iconRight,
  fullWidth = true,
  disabled = false,
  children,
  style,
  ...rest
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: fullWidth ? '100%' : 'auto',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-system)',
    fontSize: 'var(--text-body)',
    fontWeight: 800,
    lineHeight: 1,
    padding: '15px 22px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid transparent',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'opacity 120ms ease, transform 120ms ease',
    WebkitTapHighlightColor: 'transparent'
  };
  const tintPrimary = {
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    borderColor: '#b7dde8'
  };
  const tintOrange = {
    background: 'var(--action-orange-bg)',
    color: 'var(--action-orange-fg)',
    borderColor: '#f6d2b3'
  };
  const variants = {
    primary: {
      background: 'var(--primary)',
      color: 'var(--on-dark)',
      fontWeight: 900,
      boxShadow: 'var(--shadow-primary)'
    },
    success: {
      background: 'var(--correct)',
      color: 'var(--on-dark)'
    },
    danger: {
      background: 'var(--wrong)',
      color: 'var(--on-dark)'
    },
    tinted: tone === 'orange' ? tintOrange : tintPrimary,
    outline: {
      background: 'transparent',
      color: 'var(--on-dark)',
      border: '2px solid var(--on-dark)',
      fontWeight: 800
    }
  };
  const sz = 19;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    style: {
      ...base,
      ...variants[variant],
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("ion-icon", {
    name: icon,
    style: {
      fontSize: sz
    }
  }), /*#__PURE__*/React.createElement("span", null, children), iconRight && /*#__PURE__*/React.createElement("ion-icon", {
    name: iconRight,
    style: {
      fontSize: sz
    }
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/buttons/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * gote IconButton — a round, icon-only control. The faint variant is the
 * standard back/close button (40px circle on the sunken fill); the photo
 * variant is bare white chrome used over fullscreen photos.
 */
function IconButton({
  icon,
  variant = 'faint',
  size = 40,
  iconSize,
  color,
  disabled = false,
  style,
  ...rest
}) {
  const variants = {
    faint: {
      background: 'var(--faint)',
      color: color || 'var(--text)'
    },
    photo: {
      background: 'transparent',
      color: color || 'var(--on-dark)'
    },
    brand: {
      background: 'var(--primary)',
      color: color || 'var(--on-dark)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    style: {
      width: size,
      height: size,
      borderRadius: 'var(--radius-pill)',
      border: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      WebkitTapHighlightColor: 'transparent',
      ...variants[variant],
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("ion-icon", {
    name: icon,
    style: {
      fontSize: iconSize || Math.round(size * 0.52)
    }
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data-display/ListRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ACCENTS = {
  green: 'var(--accent-green-fg)',
  blue: 'var(--accent-blue-fg)',
  violet: 'var(--accent-violet-fg)',
  amber: 'var(--accent-amber-fg)',
  teal: 'var(--accent-teal-fg)',
  indigo: 'var(--accent-indigo-fg)',
  rose: 'var(--accent-rose-fg)',
  slate: 'var(--accent-slate-fg)'
};

/**
 * gote ListRow — the menu/list row: an accent-tinted Ionicons glyph, a title
 * with a quiet subtitle, and a trailing chevron. Rows sit in a group divided
 * by hairlines (set `divider` on every row after the first).
 */
function ListRow({
  icon,
  accent = 'green',
  title,
  sub,
  trailing,
  divider = false,
  onClick,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: onClick ? 'button' : undefined,
    onClick: onClick,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '15px 0',
      cursor: onClick ? 'pointer' : 'default',
      borderTop: divider ? '1px solid var(--border)' : 'none',
      fontFamily: 'var(--font-system)',
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("ion-icon", {
    name: icon,
    style: {
      fontSize: 24,
      width: 28,
      textAlign: 'center',
      color: ACCENTS[accent] || accent
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-row)',
      fontWeight: 700,
      color: 'var(--text)'
    }
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sub)',
      color: 'var(--muted)',
      marginTop: 1
    }
  }, sub)), trailing !== undefined ? trailing : /*#__PURE__*/React.createElement("ion-icon", {
    name: "chevron-forward",
    style: {
      fontSize: 20,
      color: 'var(--muted)'
    }
  }));
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/data-display/SectionLabel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * gote SectionLabel — the small uppercase heading that introduces a group of
 * rows ("PLAY", "LEARN", "SETTINGS"). Heavy, tracked-out, in the dark-green
 * section color.
 */
function SectionLabel({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontFamily: 'var(--font-system)',
      fontSize: 'var(--text-label)',
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-label)',
      color: 'var(--section-label)',
      margin: '22px 0 4px 2px',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { SectionLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/SectionLabel.jsx", error: String((e && e.message) || e) }); }

// components/data-display/StatPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * gote StatPill — a compact rounded pill with a leading Ionicons glyph and a
 * stat label. `onBrand` is the translucent-white treatment used on the green
 * hero; the default sits on the sunken fill.
 */
function StatPill({
  icon,
  children,
  onBrand = false,
  style,
  ...rest
}) {
  const skin = onBrand ? {
    background: 'rgba(255,255,255,0.16)',
    color: 'var(--on-dark)'
  } : {
    background: 'var(--faint)',
    color: 'var(--text)'
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '8px 14px',
      borderRadius: 'var(--radius-pill)',
      fontFamily: 'var(--font-system)',
      fontSize: 'var(--text-sub)',
      fontWeight: 700,
      ...skin,
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("ion-icon", {
    name: icon,
    style: {
      fontSize: 15
    }
  }), children);
}
Object.assign(__ds_scope, { StatPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/StatPill.jsx", error: String((e && e.message) || e) }); }

// components/data-display/tweaks-panel.js
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/tweaks-panel.js", error: String((e && e.message) || e) }); }

// components/quiz/ChoiceButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * gote ChoiceButton — a multiple-choice answer chip on the quiz screen. It
 * lives over a darkened photo, so the default state is translucent-dark with a
 * white border and white label; once answered it turns solid green (correct)
 * or red (wrong).
 */
function ChoiceButton({
  state = 'default',
  disabled = false,
  children,
  onClick,
  style,
  ...rest
}) {
  const states = {
    default: {
      background: 'rgba(0,0,0,0.4)',
      borderColor: 'rgba(255,255,255,0.5)',
      color: 'var(--on-dark)'
    },
    correct: {
      background: 'var(--correct)',
      borderColor: 'var(--correct)',
      color: 'var(--on-dark)'
    },
    wrong: {
      background: 'var(--wrong)',
      borderColor: 'var(--wrong)',
      color: 'var(--on-dark)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'center',
      fontFamily: 'var(--font-system)',
      fontSize: 'var(--text-body)',
      fontWeight: 700,
      padding: '11px 14px',
      borderRadius: 'var(--radius-md)',
      borderWidth: 1.5,
      borderStyle: 'solid',
      cursor: disabled ? 'default' : 'pointer',
      WebkitTapHighlightColor: 'transparent',
      ...states[state],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { ChoiceButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/quiz/ChoiceButton.jsx", error: String((e && e.message) || e) }); }

// components/quiz/ProgressBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * gote ProgressBar — the thin pill track that shows quiz progress. `onPhoto`
 * is the white-on-translucent treatment used over the fullscreen photo; the
 * default is brand green on the sunken fill.
 */
function ProgressBar({
  value = 0,
  onPhoto = false,
  style,
  ...rest
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      height: 6,
      borderRadius: 'var(--radius-pill)',
      overflow: 'hidden',
      background: onPhoto ? 'rgba(255,255,255,0.3)' : 'var(--faint)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${pct}%`,
      borderRadius: 'var(--radius-pill)',
      background: onPhoto ? 'var(--on-dark)' : 'var(--primary)',
      transition: 'width 240ms ease'
    }
  }));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/quiz/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/LexiconScreen.jsx
try { (() => {
// Lexicon — browse/search every observed species, filter by how well you know
// each, tap through to a detail page. Mirrors src/screens/LexiconScreen.js.
function LexiconScreen({
  onBack
}) {
  const {
    ScreenHeader,
    GroupThumb,
    SPECIES,
    STATUS_LABEL
  } = window.GOTE;
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const FILTERS = [{
    key: 'all',
    label: 'All'
  }, {
    key: 'strong',
    label: 'Known well'
  }, {
    key: 'learning',
    label: 'Learning'
  }, {
    key: 'new',
    label: 'New'
  }];
  const STATUS_DOT = {
    strong: 'var(--correct)',
    learning: 'var(--flag)',
    new: 'var(--muted)'
  };
  const list = SPECIES.filter(s => (filter === 'all' || s.status === filter) && (s.common.toLowerCase().includes(query.toLowerCase()) || s.sci.toLowerCase().includes(query.toLowerCase())));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement(window.GOTE.StatusBar, {
    dark: true
  }), /*#__PURE__*/React.createElement(ScreenHeader, {
    title: "Lexicon",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'var(--faint)',
      borderRadius: 999,
      padding: '11px 14px'
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: "search-outline",
    style: {
      fontSize: 18,
      color: 'var(--muted)'
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: query,
    onChange: e => setQuery(e.target.value),
    placeholder: "Search your species",
    style: {
      flex: 1,
      border: 'none',
      background: 'transparent',
      outline: 'none',
      fontSize: 15,
      color: 'var(--text)',
      fontFamily: 'var(--font-system)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 12,
      marginBottom: 4
    }
  }, FILTERS.map(f => {
    const on = filter === f.key;
    return /*#__PURE__*/React.createElement("button", {
      key: f.key,
      onClick: () => setFilter(f.key),
      style: {
        border: '1px solid',
        borderColor: on ? 'var(--primary)' : 'var(--border)',
        background: on ? 'var(--primary)' : 'transparent',
        color: on ? '#fff' : 'var(--muted)',
        borderRadius: 999,
        padding: '7px 14px',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer'
      }
    }, f.label);
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '4px 20px 20px'
    }
  }, list.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 0',
      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(GroupThumb, {
    group: s.group,
    size: 46
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--text)'
    }
  }, s.common), /*#__PURE__*/React.createElement("div", {
    style: {
      fontStyle: 'italic',
      color: 'var(--muted)',
      fontSize: 13.5,
      marginTop: 1
    }
  }, s.sci)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: STATUS_DOT[s.status]
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--muted)'
    }
  }, STATUS_LABEL[s.status])), /*#__PURE__*/React.createElement("ion-icon", {
    name: "chevron-forward",
    style: {
      fontSize: 18,
      color: 'var(--muted)'
    }
  }))), list.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--muted)',
      fontSize: 14,
      marginTop: 40
    }
  }, "No species match.")), /*#__PURE__*/React.createElement(window.GOTE.HomeIndicator, {
    dark: true
  }));
}
window.GOTE.LexiconScreen = LexiconScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/LexiconScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/MenuScreen.jsx
try { (() => {
// Main menu — full-bleed green hero (account + recent-accuracy chart) over a
// clean, hairline-divided list of game modes. Mirrors src/screens/MenuScreen.js.
function MenuScreen({
  onSelectMode,
  onLexicon,
  onStats
}) {
  const {
    StatusBar,
    ListRow,
    SectionLabel,
    StatPill,
    PLAY_MODES
  } = window.GOTE;
  const ICON_TEAL = '#147D8A'; // one muted teal across every menu icon
  const history = [62, 70, 55, 80, 74, 88, 66, 92, 78, 84, 71, 90, 86, 95, 82, 77, 91, 68, 88, 94];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 'none',
      background: 'linear-gradient(135deg, var(--hero-grad-1), var(--hero-grad-2) 55%, var(--hero-grad-3))',
      boxShadow: 'var(--shadow-banner)'
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 22,
      right: 22,
      bottom: 0,
      top: 138,
      display: 'flex',
      alignItems: 'flex-end',
      gap: 4,
      pointerEvents: 'none'
    }
  }, history.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 7,
      height: p + '%',
      borderRadius: '2px 2px 0 0',
      background: 'linear-gradient(to bottom, rgba(255,255,255,0.22), rgba(255,255,255,0.06))'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    onClick: onStats,
    style: {
      position: 'relative',
      padding: '4px 22px 18px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      flex: 'none',
      WebkitMask: `url(${window.__resources && window.__resources.newt || '../../assets/newt.svg'}) center/contain no-repeat`,
      mask: `url(${window.__resources && window.__resources.newt || '../../assets/newt.svg'}) center/contain no-repeat`,
      background: '#fff'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Fredoka', var(--font-system)",
      fontSize: '2.375rem',
      fontWeight: 600,
      color: '#fff',
      letterSpacing: '0.5px'
    }
  }, "gote"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 2
    }
  }, "fernsketch \xB7 570 cards"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(StatPill, {
    icon: "stats-chart",
    onBrand: true
  }, "72% lifetime accuracy \xB7 410/570")))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 20px 28px'
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "Play"), /*#__PURE__*/React.createElement("div", null, PLAY_MODES.map((m, i) => /*#__PURE__*/React.createElement(ListRow, {
    key: m.key,
    divider: i > 0,
    icon: m.icon,
    accent: ICON_TEAL,
    title: m.title,
    sub: m.sub,
    onClick: () => onSelectMode(m.key)
  }))), /*#__PURE__*/React.createElement(SectionLabel, null, "Learn"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ListRow, {
    icon: "documents-outline",
    accent: ICON_TEAL,
    title: "Flash cards",
    sub: "Reveal the answer, then grade yourself",
    onClick: () => onSelectMode('flash')
  }), /*#__PURE__*/React.createElement(ListRow, {
    divider: true,
    icon: "library-outline",
    accent: ICON_TEAL,
    title: "Lexicon",
    sub: "Browse all your species",
    onClick: onLexicon
  })), /*#__PURE__*/React.createElement(SectionLabel, null, "Settings"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ListRow, {
    icon: "settings-outline",
    accent: ICON_TEAL,
    title: "Settings",
    sub: "Account, language and study options",
    onClick: () => {}
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 26,
      color: 'var(--muted)',
      fontSize: 13.5,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: "cafe-outline",
    style: {
      fontSize: 16
    }
  }), " Buy me a coffee")));
}
window.GOTE.MenuScreen = MenuScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/MenuScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ResultsScreen.jsx
try { (() => {
// End-of-round summary. Grade badge + message, big score, tinted secondary
// actions, emphasized "Main menu" CTA, and a missed-species list. Mirrors
// src/screens/ResultsScreen.js.
function ResultsScreen({
  total,
  correct,
  missed,
  onPlayAgain,
  onMenu,
  onRevisit
}) {
  const {
    Button,
    GroupThumb
  } = window.GOTE;
  const pct = total > 0 ? Math.round(correct / total * 100) : 0;
  const grade = pct >= 90 ? {
    icon: 'trophy',
    msg: 'Outstanding!'
  } : pct >= 70 ? {
    icon: 'thumbs-up',
    msg: 'Great job!'
  } : pct >= 50 ? {
    icon: 'trending-up',
    msg: 'Nice work — keep going!'
  } : {
    icon: 'school-outline',
    msg: 'Keep practicing!'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement(window.GOTE.StatusBar, {
    dark: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onMenu,
    style: {
      width: 40,
      height: 40,
      borderRadius: 999,
      border: 'none',
      background: 'var(--faint)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: "close",
    style: {
      fontSize: 22,
      color: 'var(--text)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px 24px 28px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 84,
      height: 84,
      borderRadius: 999,
      background: 'var(--faint)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: grade.icon,
    style: {
      fontSize: 36,
      color: 'var(--primary)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: 'var(--text)',
      marginTop: 16,
      letterSpacing: '-0.3px'
    }
  }, grade.msg), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'stretch',
      padding: '24px 0',
      textAlign: 'center',
      margin: '26px 0',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 56,
      fontWeight: 900,
      color: 'var(--text)',
      letterSpacing: '-1px',
      lineHeight: 1
    }
  }, pct, "%"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'var(--muted)',
      marginTop: 4
    }
  }, correct, " of ", total, " correct")), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'stretch',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, missed.length > 0 && /*#__PURE__*/React.createElement(Button, {
    variant: "tinted",
    tone: "orange",
    icon: "eye-outline",
    onClick: onRevisit
  }, "Revisit missed (", missed.length, ")"), /*#__PURE__*/React.createElement(Button, {
    variant: "tinted",
    tone: "primary",
    icon: "play",
    onClick: onPlayAgain
  }, "Play again"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: "home",
    onClick: onMenu,
    style: {
      padding: '17px 22px',
      fontSize: 18
    }
  }, "Main menu")), missed.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'stretch',
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      color: 'var(--section-label)',
      textTransform: 'uppercase',
      letterSpacing: '1px'
    }
  }, "Species you missed"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--muted)',
      marginTop: 2,
      marginBottom: 4
    }
  }, "Tap a species to learn more, or flag it to study later"), missed.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 0',
      borderTop: i > 0 ? '1px solid var(--border)' : 'none'
    }
  }, /*#__PURE__*/React.createElement(GroupThumb, {
    group: c.group,
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: 'var(--text)'
    }
  }, c.common), /*#__PURE__*/React.createElement("div", {
    style: {
      fontStyle: 'italic',
      color: 'var(--muted)',
      fontSize: 14,
      marginTop: 1
    }
  }, c.sci)), /*#__PURE__*/React.createElement("ion-icon", {
    name: "flag-outline",
    style: {
      fontSize: 20,
      color: 'var(--muted)'
    }
  }), /*#__PURE__*/React.createElement("ion-icon", {
    name: "chevron-forward",
    style: {
      fontSize: 18,
      color: 'var(--muted)'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--muted)',
      marginTop: 24,
      fontSize: 14
    }
  }, "Lifetime accuracy 72% \xB7 410/570")), /*#__PURE__*/React.createElement(window.GOTE.HomeIndicator, {
    dark: true
  }));
}
window.GOTE.ResultsScreen = ResultsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ResultsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/StudyScreen.jsx
try { (() => {
// Quiz screen (multiple-choice "By name" mode). Fullscreen photo: a blurred,
// darkened cover fills the screen with the full image shown "contain" on top;
// all chrome is white over protection gradients. Mirrors src/screens/StudyScreen.js.
function StudyScreen({
  card,
  index,
  total,
  score,
  onNext,
  onQuit
}) {
  const {
    StatusBar,
    photo
  } = window.GOTE;
  const [phase, setPhase] = React.useState('front'); // front | choosing | answered
  const [picked, setPicked] = React.useState(null);
  React.useEffect(() => {
    setPhase('front');
    setPicked(null);
  }, [card.kw]);
  const img = photo(card.kw, card.lock);
  const fallback = `https://picsum.photos/seed/gote${card.lock}/800/1100`;
  const onErr = e => {
    if (e.target.src.indexOf('picsum') === -1) e.target.src = fallback;
  };
  const choices = card.choices.slice(0, 5);
  const answered = phase === 'answered';
  const gotIt = picked === card.answer;
  const progress = (index + 1) / total * 100;
  const pick = name => {
    if (!answered) {
      setPicked(name);
      setPhase('answered');
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: '100%',
      background: '#000',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: img,
    onError: onErr,
    alt: "",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      filter: 'blur(30px)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.4)'
    }
  }), /*#__PURE__*/React.createElement("img", {
    src: img,
    onError: onErr,
    alt: "",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      padding: '0 20px 28px',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), rgba(0,0,0,0))'
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onQuit,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.78)',
      cursor: 'pointer',
      fontSize: 16,
      fontWeight: 600,
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: "close",
    style: {
      fontSize: 18
    }
  }), " End"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      fontWeight: 700,
      fontSize: 16
    }
  }, index + 1, " / ", total), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: "flag-outline",
    style: {
      fontSize: 20,
      color: '#fff'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: "star",
    style: {
      fontSize: 15,
      color: '#fff'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      fontWeight: 800,
      fontSize: 16
    }
  }, score)))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 999,
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.3)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: progress + '%',
      borderRadius: 999,
      background: '#fff'
    }
  }))), phase !== 'front' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 20px',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      background: 'rgba(0,0,0,0.32)',
      borderRadius: 20,
      padding: '16px 14px',
      pointerEvents: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 12
    }
  }, answered && /*#__PURE__*/React.createElement("ion-icon", {
    name: gotIt ? 'checkmark-circle' : 'close-circle',
    style: {
      fontSize: 16,
      color: gotIt ? 'var(--correct)' : 'var(--wrong)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      fontWeight: 700,
      fontSize: 15
    }
  }, answered ? gotIt ? 'Correct!' : `It was ${card.answer}` : 'Which species is this?')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, choices.map(name => {
    const isAns = name === card.answer,
      isPick = name === picked;
    const showC = answered && isAns,
      showW = answered && isPick && !isAns;
    const skin = showC ? {
      background: 'var(--correct)',
      borderColor: 'var(--correct)'
    } : showW ? {
      background: 'var(--wrong)',
      borderColor: 'var(--wrong)'
    } : {
      background: 'rgba(0,0,0,0.4)',
      borderColor: 'rgba(255,255,255,0.5)'
    };
    return /*#__PURE__*/React.createElement("button", {
      key: name,
      onClick: () => pick(name),
      disabled: answered,
      style: {
        width: '100%',
        textAlign: 'center',
        color: '#fff',
        fontSize: 16,
        fontWeight: 700,
        padding: '11px 14px',
        borderRadius: 14,
        borderWidth: 1.5,
        borderStyle: 'solid',
        cursor: answered ? 'default' : 'pointer',
        ...skin
      }
    }, name);
  }), answered && /*#__PURE__*/React.createElement("button", {
    onClick: () => onNext(gotIt),
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      background: 'var(--primary)',
      color: '#fff',
      border: 'none',
      borderRadius: 16,
      padding: '14px',
      fontSize: 17,
      fontWeight: 800,
      marginTop: 4,
      cursor: 'pointer'
    }
  }, "Next card ", /*#__PURE__*/React.createElement("ion-icon", {
    name: "arrow-forward",
    style: {
      fontSize: 18
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '48px 20px 0',
      background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0))'
    }
  }, phase === 'front' && /*#__PURE__*/React.createElement("button", {
    onClick: () => setPhase('choosing'),
    style: {
      width: '100%',
      border: '2px solid #fff',
      background: 'transparent',
      color: '#fff',
      borderRadius: 16,
      padding: '15px',
      fontSize: 17,
      fontWeight: 800,
      cursor: 'pointer'
    }
  }, "Show choices"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: "grid-outline",
    style: {
      fontSize: 20,
      color: '#fff'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.78)'
    }
  }, "\xA9 observer \xB7 iNaturalist")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 26
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 134,
      height: 5,
      borderRadius: 999,
      background: 'rgba(255,255,255,0.9)'
    }
  }))));
}
window.GOTE.StudyScreen = StudyScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/StudyScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/data.js
try { (() => {
// Sample data + shared helpers for the gote UI-kit recreation.
// Photos are picsum placeholders standing in for iNaturalist observation
// photos (the real app pulls each user's own public observations).

window.GOTE = window.GOTE || {};

// Photos: keyword-matched nature images standing in for iNaturalist
// observation photos (the real app pulls each user's own public observations).
// `lock` keeps a given card showing a stable image across reloads.
window.GOTE.photo = (kw, lock, w = 800, h = 1100) => `https://loremflickr.com/${w}/${h}/${encodeURIComponent(kw)}?lock=${lock}`;

// iNaturalist taxon groups → MaterialDesignIcons glyph + accent token name.
window.GOTE.GROUPS = {
  Amphibia: {
    icon: 'mdi-island',
    label: 'Amphibians',
    accent: 'green'
  },
  Aves: {
    icon: 'mdi-bird',
    label: 'Birds',
    accent: 'blue'
  },
  Insecta: {
    icon: 'mdi-bee',
    label: 'Insects',
    accent: 'amber'
  },
  Plantae: {
    icon: 'mdi-leaf',
    label: 'Plants',
    accent: 'green'
  },
  Fungi: {
    icon: 'mdi-mushroom',
    label: 'Fungi',
    accent: 'rose'
  },
  Mammalia: {
    icon: 'mdi-paw',
    label: 'Mammals',
    accent: 'slate'
  },
  Reptilia: {
    icon: 'mdi-turtle',
    label: 'Reptiles',
    accent: 'teal'
  },
  Mollusca: {
    icon: 'mdi-snail',
    label: 'Mollusks',
    accent: 'violet'
  }
};

// Play / learn menu rows (matches MenuScreen.js).
window.GOTE.PLAY_MODES = [{
  key: 'all',
  icon: 'albums-outline',
  accent: 'green',
  title: 'By name',
  sub: 'See a photo, choose its name'
}, {
  key: 'pick',
  icon: 'apps-outline',
  accent: 'blue',
  title: 'By picture',
  sub: 'See a name, choose its photo'
}, {
  key: 'speedrun',
  icon: 'flash',
  accent: 'amber',
  title: 'Speedrun',
  sub: 'Endless cards — survive 3 misses'
}, {
  key: 'nearby',
  icon: 'compass-outline',
  accent: 'teal',
  title: 'Nearby species',
  sub: 'Learn species typical to a place'
}, {
  key: 'custom',
  icon: 'options-outline',
  accent: 'violet',
  title: 'Custom game',
  sub: 'Choose how many cards and which groups'
}];

// Species deck — common + scientific name, group, "how well known", photo seed.
// status: 'strong' | 'learning' | 'new'
window.GOTE.SPECIES = [{
  id: 1,
  common: 'Eastern Newt',
  sci: 'Notophthalmus viridescens',
  group: 'Amphibia',
  status: 'strong',
  seed: 'newt-eastern'
}, {
  id: 2,
  common: 'Rough-skinned Newt',
  sci: 'Taricha granulosa',
  group: 'Amphibia',
  status: 'learning',
  seed: 'newt-rough'
}, {
  id: 3,
  common: 'American Robin',
  sci: 'Turdus migratorius',
  group: 'Aves',
  status: 'strong',
  seed: 'robin'
}, {
  id: 4,
  common: 'Western Honey Bee',
  sci: 'Apis mellifera',
  group: 'Insecta',
  status: 'strong',
  seed: 'bee'
}, {
  id: 5,
  common: 'Common Eastern Bumble Bee',
  sci: 'Bombus impatiens',
  group: 'Insecta',
  status: 'learning',
  seed: 'bumble'
}, {
  id: 6,
  common: 'Fly Agaric',
  sci: 'Amanita muscaria',
  group: 'Fungi',
  status: 'new',
  seed: 'amanita'
}, {
  id: 7,
  common: 'Red Fox',
  sci: 'Vulpes vulpes',
  group: 'Mammalia',
  status: 'learning',
  seed: 'fox'
}, {
  id: 8,
  common: 'Painted Turtle',
  sci: 'Chrysemys picta',
  group: 'Reptilia',
  status: 'strong',
  seed: 'turtle'
}, {
  id: 9,
  common: 'Garden Snail',
  sci: 'Cornu aspersum',
  group: 'Mollusca',
  status: 'new',
  seed: 'snail'
}, {
  id: 10,
  common: 'Common Milkweed',
  sci: 'Asclepias syriaca',
  group: 'Plantae',
  status: 'learning',
  seed: 'milkweed'
}, {
  id: 11,
  common: 'Monarch',
  sci: 'Danaus plexippus',
  group: 'Insecta',
  status: 'strong',
  seed: 'monarch'
}, {
  id: 12,
  common: 'Mallard',
  sci: 'Anas platyrhynchos',
  group: 'Aves',
  status: 'strong',
  seed: 'mallard'
}];

// One quiz card: the answer + 4 distractor names (real-ish look-alikes).
window.GOTE.QUIZ_CARDS = [{
  kw: 'newt,salamander',
  lock: 21,
  answer: 'Eastern Newt',
  sci: 'Notophthalmus viridescens',
  choices: ['Eastern Newt', 'Rough-skinned Newt', 'Red Eft', 'Fire Salamander', 'Spotted Salamander']
}, {
  kw: 'monarch,butterfly',
  lock: 34,
  answer: 'Monarch',
  sci: 'Danaus plexippus',
  choices: ['Viceroy', 'Monarch', 'Queen Butterfly', 'Painted Lady', 'Red Admiral']
}, {
  kw: 'amanita,mushroom',
  lock: 12,
  answer: 'Fly Agaric',
  sci: 'Amanita muscaria',
  choices: ['Fly Agaric', 'Caesar’s Mushroom', 'Panther Cap', 'Blusher', 'False Death Cap']
}, {
  kw: 'turtle,pond',
  lock: 47,
  answer: 'Painted Turtle',
  sci: 'Chrysemys picta',
  choices: ['Red-eared Slider', 'Painted Turtle', 'Box Turtle', 'Map Turtle', 'Spotted Turtle']
}];
window.GOTE.STATUS_LABEL = {
  strong: 'Known well',
  learning: 'Learning',
  new: 'New'
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/app/ui.jsx
try { (() => {
// Shared chrome + mini-primitives for the gote UI kit. Self-contained (no
// bundle dependency) so the prototype renders standalone; visuals mirror the
// design-system components 1:1.
const ACCENT_FG = {
  green: 'var(--accent-green-fg)',
  blue: 'var(--accent-blue-fg)',
  violet: 'var(--accent-violet-fg)',
  amber: 'var(--accent-amber-fg)',
  teal: 'var(--accent-teal-fg)',
  indigo: 'var(--accent-indigo-fg)',
  rose: 'var(--accent-rose-fg)',
  slate: 'var(--accent-slate-fg)'
};
const ACCENT_BG = {
  green: 'var(--accent-green-bg)',
  blue: 'var(--accent-blue-bg)',
  violet: 'var(--accent-violet-bg)',
  amber: 'var(--accent-amber-bg)',
  teal: 'var(--accent-teal-bg)',
  indigo: 'var(--accent-indigo-bg)',
  rose: 'var(--accent-rose-bg)',
  slate: 'var(--accent-slate-bg)'
};

// iOS status bar — white (over photo/hero) or dark (on light screens).
function StatusBar({
  dark = false
}) {
  const c = dark ? 'var(--text)' : '#fff';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 54,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      padding: '0 28px 8px',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: c,
      fontWeight: 700,
      fontSize: 15,
      letterSpacing: 0.2
    }
  }, "9:41"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      color: c
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: "cellular",
    style: {
      fontSize: 16
    }
  }), /*#__PURE__*/React.createElement("ion-icon", {
    name: "wifi",
    style: {
      fontSize: 16
    }
  }), /*#__PURE__*/React.createElement("ion-icon", {
    name: "battery-full",
    style: {
      fontSize: 19
    }
  })));
}
function HomeIndicator({
  dark = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 26,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 134,
      height: 5,
      borderRadius: 999,
      background: dark ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.9)'
    }
  }));
}

// Sub-screen header: round back button, centered title, spacer.
function ScreenHeader({
  title,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px 6px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      width: 40,
      height: 40,
      borderRadius: 999,
      border: 'none',
      background: 'var(--faint)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: "chevron-back",
    style: {
      fontSize: 22,
      color: 'var(--text)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: 'var(--text)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40
    }
  }));
}

// Menu/list row.
function ListRow({
  icon,
  accent = 'green',
  title,
  sub,
  divider,
  trailing,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '15px 0',
      cursor: 'pointer',
      borderTop: divider ? '1px solid var(--border)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("ion-icon", {
    name: icon,
    style: {
      fontSize: 24,
      width: 28,
      textAlign: 'center',
      color: ACCENT_FG[accent]
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-row)',
      fontWeight: 700,
      color: 'var(--text)'
    }
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sub)',
      color: 'var(--muted)',
      marginTop: 1
    }
  }, sub)), trailing !== undefined ? trailing : /*#__PURE__*/React.createElement("ion-icon", {
    name: "chevron-forward",
    style: {
      fontSize: 20,
      color: 'var(--muted)'
    }
  }));
}
function SectionLabel({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-label)',
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-label)',
      color: 'var(--section-label)',
      margin: '22px 0 4px 2px'
    }
  }, children);
}
function Button({
  variant = 'primary',
  tone = 'primary',
  icon,
  iconRight,
  children,
  onClick,
  style
}) {
  const tints = {
    primary: {
      background: 'var(--action-primary-bg)',
      color: 'var(--action-primary-fg)',
      borderColor: '#b7dde8'
    },
    orange: {
      background: 'var(--action-orange-bg)',
      color: 'var(--action-orange-fg)',
      borderColor: '#f6d2b3'
    }
  };
  const variants = {
    primary: {
      background: 'var(--primary)',
      color: '#fff',
      fontWeight: 900,
      boxShadow: 'var(--shadow-primary)'
    },
    success: {
      background: 'var(--correct)',
      color: '#fff'
    },
    danger: {
      background: 'var(--wrong)',
      color: '#fff'
    },
    tinted: tints[tone],
    outline: {
      background: 'transparent',
      color: '#fff',
      border: '2px solid #fff'
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      boxSizing: 'border-box',
      fontSize: 'var(--text-body)',
      fontWeight: 800,
      lineHeight: 1,
      padding: '15px 22px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid transparent',
      cursor: 'pointer',
      ...variants[variant],
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement("ion-icon", {
    name: icon,
    style: {
      fontSize: 19
    }
  }), /*#__PURE__*/React.createElement("span", null, children), iconRight && /*#__PURE__*/React.createElement("ion-icon", {
    name: iconRight,
    style: {
      fontSize: 19
    }
  }));
}
function StatPill({
  icon,
  children,
  onBrand
}) {
  const skin = onBrand ? {
    background: 'rgba(255,255,255,0.16)',
    color: '#fff'
  } : {
    background: 'var(--faint)',
    color: 'var(--text)'
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '8px 14px',
      borderRadius: 999,
      fontSize: 'var(--text-sub)',
      fontWeight: 700,
      ...skin
    }
  }, icon && /*#__PURE__*/React.createElement("ion-icon", {
    name: icon,
    style: {
      fontSize: 15
    }
  }), children);
}

// A circular taxon-group thumbnail (stands in for a species photo thumbnail).
function GroupThumb({
  group,
  size = 46
}) {
  const g = window.GOTE.GROUPS[group];
  // Amphibians use the brand newt silhouette (no good webfont glyph exists).
  const glyph = group === 'Amphibia' ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: size * 0.56,
      height: size * 0.56,
      WebkitMask: `url(${window.__resources && window.__resources.newt || '../../assets/newt.svg'}) center/contain no-repeat`,
      mask: `url(${window.__resources && window.__resources.newt || '../../assets/newt.svg'}) center/contain no-repeat`,
      background: ACCENT_FG[g.accent]
    }
  }) : /*#__PURE__*/React.createElement("span", {
    className: 'mdi ' + g.icon,
    style: {
      fontSize: size * 0.5,
      color: ACCENT_FG[g.accent],
      lineHeight: 1
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: 999,
      flex: 'none',
      background: ACCENT_BG[g.accent],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, glyph);
}
Object.assign(window.GOTE, {
  StatusBar,
  HomeIndicator,
  ScreenHeader,
  ListRow,
  SectionLabel,
  Button,
  StatPill,
  GroupThumb,
  ACCENT_FG,
  ACCENT_BG
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ui.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.SectionLabel = __ds_scope.SectionLabel;

__ds_ns.StatPill = __ds_scope.StatPill;

__ds_ns.ChoiceButton = __ds_scope.ChoiceButton;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

})();

export const deviceSettingsStyle = `
.pet-device-page {
  color-scheme: light dark;
  --pet-device-fg: light-dark(#20243a, #eef0fb);
  --pet-device-muted: light-dark(#515971, #b2b9d1);
  --pet-device-border: light-dark(#dedfeb, #3b4059);
  --pet-device-panel: light-dark(#ffffff, #202435);
  --pet-device-inset: light-dark(#f5f6fb, #282d40);
  --pet-device-accent: light-dark(#5342aa, #c3b7ff);
  --pet-device-accent-bg: light-dark(#eeebfc, #393055);
  --pet-device-primary: light-dark(#5645b3, #b9a9ff);
  --pet-device-primary-text: light-dark(#ffffff, #21183d);
  --pet-device-green: light-dark(#126949, #86deba);
  --pet-device-green-bg: light-dark(#e9f6ef, #213d36);
  --pet-device-danger: light-dark(#a33348, #ff9aae);
  --pet-device-alert-bg: light-dark(#fff1eb, #442936);
  --pet-device-battery-low: light-dark(#8c5900, #ffd266);
  --pet-device-battery-low-fill: #f4bc39;
  width: 100%;
  max-width: 810px;
  display: grid;
  gap: 16px;
  color: var(--pet-device-fg);
  line-height: 1.5;
  font-size: 14px;
}
:where([data-theme="dark"], .dark) .pet-device-page { color-scheme: dark; }
:where([data-theme="light"], .light) .pet-device-page { color-scheme: light; }
.pet-device-page *, .pet-device-page { box-sizing: border-box; }
.pet-device-page :is(h3, h4, p, dl, dd) { margin: 0; }
.pet-device-page :is(dt, legend, small) { color: var(--pet-device-muted); }
.pet-device-page dd { overflow-wrap: anywhere; }
.pet-device-page .pet-device-panel {
  min-width: 0;
  border: 1px solid var(--pet-device-border);
  border-radius: 16px;
  background: var(--pet-device-panel);
  padding: clamp(15px, 3vw, 24px);
  display: grid;
  gap: 16px;
  align-content: start;
}
.pet-device-page .pet-device-overview {
  background: radial-gradient(ellipse at 5% 0%, var(--pet-device-accent-bg), transparent 63%), var(--pet-device-panel);
  gap: 18px;
}
.pet-device-page .pet-device-head,
.pet-device-page .pet-device-actions,
.pet-device-page .pet-device-binding {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.pet-device-page .pet-device-head { justify-content: space-between; }
.pet-device-page .pet-device-connection { display: grid; justify-items: end; gap: 4px; }
.pet-device-page .pet-device-connection time { font-variant-numeric: tabular-nums; }
.pet-device-page .pet-device-identity {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 14px;
}
.pet-device-page .pet-device-identity h3 {
  font-size: clamp(20px, 4vw, 25px);
  font-weight: 720;
  line-height: 1.2;
  letter-spacing: -.02em;
}
.pet-device-page .pet-device-identity p { margin-top: 4px; }
.pet-device-page .pet-device-mark {
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  background: var(--pet-device-accent-bg);
  border: 1px solid color-mix(in srgb, var(--pet-device-accent) 23%, transparent);
  border-radius: 15px;
  display: grid;
  place-items: center;
}
.pet-device-page .pet-device-screen {
  display: block;
  width: 30px;
  height: 30px;
  border: 2px solid var(--pet-device-accent);
  border-radius: 50%;
  background:
    radial-gradient(circle at 9px 10px, var(--pet-device-accent) 1.4px, transparent 2px),
    radial-gradient(circle at 17px 10px, var(--pet-device-accent) 1.4px, transparent 2px),
    radial-gradient(ellipse at 50% 40%, var(--pet-device-panel), var(--pet-device-accent-bg));
  position: relative;
}
.pet-device-page .pet-device-screen::after {
  content: '';
  position: absolute;
  inset: 14px 8px auto;
  height: 5px;
  border-bottom: 2px solid var(--pet-device-accent);
  border-radius: 0 0 50% 50%;
}
.pet-device-page .pet-device-text-muted,
.pet-device-page .pet-device-message { color: var(--pet-device-muted); font-size: 13px; }
.pet-device-page .pet-device-source {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 999px;
  padding: 5px 10px;
  background: var(--pet-device-inset);
  color: var(--pet-device-muted);
  border: 1px solid var(--pet-device-border);
  font-size: 12px;
  font-weight: 650;
}
.pet-device-page .pet-device-source[data-source="tcp"] { background: var(--pet-device-green-bg); color: var(--pet-device-green); border-color: transparent; }
.pet-device-page .pet-device-source[data-source="usb"] { background: var(--pet-device-accent-bg); color: var(--pet-device-accent); border-color: transparent; }
.pet-device-page .pet-device-source::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.pet-device-page .pet-device-fields,
.pet-device-page .pet-device-settings {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 144px), 1fr));
}
.pet-device-page .pet-device-settings {
  align-items: start;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
}
.pet-device-page .pet-device-power {
  align-items: center;
  padding: 12px;
  background: color-mix(in srgb, var(--pet-device-panel) 73%, var(--pet-device-inset));
  border: 1px solid var(--pet-device-border);
  border-radius: 12px;
}
.pet-device-page .pet-device-fields dt { font-size: 12px; }
.pet-device-page .pet-device-fields dd {
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  margin-top: 4px;
}
.pet-device-page .pet-device-battery-value {
  --battery-fill: var(--pet-device-accent);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  line-height: 1.2;
}
.pet-device-page .pet-device-battery-value[data-level="low"] {
  --battery-fill: var(--pet-device-battery-low-fill);
  color: var(--pet-device-battery-low);
}
.pet-device-page .pet-device-battery-value[data-level="muted"] {
  --battery-fill: var(--pet-device-muted);
  color: var(--pet-device-muted);
}
.pet-device-page .pet-device-battery-icon {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 30px;
  height: 17px;
  border: 1.5px solid currentColor;
  border-radius: 4px;
  background: var(--pet-device-inset);
}
.pet-device-page .pet-device-battery-icon::after {
  content: '';
  position: absolute;
  left: calc(100% + 1.5px);
  width: 3px;
  height: 7px;
  border-radius: 0 2px 2px 0;
  background: currentColor;
}
.pet-device-page .pet-device-battery-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 2px;
  background: var(--battery-fill);
}
.pet-device-page .pet-device-battery-bolt {
  position: relative;
  width: 10px;
  height: 13px;
  filter: drop-shadow(1px 0 #211c2c) drop-shadow(-1px 0 #211c2c)
    drop-shadow(0 1px #211c2c) drop-shadow(0 -1px #211c2c);
}
.pet-device-page .pet-device-battery-bolt::before {
  content: '';
  position: absolute;
  inset: 0;
  background: #fff;
  clip-path: polygon(63% 0, 10% 55%, 47% 55%, 33% 100%, 92% 39%, 56% 39%);
}
.pet-device-page .pet-device-binding { justify-content: space-between; align-items: start; }
.pet-device-page .pet-device-binding strong { font-weight: 650; }
.pet-device-page .pet-device-feedback { display: grid; gap: 5px; }
.pet-device-page .pet-device-optional:empty { display: none; }
.pet-device-page .pet-device-alert {
  padding: 9px 12px;
  border-radius: 9px;
  color: var(--pet-device-danger);
  background: var(--pet-device-alert-bg);
  font-size: 13px;
}
.pet-device-page .pet-device-unverified, .pet-device-page .pet-device-detail {
  border-radius: 12px;
  border: 1px solid var(--pet-device-border);
  background: var(--pet-device-inset);
  padding: 13px 14px;
}
.pet-device-page .pet-device-unverified { display: grid; gap: 10px; }
.pet-device-page .pet-device-detail > summary { cursor: pointer; font-weight: 650; }
.pet-device-page .pet-device-detail[open] > summary { margin-bottom: 12px; }
.pet-device-page .pet-device-stack { display: grid; gap: 10px; }
.pet-device-page [hidden] { display: none; }
.pet-device-page :is(h3, h4).pet-device-section-title { font-size: 16px; font-weight: 700; }
.pet-device-page .pet-device-btn {
  appearance: none;
  cursor: pointer;
  min-height: 36px;
  padding: 6px 12px;
  border: 1px solid var(--pet-device-border);
  border-radius: 8px;
  background: var(--pet-device-panel);
  color: var(--pet-device-fg);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  white-space: normal;
}
.pet-device-page .pet-device-btn:hover:not(:disabled) { background: var(--pet-device-inset); }
.pet-device-page .pet-device-btn-primary { background: var(--pet-device-primary); color: var(--pet-device-primary-text); border-color: transparent; }
.pet-device-page .pet-device-btn-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--pet-device-primary) 89%, var(--pet-device-fg));
}
.pet-device-page .pet-device-btn-danger { color: var(--pet-device-danger); }
.pet-device-page .pet-device-btn:disabled { opacity: .52; cursor: default; }
.pet-device-page :is(button, input, select, summary):focus-visible { outline: 2px solid var(--pet-device-accent); outline-offset: 2px; }
.pet-device-page .pet-device-input {
  appearance: none;
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 7px 10px;
  border: 1px solid var(--pet-device-border);
  border-radius: 8px;
  background: var(--pet-device-panel);
  color: var(--pet-device-fg);
  font: inherit;
  font-size: 13px;
}
.pet-device-page .pet-device-input::placeholder { color: var(--pet-device-muted); opacity: 1; }
.pet-device-page .pet-device-input-label { display: grid; gap: 5px; min-width: 0; font-size: 13px; }
.pet-device-page .pet-device-fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.pet-device-page .pet-device-fieldset legend { padding: 0 0 6px; font-size: 12px; font-weight: 650; }
.pet-device-page .pet-device-place {
  display: flex;
  align-items: start;
  gap: 9px;
  padding: 8px 10px;
  border: 1px solid var(--pet-device-border);
  border-radius: 8px;
  cursor: pointer;
}
.pet-device-page .pet-device-place:has(input:checked) {
  border-color: var(--pet-device-accent);
  background: var(--pet-device-accent-bg);
}
.pet-device-page .pet-device-place input { accent-color: var(--pet-device-primary); margin: 4px 0 0; }
.pet-device-page .pet-device-place small { display: block; overflow-wrap: anywhere; }
.pet-device-page .pet-device-separator { border-top: 1px solid var(--pet-device-border); padding-top: 12px; }
.pet-device-page .pet-device-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
`;

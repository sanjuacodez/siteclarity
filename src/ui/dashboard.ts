/**
 * SC-116 — Worker-served audit workspace. No build step or external assets.
 * Keep script regex backslashes doubled: this is a TypeScript template literal.
 * Findings, quotes and limits come from the API; the UI never invents audit data.
 */
export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="sc-requires-key" content="0">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>SiteClarity — Answer readiness audit</title>
<style>
:root {
  color-scheme:light dark;
  --bg:#f6f5f1; --surface:#fff; --soft:#f1f2ed; --border:#dddfd7; --text:#252b27;
  --muted:#657068; --accent:#305e51; --accent-soft:#edf3ef; --button:#fff;
  --warn:#8b641e; --warn-soft:#f8f2e5; --bad:#a3473b; --bad-soft:#faefec;
  --good:#3c6b53; --good-soft:#edf4ee; --shadow:none; --radius:10px;
  --section-size:1.125rem;
}
@media(prefers-color-scheme:dark) {
  :root {
    --bg:#171a18; --surface:#1f2420; --soft:#272d28; --border:#394039; --text:#edf0e9;
    --muted:#a6b1a7; --accent:#aacbb9; --accent-soft:#29372e; --button:#19281f;
    --warn:#dbbe87; --warn-soft:#362f22; --bad:#e4a59a; --bad-soft:#3a2924;
    --good:#a8c9b1; --good-soft:#28382d; --shadow:none;
  }
}
* { box-sizing:border-box }
[hidden] { display:none!important }
body { margin:0; background:var(--bg); color:var(--text); font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif }
a { color:var(--accent); text-underline-offset:3px }
button,input,textarea { font:inherit }
button,a,input,textarea,summary { -webkit-tap-highlight-color:transparent }
button { cursor:pointer }
:focus-visible { outline:3px solid var(--accent); outline-offset:4px }
button:disabled { opacity:.5; cursor:wait }
button { border:0; border-radius:7px; padding:11px 18px; background:var(--accent); color:var(--button); font-weight:600 }
button:hover:not(:disabled) { filter:brightness(.96) }
input,textarea { min-width:0; border:1px solid var(--border); border-radius:10px; background:var(--bg); color:var(--text); padding:13px 15px; width:100% }
input::placeholder,textarea::placeholder { color:var(--muted); opacity:.8 }
input:focus,textarea:focus { outline:2px solid var(--accent); outline-offset:1px }
textarea { resize:vertical; line-height:1.7; font-size:.9rem }
label { display:block; font-size:.85rem; font-weight:600; margin-bottom:7px }
h1,h2,h3,p { margin-top:0 }
h1,h2,h3 { line-height:1.25 }
h1 { font-size:clamp(1.75rem,3vw,2.25rem); letter-spacing:-.035em; font-weight:650; margin-bottom:14px }
h2 { font-size:1.15rem; letter-spacing:-.025em; margin-bottom:8px }
h3 { font-size:1rem; letter-spacing:-.015em }
.shell { max-width:1160px; margin:auto; padding:0 40px }
.topbar { border-bottom:1px solid var(--border); background:var(--surface) }
.topbar .shell { min-height:72px; display:flex; align-items:center; gap:40px }
.brand { color:var(--text); text-decoration:none; font-size:1.15rem; letter-spacing:-.035em; font-weight:750; display:flex; gap:10px; align-items:center }
.brand-mark { background:var(--accent); color:var(--button); width:30px; height:30px; display:grid; place-items:center; border-radius:9px }
.brand-mark svg { width:20px; height:20px }
.topbar nav { display:flex; gap:28px; align-self:stretch; align-items:center }
.topbar nav a { text-decoration:none; color:var(--muted); font-size:.875rem; display:flex; height:100%; align-items:center; border-bottom:2px solid transparent; padding-top:2px }
.topbar nav a[aria-current] { color:var(--text); border-bottom-color:var(--accent); font-weight:600 }
.oss { margin-left:auto; color:var(--muted); font-size:.75rem; padding:4px 10px; border:1px solid var(--border); border-radius:99px; white-space:nowrap }
.oss::before { content:""; display:inline-block; width:6px; height:6px; background:var(--good); border-radius:50%; margin-right:7px }
main.shell { padding-top:48px; padding-bottom:64px }
.eyebrow { font-size:.75rem; text-transform:uppercase; letter-spacing:.09em; color:var(--muted); font-weight:600; margin-bottom:14px; display:flex; gap:8px; align-items:center }
.eyebrow span { width:6px; height:6px; border-radius:50%; background:var(--accent) }
.intro { max-width:720px; margin-bottom:32px }
.intro p { color:var(--muted); font-size:1rem; max-width:650px; margin-bottom:0 }
.setup { display:grid; grid-template-columns:minmax(0,1fr) 270px; gap:0; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); box-shadow:var(--shadow); overflow:hidden }
.setup-main { padding:28px 30px }
.setup-heading { display:flex; align-items:center; gap:9px; margin-bottom:18px }
.step { display:none }
.setup-heading h2 { margin:0; font-size:.96rem }
.modes { display:flex; background:var(--soft); padding:4px; border-radius:7px; gap:4px; margin-bottom:24px }
.mtab { flex:1; background:transparent; color:var(--muted); padding:9px 5px; font-size:.84rem; border:1px solid transparent; border-radius:8px; white-space:nowrap }
.mtab.on { color:var(--text); background:var(--surface); border-color:var(--border); box-shadow:0 2px 4px #00000005 }
.row { display:flex; gap:10px; align-items:center }
.row input { flex:1 }
.row button { min-height:51px; white-space:nowrap; display:flex; gap:15px; align-items:center }
.field-hint { color:var(--muted); font-size:.8125rem; line-height:1.6; margin:10px 0 0 }
.input-bottom { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px }
.cnt { display:flex; align-items:center; gap:8px; margin:10px 0 0; font-size:.8rem; color:var(--muted); font-weight:400 }
.cnt input { width:70px; padding:6px 9px }
.form-note { display:flex; flex-wrap:wrap; gap:6px 18px; border-top:1px solid var(--border); margin-top:22px; padding-top:15px; font-size:.73rem; color:var(--muted) }
.form-note span::before { content:"✓"; color:var(--good); margin-right:6px }
.setup-aside { background:var(--surface); border-left:1px solid var(--border); padding:28px 26px; display:flex; flex-direction:column; justify-content:center }
.setup-aside h3 { font-size:.9375rem; line-height:1.5; margin-bottom:18px; font-weight:600 }
.setup-aside ul { padding:0; margin:0 0 18px; list-style:none; display:grid; gap:12px }
.setup-aside li { display:flex; gap:10px; font-size:.8125rem; color:var(--muted) }
.setup-aside li b { color:var(--accent); font-weight:600 }
.setup-aside a { font-size:.78rem; width:fit-content }
#out { margin-top:48px; scroll-margin-top:32px }
#out:focus { outline:none }
.empty { margin-top:34px }
.section-label { display:flex; align-items:baseline; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px }
.section-label h2 { font-size:var(--section-size); font-weight:600; margin:0 }
.section-label span { font-size:.8125rem; color:var(--muted) }
.feature-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:17px }
.feature { padding:20px 0; border-top:1px solid var(--border) }
.feature .feature-icon { display:none }
.feature h3 { font-size:.9375rem; margin-bottom:9px; font-weight:600 }
.feature p { font-size:.875rem; color:var(--muted); margin:0; line-height:1.75 }
.card { padding:28px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:28px }
/* Card headings were .86, .94, 1.0 and 1.02rem across four cards in the same report. */
.card h2 { font-size:var(--section-size); font-weight:600; letter-spacing:-.02em; margin:0 }
.card p:last-child { margin-bottom:0 }
.report-top { display:grid; grid-template-columns:minmax(0,1fr); gap:20px; margin-bottom:16px }
.report-top h2 { font-size:1.75rem; line-height:1.35; font-weight:600; margin:8px 0 12px; max-width:840px; overflow-wrap:anywhere }
.report-top .eyebrow { margin:0 }
.sub { color:var(--muted); font-size:.875rem; line-height:1.7; margin:0; overflow-wrap:anywhere }
.page-link { font-size:.8rem; overflow-wrap:anywhere }
.badge { color:var(--muted); background:transparent; border:1px solid var(--border); font-size:.75rem; border-radius:5px; padding:4px 9px; display:inline-block }
.summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:0 0 23px }
.metric { padding:20px; background:var(--surface); border:1px solid var(--border); border-radius:8px }
.metric b { font-size:1.75rem; font-weight:600; display:block; letter-spacing:-.04em; line-height:1.2; margin-bottom:8px; font-variant-numeric:tabular-nums }
.metric span { color:var(--muted); font-size:.8125rem }
.metric.high b { color:var(--bad) }
.metric.medium b { color:var(--warn) }
.metric.low b { color:var(--accent) }
.notice { border-radius:12px; border:1px solid var(--border); padding:14px 17px; background:var(--soft); font-size:.81rem; margin-bottom:18px }
.notice strong { display:block; margin-bottom:3px }
.notice p { margin:0 }
.notice.warning { background:var(--warn-soft); border-color:transparent; color:var(--warn) }
.limits { background:transparent; box-shadow:none; font-size:.875rem; line-height:1.75 }
.limits ul { padding-left:18px; margin:16px 0 0; color:var(--muted) }
.limits li { margin:5px 0; overflow-wrap:anywhere }
.filters { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:18px }
.chip { background:transparent; color:var(--muted); border:1px solid var(--border); padding:7px 12px; font-size:.77rem; border-radius:8px }
.chip.on { color:var(--accent); background:var(--accent-soft); border-color:var(--accent) }
.chip span { margin-left:7px; opacity:.85; font-variant-numeric:tabular-nums }
.grp { background:var(--surface); border:1px solid var(--border); border-radius:8px; margin-bottom:12px; overflow:hidden }
.group-summary { list-style:none; cursor:pointer; padding:20px 22px; position:relative }
.group-summary::-webkit-details-marker { display:none }
.group-summary::after { content:"+"; color:var(--muted); position:absolute; right:22px; top:19px; font-size:1.2rem }
.grp[open]>.group-summary::after { content:"−" }
.group-meta { display:flex; align-items:center; gap:10px; margin-bottom:10px; padding-right:25px; flex-wrap:wrap }
.group-meta .muted { font-size:.74rem }
.tag { font-size:.64rem; letter-spacing:.03em; font-weight:650; padding:3px 7px; border-radius:5px }
.tag.high { color:var(--bad); background:var(--bad-soft) }
.tag.medium { color:var(--warn); background:var(--warn-soft) }
.tag.low { color:var(--accent); background:var(--accent-soft) }
.group-summary h3 { margin:0 0 9px; font-size:1rem; line-height:1.5; font-weight:600 }
.group-summary p { font-size:.875rem; line-height:1.7; color:var(--muted); margin:0; max-width:860px }
.ins { padding:20px 22px; border-top:1px solid var(--border) }
.insh { font-size:.8rem; font-weight:600; margin-bottom:10px; overflow-wrap:anywhere }
.evl,.fixl { display:block; font-size:.64rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; font-weight:600 }
blockquote { background:var(--bg); border-left:2px solid var(--border); margin:0 0 9px; padding:12px 15px; font-size:.84rem; color:var(--muted); overflow-wrap:anywhere }
.evidence-ref { margin:0 0 14px; font-size:.69rem; color:var(--muted); overflow-wrap:anywhere }
.fix { margin:15px 0 0; padding:14px 16px; background:var(--accent-soft); border-radius:9px; font-size:.83rem }
.fixl { color:var(--accent) }
.prompt-row { display:flex; align-items:center; gap:10px; margin-top:12px; flex-wrap:wrap }
.copy-prompt { background:var(--accent-soft); color:var(--accent); border:1px solid var(--accent);
  padding:6px 13px; font-size:.76rem; font-weight:650; border-radius:8px; cursor:pointer }
.copy-prompt:hover { background:var(--accent); color:var(--surface) }
.copy-all { background:transparent; color:var(--accent); border:1px solid var(--border);
  padding:7px 14px; font-size:.78rem; font-weight:650; border-radius:9px; cursor:pointer }
.copy-all:hover { border-color:var(--accent) }
.prompt-hint { font-size:.7rem }
.modtag { font-size:.64rem; letter-spacing:.04em; font-weight:650; padding:3px 8px;
  border-radius:5px; background:var(--bg); color:var(--muted); border:1px solid var(--border) }
.modstrip { display:flex; gap:8px; flex-wrap:wrap; margin:0 0 20px }
.modpill { font-size:.76rem; color:var(--muted); background:var(--surface);
  border:1px solid var(--border); border-radius:999px; padding:5px 12px }
.modpill b { color:var(--text); font-weight:650; margin-right:3px }
.sitewide { margin-bottom:20px }
.sitewide .grp { background:var(--bg) }
.sitewide .scope-note { margin-top:14px }
.profile { margin-bottom:28px }
.report-section-head { display:flex; align-items:baseline; justify-content:space-between; gap:20px; margin-bottom:26px }
.report-section-head>div { min-width:0 }
.report-section-head .sub { margin-top:10px; max-width:68ch }
.section-meta { flex-shrink:0; font-size:.8125rem; color:var(--muted); font-variant-numeric:tabular-nums }
.profile-rows { margin:0 }
.focusbox { margin-top:12px; border:1px solid var(--border); border-radius:10px }
.focusbox > summary { cursor:pointer; padding:10px 14px; font-size:.82rem; font-weight:600; list-style:none }
.focusbox > summary::-webkit-details-marker { display:none }
.focusbox > summary::after { content:"+"; float:right; color:var(--muted) }
.focusbox[open] > summary::after { content:"\u2212" }
.focusbody { padding:0 14px 14px; border-top:1px solid var(--border) }
.focusbody p { font-size:.78rem; margin:11px 0 9px }
.focusbody textarea { width:100%; padding:9px 12px; font:inherit; font-size:.86rem;
  background:var(--bg); color:var(--text); border:1px solid var(--border);
  border-radius:9px; resize:vertical }
.plan { margin-bottom:28px }
.plan>.sub { margin-bottom:22px }
.planlist { list-style:none; margin:0; padding:0; counter-reset:none }
.planitem { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:14px;
  align-items:start; padding:14px 0; border-top:1px solid var(--border) }
.plann { display:grid; place-items:center; width:22px; height:22px; border-radius:7px;
  background:var(--accent-soft); color:var(--accent); font-size:.72rem; font-weight:700 }
.plantitle { font-size:.9375rem; font-weight:600; margin:0 0 8px }
.planwhy { font-size:.875rem; line-height:1.7; color:var(--muted); margin:0 }
.planfrom { font-size:.7rem; color:var(--muted); margin:5px 0 0 }
.planwhere { font-size:.7rem; color:var(--muted); white-space:nowrap }
@media (max-width:620px) { .planitem { grid-template-columns:auto minmax(0,1fr) } .planwhere { display:none } }
.coverage-columns,.coverage-row { display:grid; grid-template-columns:minmax(0,1fr) 180px; gap:24px }
.coverage-columns { color:var(--muted); font-size:.75rem; padding-bottom:12px }
.coverage-row { padding:22px 0; align-items:baseline; border-top:1px solid var(--border) }
.coverage-row:last-child { padding-bottom:2px }
.cvg .qtext { font-size:.9375rem; font-weight:500; color:var(--text); line-height:1.6; margin:0; overflow-wrap:anywhere }
.cvg .qarea { font-size:.8125rem; line-height:1.5; color:var(--muted); margin:6px 0 0 }
.cvg .qpages { font-size:.8125rem; color:var(--muted); margin:8px 0 0; overflow-wrap:anywhere }
.cstat { display:inline-flex; align-items:baseline; gap:8px; font-size:.8125rem; font-weight:500; line-height:1.6; width:fit-content }
.cstat::before { content:""; width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0 }
.cstat.answered { color:var(--good) }
.cstat.unanswered { color:var(--warn) }
.cstat.absent { color:var(--muted) }
/* Detail row inside the profile and coverage cards. NOT .prow: that is the page
   table's <tr>, and making a table row a grid stops it being a row at all. */
.drow { display:grid; grid-template-columns:190px minmax(0,1fr); gap:32px; padding:24px 0;
  border-top:1px solid var(--border) }
.drow:last-child { padding-bottom:2px }
.plabel { font-size:.875rem; font-weight:500; color:var(--muted); line-height:1.7 }
.pval { font-size:.9375rem; line-height:1.75; margin:0; min-width:0; overflow-wrap:anywhere }
.pval blockquote { margin:0; background:transparent; color:var(--text); padding:0 0 0 18px; border-left:2px solid var(--border); border-radius:0; font-size:inherit; line-height:inherit; max-width:72ch }
.pval .evidence-ref { margin:12px 0 0; padding-left:20px; font-size:.75rem; line-height:1.6 }
.pval .evidence-ref code { font-size:inherit }
.pval.missing { color:var(--muted) }
@media (max-width:700px) {
  .drow { grid-template-columns:1fr; gap:10px; padding:22px 0 }
  .plabel { color:var(--text); font-weight:600 }
  .report-section-head { flex-direction:column; align-items:flex-start; gap:12px; margin-bottom:24px }
  .coverage-columns { display:none }
  .coverage-row { grid-template-columns:1fr; gap:12px; padding:20px 0 }
}
.progress-card { background:var(--surface); border:1px solid var(--border); border-radius:14px;
  padding:20px 22px }
.progress-head { display:flex; justify-content:space-between; align-items:baseline; gap:12px }
.elapsed { font-variant-numeric:tabular-nums; color:var(--muted); font-size:.82rem }
.stages { list-style:none; margin:16px 0 0; padding:0; display:flex; flex-direction:column; gap:9px }
.stage { display:flex; align-items:center; gap:10px; font-size:.86rem; color:var(--muted);
  opacity:.5; transition:opacity .18s, color .18s }
.stage.active, .stage.done { opacity:1 }
.stage.active { color:var(--text) }
.stage.done { color:var(--accent) }
.dot { width:9px; height:9px; border-radius:50%; background:var(--border); flex:none;
  transition:background .18s, box-shadow .18s }
.stage.active .dot { background:var(--accent); box-shadow:0 0 0 4px var(--accent-soft);
  animation:pulse 1s ease-in-out infinite }
.stage.done .dot { background:var(--accent) }
@keyframes pulse { 0%,100% { box-shadow:0 0 0 2px var(--accent-soft) }
  50% { box-shadow:0 0 0 6px var(--accent-soft) } }
.pbar { height:3px; background:var(--border); border-radius:99px; margin-top:18px; overflow:hidden }
.pbar div { height:100%; width:0; background:var(--accent); border-radius:99px;
  transition:width .14s linear }
.speedline { font-size:.76rem; color:var(--muted); margin:8px 0 0 }
.speedline strong { color:var(--accent); font-weight:650 }
@media (prefers-reduced-motion: reduce) {
  .stage, .dot, .pbar div { transition:none }
  .stage.active .dot { animation:none }
}
.report-actions { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px }
.exports { display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end }
.exportl { font-size:.75rem; color:var(--muted);
  font-weight:650 }
.exp { background:transparent; color:var(--muted); border:1px solid var(--border);
  padding:7px 11px; font-size:.8125rem; font-weight:500; border-radius:5px; cursor:pointer }
.exp:hover { color:var(--accent); border-color:var(--accent) }
.keybox.needed { border-color:var(--warn); background:var(--warn-soft) }
.keybox.needed > summary { color:var(--warn) }
.keybox { border:1px solid var(--border); border-radius:12px; margin:0 0 14px; background:var(--surface) }
.keybox > summary { cursor:pointer; padding:11px 15px; font-size:.82rem; font-weight:600; list-style:none }
.keybox > summary::-webkit-details-marker { display:none }
.keybox > summary::after { content:"+"; float:right; color:var(--muted) }
.keybox[open] > summary::after { content:"−" }
.keybox .muted { font-weight:400 }
.keybody { padding:0 15px 15px; border-top:1px solid var(--border) }
.keybody p { font-size:.78rem; margin:12px 0 10px }
.fieldlabel { display:block; font-size:.7rem; letter-spacing:.06em; text-transform:uppercase;
  color:var(--muted); font-weight:650; margin:12px 0 5px }
.field { width:100%; padding:9px 12px; font:inherit; font-size:.86rem; background:var(--bg);
  color:var(--text); border:1px solid var(--border); border-radius:9px }
.providernote { font-size:.74rem !important; margin:7px 0 0 !important }
.keybody input { flex:1 1 260px; padding:9px 12px; font:inherit; font-size:.86rem;
  background:var(--bg); color:var(--text); border:1px solid var(--border); border-radius:9px }
.keybody button { padding:9px 15px; font-size:.8rem; font-weight:650; border-radius:9px;
  border:1px solid var(--accent); background:var(--accent); color:var(--button); cursor:pointer }
.keybody button.ghost { background:transparent; color:var(--muted); border-color:var(--border) }
.keywarn { color:var(--warn) !important; margin-bottom:0 !important }
mark { background:var(--warn-soft); color:var(--warn); border-radius:3px; font-weight:600 }
.muted { color:var(--muted) }
.empty-result { text-align:center; padding:28px; border:1px dashed var(--border); border-radius:14px; margin-bottom:18px }
.empty-result h3 { margin-bottom:8px }
.empty-result p { margin:0; font-size:.83rem; color:var(--muted) }
.progress { display:flex; align-items:center; gap:17px }
.progress strong { font-size:.9rem }
.progress p { font-size:.8rem; color:var(--muted); margin:3px 0 0 }
.spin { width:23px; height:23px; border:2px solid var(--border); border-right-color:var(--accent); border-radius:50%; animation:spin .8s linear infinite; flex-shrink:0 }
@keyframes spin { to { transform:rotate(360deg) } }
@media(prefers-reduced-motion:reduce) { .spin { animation:none } }
.err { border-color:var(--bad); background:var(--bad-soft) }
.err h2 { color:var(--bad); font-size:.95rem }
.err p { font-size:.85rem; margin-bottom:7px }
.tbl-card { padding:22px 0 0; overflow:hidden }
.table-title { padding:0 22px 20px }
.tscroll { overflow-x:auto }
.tbl { width:100%; border-collapse:collapse; text-align:left; font-size:.83rem }
.tbl th { background:var(--soft); font-size:.65rem; text-transform:uppercase; letter-spacing:.05em; font-weight:600; color:var(--muted); padding:11px 18px; white-space:nowrap }
.tbl td { padding:16px 18px; border-top:1px solid var(--border); vertical-align:top }
.tbl th.c-n,.tbl td.c-n { text-align:center; white-space:nowrap; width:85px }
.prow:hover { background:var(--soft) }
.page-toggle { background:transparent; color:var(--text); padding:0; text-align:left; width:100%; display:flex; gap:12px; align-items:flex-start; font-weight:500 }
.page-toggle::before { content:"›"; color:var(--muted); font-size:1.2rem; line-height:1.2; transition:transform .15s }
.page-toggle[aria-expanded=true]::before { transform:rotate(90deg) }
.ptitle { font-size:.83rem; font-weight:600; display:block; overflow-wrap:anywhere }
.ppath { display:block; font-size:.7rem; color:var(--muted); margin-top:3px; overflow-wrap:anywhere }
.page-status { font-size:.66rem; color:var(--warn); display:block; margin-top:4px }
.n { font-weight:650; font-variant-numeric:tabular-nums; border-radius:5px; padding:3px 7px; display:inline-block; min-width:25px }
.n.high { background:var(--bad-soft); color:var(--bad) }
.n.medium { background:var(--warn-soft); color:var(--warn) }
.n.low { background:var(--accent-soft); color:var(--accent) }
.n.zero { color:var(--muted) }
.pbody>td { background:var(--bg); padding:20px }
.pbody .card { margin-bottom:12px }
.tech { font-size:.8rem; margin-top:18px }
.tech summary { cursor:pointer; color:var(--muted); font-weight:600 }
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; padding-top:18px }
.stat b { display:block; font-size:1rem }
.stat span { color:var(--muted); font-size:.7rem }
.tech p { color:var(--muted); margin:15px 0 0 }
code { font-family:ui-monospace,SFMono-Regular,monospace; font-size:.85em; overflow-wrap:anywhere }
.site-footer { border-top:1px solid var(--border); color:var(--muted) }
.footer-main { display:flex; justify-content:space-between; align-items:center; gap:32px; padding:30px 0 }
.footer-brand { color:var(--text); text-decoration:none; font-size:1rem; font-weight:650; letter-spacing:-.025em }
.footer-identity p { font-size:.8125rem; line-height:1.6; margin:6px 0 0 }
.footer-links { display:flex; gap:24px; flex-wrap:wrap; align-items:center }
.footer-links a { font-size:.8125rem; color:var(--text); text-decoration:none }
.footer-links a:hover { text-decoration:underline; text-underline-offset:4px }
.footer-bottom { display:flex; justify-content:space-between; gap:16px; padding:18px 0 26px; border-top:1px solid var(--border); font-size:.75rem; line-height:1.6 }
.skip { position:absolute; left:20px; top:-80px; background:var(--surface); padding:10px; z-index:5 }
.skip:focus { top:10px }
.sr-status { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap }
@media(max-width:850px) {
  .setup { grid-template-columns:1fr }
  .setup-aside { display:none }
  .shell { padding-inline:24px }
}
@media(max-width:560px) {
  .shell { padding-inline:18px }
  .topbar .shell { min-height:67px; gap:22px }
  .brand { font-size:1rem; gap:7px }
  .brand-mark { width:27px; height:27px }
  .topbar nav { gap:17px }
  .topbar nav a { font-size:.8125rem }
  .oss { display:none }
  main.shell { padding-top:32px; padding-bottom:40px }
  .intro { margin-bottom:25px }
  .intro p { font-size:.89rem }
  .setup-main { padding:20px 17px }
  .row { flex-direction:column; align-items:stretch }
  .row input { flex:auto }
  .row button { justify-content:center }
  .feature-grid { grid-template-columns:1fr; gap:10px }
  .feature { padding:18px 0 }
  .feature h3 { margin-bottom:5px }
  .section-label { gap:8px }
  .summary-grid { grid-template-columns:repeat(2,1fr); gap:9px }
  .metric { padding:14px 16px }
  .metric b { font-size:1.4rem }
  .report-top h2 { font-size:1.4rem }
  .report-actions { align-items:flex-start; flex-direction:column }
  .exports { justify-content:flex-start }
  .card { padding:22px 18px; margin-bottom:22px }
  .tbl-card { padding:18px 0 0 }
  .tbl { min-width:590px }
  .group-summary,.ins { padding:17px }
  .stats { grid-template-columns:repeat(2,1fr) }
  .footer-main { flex-direction:column; align-items:flex-start; gap:22px; padding:26px 0 }
  .footer-bottom { flex-direction:column; gap:8px }
}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to audit</a>
<header class="topbar"><div class="shell">
  <a class="brand" href="/" aria-label="SiteClarity home"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M5 12h9M5 17h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="m15 16 2 2 4-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>SiteClarity</a>
  <nav aria-label="Main navigation"><a href="/" aria-current="page">Audit</a><a href="/checks">How it works</a></nav>
  <span class="oss">Open source · MIT</span>
</div></header>
<main id="main" class="shell">
  <div class="intro">
    <div class="eyebrow">Content review</div>
    <h1>Website content audit</h1>
    <p>Review what your pages communicate, which buyer questions they answer, and what to improve next.</p>
  </div>
  <section class="setup" aria-labelledby="setup-title">
    <div class="setup-main">
      <div class="setup-heading"><span class="step" aria-hidden="true">01</span><h2 id="setup-title">Choose what to audit</h2></div>
      <div class="modes" role="tablist" aria-label="Audit scope">
        <button type="button" id="tab-page" class="mtab on" role="tab" aria-selected="true" aria-controls="pane-page" data-m="page">One page</button>
        <button type="button" id="tab-site" class="mtab" role="tab" aria-selected="false" aria-controls="pane-site" tabindex="-1" data-m="site">Site scan</button>
        <button type="button" id="tab-list" class="mtab" role="tab" aria-selected="false" aria-controls="pane-list" tabindex="-1" data-m="list">URL list</button>
      </div>
<details class="keybox" id="keybox">
  <summary>API key <span class="muted" id="key-status"></span></summary>
  <div class="keybody">
    <p class="muted">Paste your own <a href="https://typesafe.ai" target="_blank" rel="noopener noreferrer">TypeSafe Jev</a> key to run audits against your own account. It is stored in this browser only, sent with each audit request, and never saved on the server.</p>
    <label class="fieldlabel" for="provider-select">Decision model</label>
    <select id="provider-select" class="field">
      <option value="systemone">Jev — TypeSafe hosted API (needs a key)</option>
      <option value="systemone-self">Kev or Decider — your own server</option>
      <option value="laya">Laya — your own server</option>
    </select>
    <p class="muted providernote" id="provider-note"></p>

    <div id="server-row" hidden>
      <label class="fieldlabel" for="server-input">Server URL</label>
      <input type="url" id="server-input" class="field" placeholder="https://your-server.example.com"
             autocomplete="off" spellcheck="false">
    </div>

    <label class="fieldlabel" for="model-input">Model <span class="muted">(optional)</span></label>
    <input type="text" id="model-input" class="field" autocomplete="off" spellcheck="false">

    <label class="fieldlabel" for="key-input">API key <span class="muted">(optional for your own server)</span></label>
    <div class="row">
      <input type="password" id="key-input" autocomplete="off" spellcheck="false" aria-label="API key">
      <button type="button" id="key-save">Save</button>
      <button type="button" id="key-clear" class="ghost">Remove</button>
    </div>
    <p class="muted keywarn">Anyone who can use this browser profile can read the key. On a shared machine, remove it when you are done.</p>
  </div>
</details>
      <form id="f">
        <div id="pane-page" class="pane" role="tabpanel" aria-labelledby="tab-page">
          <label for="u">Page URL</label>
          <div class="row"><input type="url" id="u" placeholder="https://example.com/page" required autocomplete="url" aria-describedby="page-hint"><button id="b" type="submit">Audit page <span aria-hidden="true">↗</span></button></div>
          <p class="field-hint" id="page-hint">A focused review of one public page.</p>
        </div>
        <div id="pane-site" class="pane" role="tabpanel" aria-labelledby="tab-site" hidden>
          <label for="us">Website URL</label>
          <div class="row"><input type="url" id="us" placeholder="https://example.com" required disabled autocomplete="url" aria-describedby="site-hint"><button type="submit" disabled>Scan pages <span aria-hidden="true">↗</span></button></div>
          <label class="cnt" for="np">Page limit <input type="number" id="np" value="8" min="2" max="25" required disabled> between 2 and 25</label>
          <p class="field-hint" id="site-hint">Reviews the first pages found in your sitemap. This is a sample, not a complete site audit.</p>
        </div>
        <div id="pane-list" class="pane" role="tabpanel" aria-labelledby="tab-list" hidden>
          <label for="ul">Page URLs</label>
          <textarea id="ul" rows="4" required disabled aria-describedby="list-hint ulcount" placeholder="https://example.com/pricing&#10;https://example.com/features"></textarea>
          <p class="field-hint" id="list-hint">One URL per line, up to 25 unique pages. Duplicate URLs are removed.</p>
          <div class="input-bottom"><span class="field-hint" id="ulcount">0 URLs</span><button type="submit" disabled>Audit list <span aria-hidden="true">↗</span></button></div>
        </div>
        <details class="focusbox">
          <summary>What should this say? <span class="muted">optional</span></summary>
          <div class="focusbody">
            <p class="muted">Tell us what you believe your content communicates &mdash; who it is
            for, the problem it solves, what makes you different. We check whether it actually
            says so. One per line, up to three.</p>
            <textarea id="focus" rows="3" aria-describedby="focus-count" placeholder="We are built for agencies managing many client stores
We help stores reduce cart abandonment"></textarea>
            <p class="field-hint" id="focus-count">0 of 3</p>
            <p class="field-hint">On a scan we report <strong>which page</strong> says each one, and
            flag anything no page says. We never judge whether a statement is true &mdash; only
            whether your pages say it.</p>
          </div>
        </details>
      </form>
      <div class="form-note"><span>Source-backed findings</span><span>Prioritised fixes</span><span>No account needed</span></div>
    </div>
    <aside class="setup-aside" aria-label="What is included">
      <h3>A clear next step for every finding.</h3>
      <ul><li><b>01</b> Find content and structure issues</li><li><b>02</b> See the exact source evidence</li><li><b>03</b> Know what to change next</li></ul>
      <a href="/checks">Explore the checks <span aria-hidden="true">↗</span></a>
    </aside>
  </section>
  <div id="status" class="sr-status" role="status" aria-live="polite"></div>
  <section id="out" aria-label="Audit report" tabindex="-1" hidden></section>
  <section id="empty" class="empty" aria-labelledby="empty-title">
    <div class="section-label"><h2 id="empty-title">Look beyond keywords.</h2><span>Three ways to make your content clearer</span></div>
    <div class="feature-grid">
      <article class="feature"><span class="feature-icon" aria-hidden="true">⌘</span><h3>Structure that makes sense</h3><p>Check headings, structured data and whether meaningful content is available in the HTML.</p></article>
      <article class="feature"><span class="feature-icon" aria-hidden="true">≡</span><h3>Answers that stand alone</h3><p>Spot sections that need more context, clearer claims or a more direct answer.</p></article>
      <article class="feature"><span class="feature-icon" aria-hidden="true">↗</span><h3>Changes you can act on</h3><p>Work through prioritised findings with source quotes and a specific action for each one.</p></article>
    </div>
  </section>
</main>
<footer class="site-footer"><div class="shell">
  <div class="footer-main">
    <div class="footer-identity"><a class="footer-brand" href="/">SiteClarity</a><p>A practical workspace for reviewing website content.</p></div>
    <nav class="footer-links" aria-label="Footer navigation">
      <a href="/checks">Checks &amp; limitations</a>
      <a href="https://github.com/sanjuacodez/siteclarity" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
    </nav>
  </div>
  <div class="footer-bottom"><span>Free &amp; open source · MIT license</span><span>Reports stay in this tab. Export a copy to keep it.</span></div>
</div></footer>
<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let busy = false;
let activeReport = null;
// Exports must work for a site scan too, and renderSite deliberately clears
// activeReport, so the export context is tracked separately.
let exportCtx = null;
let activeFilter = 'all';
let __gid = 0;

/**
 * Findings carry the module that produced them. The UI ignored it, so Module 2's output
 * was live but invisible — indistinguishable from Module 1's. Naming the module is what
 * makes it findable.
 */
const MODULE_LABELS = {
  ai_readiness: 'Answer readiness',
  evidence_trust: 'Evidence & trust',
  messaging: 'Messaging',
  website_understanding: 'Website understanding',
  question_coverage: 'Question coverage',
  buyer_journey: 'Buyer journey',
  audience_coverage: 'Audience coverage',
  product_portfolio: 'Product portfolio',
  content_overlap: 'Content overlap',
  content_opportunity: 'Opportunities',
};
const moduleLabel = (id) => MODULE_LABELS[id] || 'Other';

const PROFILE_LABELS = {
  business_type: 'Business type',
  what_it_does: 'What it does',
  who_its_for: 'Who it is for',
  problem_solved: 'The problem it solves',
  differentiator: 'What makes it different',
};
const BUSINESS_TYPE_TEXT = {
  saas: 'Software sold as a subscription',
  ecommerce: 'Sells goods directly',
  agency: 'Sells services delivered by people',
  marketplace: 'Connects buyers and sellers',
  publisher: 'Publishes articles, courses or media',
  tool_or_plugin: 'An add-on for another platform',
  nonprofit: 'A charity or public-interest organisation',
  personal: 'A personal site or portfolio',
};

/**
 * Module 4's profile. Every quote is the page's own sentence, selected by the model and
 * looked up by id — so it is rendered as a quotation, not as a summary. A dimension the
 * page does not state is shown plainly rather than hidden, because "you never say who
 * this is for" is the most useful thing here.
 */
function profileCard(d) {
  const entries = d.profile || [];
  if (!entries.length) return '';
  const rows = entries.map(e => {
    const label = PROFILE_LABELS[e.dimension] || e.dimension;
    if (e.value) {
      return '<div class="drow"><dt class="plabel">' + esc(label) + '</dt>' +
        '<dd class="pval">' + esc(BUSINESS_TYPE_TEXT[e.value] || e.value) + '</dd></div>';
    }
    if (e.quote) {
      return '<div class="drow"><dt class="plabel">' + esc(label) + '</dt>' +
        '<dd class="pval"><blockquote>' + esc(e.quote) + '</blockquote>' +
        '<p class="evidence-ref">Your words \u00b7 passage <code>' + esc(e.passageId) + '</code></p></dd></div>';
    }
    return '<div class="drow"><dt class="plabel">' + esc(label) + '</dt>' +
      '<dd class="pval missing">' + esc(e.absentReason || 'Not stated on this page.') + '</dd></div>';
  }).join('');
  const stated = entries.filter(e => e.value || e.quote).length;
  return '<section class="card profile"><div class="report-section-head"><div><h2>What this page says it is</h2>' +
    '<p class="sub">How your business is described on this page. The selected quotes are your own words, shown verbatim.</p></div>' +
    '<span class="section-meta">' + stated + ' of ' + entries.length + ' stated</span></div>' +
    '<dl class="profile-rows">' + rows + '</dl></section>';
}
const priorities = { high: 0, medium: 1, low: 2 };

function safeUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; }
  catch { return ''; }
}
function pageLink(value, text) {
  const href = safeUrl(value);
  return href ? '<a class="page-link" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(text || value) + ' ↗</a>' : esc(text || value);
}
function currentMode() { return document.querySelector('.mtab.on').dataset.m; }
function selectMode(mode, focus) {
  document.querySelectorAll('.mtab').forEach(t => {
    const selected = t.dataset.m === mode;
    t.classList.toggle('on', selected); t.setAttribute('aria-selected', String(selected)); t.tabIndex = selected ? 0 : -1;
    if (selected && focus) t.focus();
  });
  for (const m of ['page', 'site', 'list']) {
    const pane = $('pane-' + m);
    pane.hidden = m !== mode;
    pane.querySelectorAll('input,textarea,button').forEach(el => { el.disabled = busy || m !== mode; });
  }
}
function setBusy(value) {
  busy = value;
  document.querySelectorAll('.mtab').forEach(t => { t.disabled = value; });
  selectMode(currentMode(), false);
  $('f').setAttribute('aria-busy', String(value));
}
function showOutput(html, focus) {
  // Any render that is not the loading card means the work is over.
  if (html.indexOf('progress-card') === -1) stopStages();
  $('empty').hidden = true; $('out').hidden = false; $('out').innerHTML = html;
  if (focus) { $('out').focus({ preventScroll: true }); $('out').scrollIntoView({ block:'start' }); }
}
function announce(message) { $('status').textContent = message; }
/**
 * Loading state, paced against what the pipeline actually costs.
 *
 * Measured on a real page: fetching it ~500 ms, extraction ~10 ms, and Jev ~395 ms for
 * five calls. A single indeterminate spinner hides that and makes a sub-second audit
 * feel slow; showing the stages lets the fast ones visibly snap past, which is the
 * honest impression.
 *
 * These durations only pace the display. The moment the response lands the strip jumps
 * to done, so the animation can finish early but never lag reality — an animation that
 * outlives its request is just a lie about how long the work took.
 */
const STAGES = [
  { id: 'fetch', label: 'Fetching the page', ms: 550 },
  { id: 'read', label: 'Reading structure', ms: 60 },
  { id: 'static', label: 'Checking markup and language', ms: 90 },
  { id: 'judge', label: 'Judging each section', ms: 420 },
];

let stageTimer = null;
let stageStart = 0;
let speedHtml = '';

function loading(title, detail) {
  return '<div class="card progress-card">' +
    '<div class="progress-head"><strong id="progress-title">' + esc(title) + '</strong>' +
    '<span class="elapsed" id="progress-elapsed">0.0s</span></div>' +
    '<p class="sub" id="progress-detail">' + esc(detail) + '</p>' +
    '<ol class="stages" id="stages">' +
    STAGES.map(st => '<li class="stage" data-s="' + st.id + '">' +
      '<span class="dot" aria-hidden="true"></span>' +
      '<span class="stage-label">' + esc(st.label) + '</span></li>').join('') +
    '</ol><div class="pbar"><div id="pbar-fill"></div></div></div>';
}

function startStages() {
  // Decoration must never be able to break an audit, so every entry point here is
  // guarded and any failure simply means no animation.
  if (typeof setInterval !== 'function' || !document.querySelectorAll) return;
  stopStages();
  stageStart = Date.now();
  const total = STAGES.reduce((n, st) => n + st.ms, 0);
  let reduced = false;
  try {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (err) { reduced = true; }

  const tick = () => {
    try { paint(); } catch (err) { stopStages(); }
  };

  const paint = () => {
    const elapsed = Date.now() - stageStart;
    const el = $('progress-elapsed');
    if (el) el.textContent = (elapsed / 1000).toFixed(1) + 's';
    if (!document.querySelector) return;

    let acc = 0;
    for (const st of STAGES) {
      const node = document.querySelector('.stage[data-s="' + st.id + '"]');
      if (!node || !node.classList) continue;
      const done = elapsed > acc + st.ms;
      const active = !done && elapsed > acc;
      node.classList.toggle('done', done);
      node.classList.toggle('active', active);
      acc += st.ms;
    }
    const fill = $('pbar-fill');
    // Hold short of the end: the request, not the clock, decides when this finishes.
    if (fill && fill.style) fill.style.width = Math.min(92, (elapsed / total) * 92) + '%';
  };

  tick();
  if (!reduced) stageTimer = setInterval(tick, 80);
}

function stopStages() {
  if (stageTimer) { clearInterval(stageTimer); stageTimer = null; }
}

/** Snap everything to complete, however early the response arrived. */
function finishStages() {
  stopStages();
  try {
    document.querySelectorAll('.stage').forEach(n => {
      n.classList.toggle('done', true); n.classList.toggle('active', false);
    });
    const fill = $('pbar-fill');
    if (fill && fill.style) fill.style.width = '100%';
  } catch (err) { /* nothing to finish */ }
}
function renderErr(data) {
  return '<div class="card err" role="alert"><h2>We couldn’t complete this audit</h2><p>' +
    esc(data.error && data.error.message || 'The request failed. Please try again.') +
    '</p><p class="muted">Check the URL and try again. You can also use a URL list if sitemap discovery is unavailable.</p></div>';
}
function readUrls(raw) {
  return [...new Set(raw.split(/[\\n,]+/).map(s => s.trim()).filter(Boolean).map(s => safeUrl(s) || s))];
}
function parseUrlList(raw) { return readUrls(raw).slice(0, 25); }
// Input validation remains mode-specific: hidden required inputs are disabled.
function validateList() {
  const urls = readUrls($('ul').value);
  const invalid = urls.find(u => !safeUrl(u) || new URL(u).username || new URL(u).password);
  const message = urls.length > 25 ? 'Please use 25 unique URLs or fewer. No URLs have been submitted.' :
    invalid ? 'Use a full http:// or https:// URL without credentials on each line.' : '';
  $('ul').setCustomValidity(message);
  $('ulcount').textContent = urls.length + (urls.length === 1 ? ' URL' : ' URLs') + (urls.length > 25 ? ' · limit is 25' : '');
  return !message;
}
document.addEventListener('change', e => {
  if (e.target && e.target.id === 'provider-select') {
    const s = loadSettings();
    // Model ids are provider-specific, so clear it when the provider changes.
    saveSettings({ provider: e.target.value, server: s.server, model: '' });
    renderSettingsState();
  }
});

document.addEventListener('input', e => {
  if (e.target && e.target.id === 'focus') {
    const n = readFocus().length;
    const el = $('focus-count');
    if (el) el.textContent = n + ' of 3' + (n >= 3 ? ' \u00b7 limit reached' : '');
  }
  if (e.target.id === 'ul') validateList();
});
document.addEventListener('click', e => {
  // Copy-prompt lives inside the existing delegated handler on purpose: a second
  // document-level click listener competes with this one rather than composing with it.
  const expBtn = e.target.closest && e.target.closest('.exp');
  if (expBtn) { e.preventDefault(); handleExport(expBtn.dataset.x); return; }
  if (e.target.id === 'skip-key') {
    // The deterministic layer genuinely works without a model, so offer it rather than
    // implying a key is the only route to anything useful.
    skipKeyOnce = true;
    $('f').dispatchEvent(new Event('submit', { cancelable: true }));
    return;
  }
  if (e.target.id === 'key-save') {
    const input = $('key-input');
    const value = input.value.trim();
    const sel = $('provider-select');
    const ok = saveKey(value) && (!sel || saveSettings({
      provider: sel.value,
      server: (($('server-input') || {}).value || '').trim(),
      model: (($('model-input') || {}).value || '').trim(),
    }));
    renderKeyState();
    announce(ok ? (value ? 'API key saved in this browser.' : 'API key removed.')
                : 'Could not save the key — browser storage is unavailable.');
    return;
  }
  if (e.target.id === 'key-clear') {
    saveKey(''); $('key-input').value = ''; renderKeyState();
    announce('API key removed from this browser.');
    return;
  }
  const copyBtn = e.target.closest && e.target.closest('[data-p]');
  if (copyBtn) { e.preventDefault(); handleCopyPrompt(copyBtn); return; }
  const tab = e.target.closest('.mtab');
  if (tab && !busy) selectMode(tab.dataset.m, false);
  const filter = e.target.closest('.chip');
  if (filter && activeReport) {
    activeFilter = filter.dataset.f;
    $('finding-list').innerHTML = findingsBody(activeReport, activeFilter);
    document.querySelectorAll('.chip').forEach(c => {
      const on = c.dataset.f === activeFilter; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on));
    });
  }
  const toggle = e.target.closest('.page-toggle');
  if (toggle) {
    const body = $(toggle.getAttribute('aria-controls'));
    body.hidden = !body.hidden; toggle.setAttribute('aria-expanded', String(!body.hidden));
  }
});
document.addEventListener('keydown', e => {
  const tab = e.target.closest('.mtab');
  if (!tab || busy || !['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
  e.preventDefault();
  const modes = ['page','site','list']; const index = modes.indexOf(tab.dataset.m);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (index + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
  selectMode(modes[next], true);
});
$('f').addEventListener('submit', async e => {
  e.preventDefault();
  if (busy) return;
  if (currentMode() === 'list' && !validateList()) { $('ul').reportValidity(); return; }
  // Only the hosted provider needs a key; a self-hosted server usually has none.
  if (needsKey && loadSettings().provider === 'systemone' && !loadKey() && !skipKeyOnce) {
    promptForKey(); return;
  }
  skipKeyOnce = false;
  setBusy(true); activeReport = null; exportCtx = null; activeFilter = 'all'; announce('Audit started.');
  try {
    if (currentMode() === 'page') {
      showOutput(loading('Auditing your page', 'Structure and language checks run locally; each section is judged separately.'), false);
      startStages();
      const data = await requestPage($('u').value.trim(), readFocus());
      activeReport = data;
      exportCtx = { kind: 'page', reports: [data] };
      try { finishStages(); speedHtml = speedLine(data); } catch (err) { speedHtml = ''; }
      showOutput(render(data), true); announce('Audit complete. ' + data.findings.length + ' findings.');
    } else if (currentMode() === 'site') {
      await scanSite($('us').value.trim(), Number($('np').value));
    } else {
      await analyseList(parseUrlList($('ul').value));
    }
  } catch (err) {
    showOutput(renderErr({ error: { message: err.message } }), true);
    announce('Audit could not be completed.');
  } finally { setBusy(false); }
});
async function requestPage(url, focus, partOfScan) {
  const body = focus && focus.length ? { url, focus } : { url };
  // In a scan the same statement would otherwise produce the identical "no sentence here
  // says so" on every page. The site pass makes the claim once, naming the pages.
  if (partOfScan) body.partOfScan = true;
  const r = await fetch('/api/analyze', { method:'POST', headers:analyzeHeaders(), body:JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error && d.error.message || 'Unable to analyse this page.');
  return d;
}
async function analyseList(urls, metadata) {
  const results = []; const failures = [];
  const focusList = readFocus();
  const meta = metadata || { totalFound:urls.length, urls, truncated:false, sitemapUrl:null };
  showOutput(loading('Preparing ' + urls.length + ' pages…', 'Each page is analysed separately. Keep this tab open.'), false);
  let done = 0;
  const queue = urls.slice();
  await Promise.all(Array.from({ length:Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const url = queue.shift();
      try { results.push(await requestPage(url, focusList, true)); }
      catch (err) { failures.push({ url, error:{ message:err.message } }); }
      done++;
      const message = done + ' of ' + urls.length + ' pages processed';
      $('progress-title').textContent = message;
      $('progress-detail').textContent = results.length + ' analysed · ' + failures.length + ' failed. The report will appear when this scan finishes.';
      announce(message);
    }
  }));
  // Checks that need several pages. Each page already returned a compact summary, so
  // this is one short call over the inventory rather than any re-reading.
  let site = null;
  const inventory = results.map(r => r.summary_for_site).filter(Boolean);
  if (inventory.length >= 3) {
    $('progress-title').textContent = 'Looking across all ' + inventory.length + ' pages…';
    $('progress-detail').textContent = 'Comparing what the pages do together.';
    try {
      // Module 10 groups findings across pages and this browser is the only thing
      // holding all of them. Only the part that carries grouping goes back — never the
      // quotes or the copy, which the server already produced.
      const grouping = results.flatMap(r => r.findings.map(f => ({
        id: f.id, checkId: f.checkId, module: f.module,
        pageUrl: (f.affects[0] && f.affects[0].pageUrl) || r.input.finalUrl,
      }))).slice(0, 500);
      // What each page concluded about each stated statement. The roll-up turns these
      // into the answer a site owner actually wants: which page says it.
      const focusOutcomes = results.flatMap(r => (r.focus || []).map(x => ({
        id: x.id, text: x.text, pageUrl: r.input.finalUrl, found: x.found,
      })));
      const sr = await fetch('/api/site', { method:'POST', headers:analyzeHeaders(), body:JSON.stringify({ summaries: inventory, findings: grouping, focus: focusOutcomes }) });
      if (sr.ok) site = await sr.json();
    } catch (err) {
      // A site-level failure must not lose the per-page report that already succeeded.
      site = null;
    }
  }
  showOutput(renderSite(results, meta, failures, false, site), true);
  announce('Scan complete. ' + results.length + ' pages analysed; ' + failures.length + ' failed.'
    + (site && site.findings.length ? ' ' + site.findings.length + ' findings across the site.' : ''));
}
async function scanSite(url, limit) {
  showOutput(loading('Finding pages in your sitemap…', 'We will analyse up to ' + limit + ' pages.'), false);
  const r = await fetch('/api/sitemap?limit=' + limit + '&url=' + encodeURIComponent(url));
  const data = await r.json();
  if (!r.ok) throw new Error(data.error && data.error.message || 'Could not find a usable sitemap.');
  if (!data.urls.length) throw new Error('No pages were found in this sitemap. Try a URL list instead.');
  await analyseList(data.urls, data);
}
/** Findings per module, in the order they should be read. */
function moduleCounts(list) {
  const order = Object.keys(MODULE_LABELS);
  const counts = new Map();
  for (const f of list) counts.set(f.module, (counts.get(f.module) || 0) + 1);
  return order.filter(m => counts.has(m)).map(m => ({ id: m, label: moduleLabel(m), n: counts.get(m) }));
}

function moduleStrip(list) {
  const mods = moduleCounts(list);
  if (!mods.length) return '';
  return '<p class="modstrip">' + mods.map(m =>
    '<span class="modpill"><b>' + m.n + '</b> ' + esc(m.label) + '</span>').join('') + '</p>';
}

function countFindings(findings) {
  const c = { count:findings.length, high:0, medium:0, low:0 };
  findings.forEach(f => c[f.priority]++);
  return c;
}
function summaryCards(c) {
  return '<div class="summary-grid" aria-label="Finding counts">' +
    [['',c.count,'Total findings'],['high',c.high,'Fix first'],['medium',c.medium,'Worth doing'],['low',c.low,'Minor']].map(x =>
    '<div class="metric ' + x[0] + '"><b>' + x[1] + '</b><span>' + x[2] + '</span></div>').join('') + '</div>';
}
/**
 * The speed line. Jev is the fast part of this pipeline — showing the measured figure
 * is more convincing than any animation, and it is a real number from the response
 * rather than a claim.
 */
function speedLine(d) {
  const t = d.timings || {};
  const p = d.provider || {};
  if (!t.totalMs) return '';
  const bits = [];
  if (p.calls) {
    bits.push('<strong>' + p.calls + '</strong> section' + (p.calls === 1 ? '' : 's') +
      ' judged in <strong>' + t.decideMs + ' ms</strong>');
  }
  bits.push('page fetched in ' + Math.max(0, t.totalMs - (t.extractMs || 0) - (t.decideMs || 0)) + ' ms');
  bits.push('read in ' + (t.extractMs || 0) + ' ms');
  return '<p class="speedline">' + bits.join(' · ') + ' · <strong>' +
    (t.totalMs / 1000).toFixed(1) + 's</strong> total' +
    (p.model ? ' · ' + esc(p.model) : '') + '</p>';
}

function reportHeading(title, description, badge) {
  return '<div class="report-top"><div><div class="eyebrow">Your audit report</div><h2>' + esc(title) +
    '</h2><p class="sub">' + esc(description) + '</p>' + (speedHtml || '') + '</div>' +
    '<div class="report-actions"><span class="badge">' + esc(badge) + '</span>' +
    '<div class="exports"><span class="exportl">Save as</span>' +
    '<button type="button" class="exp" data-x="md">Markdown</button>' +
    '<button type="button" class="exp" data-x="html">HTML</button>' +
    '<button type="button" class="exp" data-x="json">JSON</button>' +
    '<button type="button" class="exp" data-x="prompts">All prompts</button>' +
    '</div></div></div>';
}

/**
 * SC-112 — export.
 *
 * Built in the browser from the report already in memory, so it costs no request and
 * works offline once a report is open. The Markdown and HTML forms are written for a
 * person to read; the JSON is the unmodified API response so it stays diffable between
 * runs and usable by other tools.
 */
function exportFilename(ext) {
  const first = exportCtx && exportCtx.reports[0];
  let host = 'report';
  try { host = new URL(first.input.finalUrl).hostname.replace(/^www\\./, ''); } catch (err) {}
  const day = ((first && first.input.fetchedAt) || new Date().toISOString()).slice(0, 10);
  const scope = exportCtx && exportCtx.kind === 'site' ? '-site' : '';
  return 'siteclarity-' + host + scope + '-' + day + '.' + ext;
}

function exportMarkdown() {
  const reports = exportCtx.reports;
  const L = [];
  L.push('# SiteClarity report');
  L.push('');
  if (exportCtx.kind === 'site') {
    L.push('**Pages audited:** ' + reports.length);
    L.push('**Audited:** ' + reports[0].input.fetchedAt);
  } else {
    L.push('**Page:** ' + (reports[0].input.title || reports[0].input.finalUrl));
    L.push('**URL:** ' + reports[0].input.finalUrl);
    L.push('**Audited:** ' + reports[0].input.fetchedAt);
  }
  L.push('');
  L.push('> SiteClarity reports what to improve, never a score. Every quote below is');
  L.push('> word-for-word from the page.');
  L.push('');
  let total = 0;
  reports.forEach(r => {
    if (exportCtx.kind === 'site') {
      L.push('---');
      L.push('');
      L.push('## ' + (r.input.title || r.input.finalUrl));
      L.push('');
      L.push(r.input.finalUrl);
      L.push('');
    }
    L.push(exportCtx.kind === 'site' ? '### What was and was not examined' : '## What was and was not examined');
    L.push('');
    (r.limits.statements || []).forEach(x => L.push('- ' + x));
    L.push('');
    const all = r.findings || [];
    total += all.length;
    L.push(exportCtx.kind === 'site' ? '### Findings (' + all.length + ')' : '## Findings (' + all.length + ')');
    all.forEach((f, i) => {
      L.push('');
      L.push((exportCtx.kind === 'site' ? '#### ' : '### ') + (i + 1) + '. ' + f.observation);
      L.push('');
      L.push('**Priority:** ' + f.priority + ' · **Confidence:** ' + f.confidence);
      L.push('');
      L.push('**Why it matters.** ' + f.whyItMatters);
      L.push('');
      L.push('**What to change.** ' + f.recommendedAction);
      (f.evidence || []).forEach(e => { L.push(''); L.push('> ' + e.quote); });
      if ((f.highlights || []).length) { L.push(''); L.push('Words to replace: ' + f.highlights.join(', ')); }
    });
    if (!all.length) { L.push(''); L.push('Nothing to fix was found on this page.'); }
    L.push('');
  });
  L.push('---');
  L.push('');
  L.push(total + ' finding' + (total === 1 ? '' : 's') + ' · generated by SiteClarity · ' +
    (reports[0].provider.model || 'structural checks only'));
  return L.join('\\n');
}

function exportHtml() {
  const r = exportCtx.reports[0];
  const body = $('out') ? $('out').innerHTML : '';
  const style = document.querySelector('style');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>SiteClarity — ' + esc(r.input.title || r.input.finalUrl) + '</title>' +
    '<style>' + (style ? style.textContent : '') + '</style></head>' +
    '<body><div class="wrap"><h1>SiteClarity report</h1>' +
    '<p class="sub"><a href="' + esc(r.input.finalUrl) + '">' + esc(r.input.finalUrl) + '</a> · ' +
    esc(r.input.fetchedAt) + '</p>' + body + '</div></body></html>';
}

function download(text, filename, mime) {
  try {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (err) { return false; }
}

function handleExport(kind) {
  if (!exportCtx || !exportCtx.reports.length) { announce('Run an audit first.'); return; }
  let text = '', name = '', mime = 'text/plain';
  if (kind === 'md') { text = exportMarkdown(); name = exportFilename('md'); mime = 'text/markdown'; }
  else if (kind === 'json') { text = JSON.stringify(exportCtx.kind === 'site' ? exportCtx.reports : exportCtx.reports[0], null, 2); name = exportFilename('json'); mime = 'application/json'; }
  else if (kind === 'html') { text = exportHtml(); name = exportFilename('html'); mime = 'text/html'; }
  else if (kind === 'prompts') { text = __prompts.join('\\n\\n---\\n\\n'); name = exportFilename('txt'); mime = 'text/plain'; }
  if (!text) { announce('Nothing to export yet.'); return; }
  announce(download(text, name, mime) ? 'Saved ' + name : 'Could not save the file.');
}
function modelNotice(d) {
  if (d.provider.degraded) return '<div class="notice warning"><strong>Partial report · decision model unavailable</strong><p>Static checks are included. Semantic analysis is incomplete; some findings may be missing.</p></div>';
  if (!d.limits.decisionsRan) return '<div class="notice warning"><strong>Limited semantic coverage</strong><p>No section-level decisions were completed. Read the scope below before interpreting these findings.</p></div>';
  return '';
}
function render(d) {
  const c = countFindings(d.findings);
  return reportHeading(d.input.title || 'Page audit', 'Review the highest-priority findings, then open each one for the evidence and next step.', 'Single page') +
    '<p class="page-link">' + pageLink(d.input.finalUrl) + '</p>' + modelNotice(d) + summaryCards(c) +
    moduleStrip(d.findings) + planCard(d.opportunities, 'page') + profileCard(d) +
    coverageCard(d.coverage, 'page') +
    limitsCard(d) + '<div class="section-label"><h2>What to improve</h2><span>Open a finding to see the evidence</span></div>' +
    '<div class="filters" role="group" aria-label="Filter findings by priority">' +
    chip('all','All findings',c.count,true) + chip('high','Fix first',c.high,false) + chip('medium','Worth doing',c.medium,false) + chip('low','Minor',c.low,false) +
    '</div><div id="finding-list">' + findingsBody(d,'all') + '</div>' + techCard(d);
}
function findingsBody(d, filter) {
  const list = d.findings.filter(f => filter === 'all' || f.priority === filter);
  if (!list.length) return '<div class="empty-result"><h3>' + (filter === 'all' ? 'No findings in the checks completed' : 'No ' + label(filter).toLowerCase() + ' findings') +
    '</h3><p>' + (filter === 'all' ? 'This does not guarantee readiness. Review the scope and limitations above.' : 'Choose another priority to continue reviewing this page.') + '</p></div>';
  return renderGroups(list, d.sections);
}
/**
 * Module 5's coverage table.
 *
 * Every question here was written by a person and lives in the repository; the model
 * only decided whether a page answers one. Shown in full rather than as gaps alone,
 * because "you already answer these eleven" is the context that makes the gaps
 * readable — and because a bare list of what you have not written is the "create more
 * content" advice this module exists to replace.
 */
var COVERAGE_AREA_LABELS = {
  understanding: 'Product understanding',
  pricing: 'Pricing',
  suitability: 'Suitability',
  use_cases: 'Use cases',
  implementation: 'Implementation',
  comparison: 'Comparison',
  trust: 'Trust',
  security: 'Security',
  support: 'Support',
  purchase: 'Purchase decisions',
};
var COVERAGE_STATUS = {
  answered: 'Answered',
  unanswered: 'Raised, not answered',
  absent: 'Not addressed',
};

function coverageCard(rows, scope) {
  rows = rows || [];
  if (!rows.length) return '';
  var order = { unanswered: 0, absent: 1, answered: 2 };
  var counts = { answered: 0, unanswered: 0, absent: 0 };
  rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
  var body = rows.slice().sort(function (a, b) {
    return order[a.status] - order[b.status];
  }).map(function (r) {
    // On one page every row is about that page, so naming it on each row is noise.
    var pages = scope !== 'site' || !r.pages.length ? ''
      : r.status === 'unanswered'
        ? '<p class="qpages">Raised on ' + r.pages.length + (r.pages.length === 1 ? ' page' : ' pages') + '</p>'
        : r.status === 'answered'
          ? '<p class="qpages">Answered on ' + pageLink(r.pages[0]) + '</p>'
          : '';
    return '<div class="coverage-row" role="listitem"><div><p class="qtext">' + esc(r.text) + '</p>' +
      '<p class="qarea">' + esc(COVERAGE_AREA_LABELS[r.area] || r.area) + '</p>' + pages + '</div>' +
      '<span class="cstat ' + r.status + '">' + esc(COVERAGE_STATUS[r.status] || r.status) + '</span></div>';
  }).join('');
  var meta = scope === 'site'
    ? counts.answered + ' answered · ' + counts.unanswered + ' left open · ' + counts.absent + ' untouched'
    : counts.answered + ' of ' + rows.length + ' answered here';
  var lead = scope === 'site'
    ? 'A fixed list of questions people ask before choosing. Each was checked against the pages that raise it — nothing here was written by a model.'
    : 'Questions from our question bank that this page brings up. See which ones it answers and which it leaves open.';
  return '<section class="card cvg"><div class="report-section-head"><div><h2>Questions buyers ask</h2>' +
    '<p class="sub">' + lead + '</p></div><span class="section-meta">' + meta + '</span></div>' +
    '<div class="coverage-columns" aria-hidden="true"><span>Question</span><span>Coverage</span></div>' +
    '<div class="coverage-list" role="list" aria-label="Buyer question coverage">' + body + '</div></section>';
}

/**
 * Module 10's plan.
 *
 * A list sorted by severity is not a plan: the same four words appear on nine pages with
 * nothing to say they are one job. Each item here is one piece of work with the number
 * of findings behind it.
 *
 * Deliberately no number attached to an item. A ranked list is exactly the shape that
 * invites "impact 8.4/10", and that number would be invented — the order says only do
 * this before that, which is all the evidence supports.
 */
function planCard(items, scope) {
  items = items || [];
  if (!items.length) return '';
  const body = items.map((o, i) => {
    const where = scope === 'site' && o.pages.length > 1
      ? '<span class="planwhere">' + o.pages.length + ' pages</span>' : '';
    const n = o.fromFindings.length;
    return '<li class="planitem"><span class="plann">' + (i + 1) + '</span>' +
      '<div><p class="plantitle">' + esc(o.title) + '</p>' +
      '<p class="planwhy">' + esc(o.rationale) + '</p>' +
      '<p class="planfrom">From ' + n + (n === 1 ? ' finding' : ' findings') + ' below' + '</p></div>' +
      where + '</li>';
  }).join('');
  return '<section class="card plan"><div class="section-label"><h2>Where to start</h2>' +
    '<span>' + items.length + (items.length === 1 ? ' piece of work' : ' pieces of work') + '</span></div>' +
    '<p class="sub">The findings below, grouped into jobs. In order — not scored.</p>' +
    '<ol class="planlist">' + body + '</ol></section>';
}

/**
 * Which page says each thing you told us the site is about.
 *
 * The page-level version of this answers yes or no, which is the right answer for one
 * page and useless across twenty-five. Here the answer is a location: a statement that
 * lives on exactly one page is worth knowing about as much as one that lives nowhere.
 */
function focusCard(rows) {
  rows = rows || [];
  if (!rows.length) return '';
  const said = rows.filter(r => r.pages.length).length;
  const body = rows.map(r => {
    const on = r.pages.length;
    const where = !on
      ? '<span class="cstat unanswered">No page says it</span>'
      : on === 1
        ? '<span class="cstat answered">1 page</span>'
        : '<span class="cstat answered">' + on + ' pages</span>';
    const links = on
      ? '<p class="qpages">' + r.pages.slice(0, 3).map(pageLink).join(' ') +
        (on > 3 ? ' and ' + (on - 3) + ' more' : '') + '</p>'
      : '<p class="qpages">Checked against ' + r.checked +
        (r.checked === 1 ? ' page' : ' pages') + '.</p>';
    return '<div class="drow"><div><p class="qtext">&ldquo;' + esc(r.text) + '&rdquo;</p>' +
      links + '</div>' + where + '</div>';
  }).join('');
  return '<section class="card profile cvg"><div class="section-label"><h2>What you said it should say</h2>' +
    '<span>' + said + ' of ' + rows.length + ' found</span></div>' +
    '<p class="sub">Your own statements, and which pages communicate them. We never judge whether a statement is true — only whether your pages say it.</p>' +
    body + '</section>';
}

function renderSite(results, sm, failures, partial, site) {
  activeReport = null;
  speedHtml = '';
  exportCtx = { kind: 'site', reports: results, meta: sm };
  const all = results.flatMap(r => r.findings);
  const c = countFindings(all);
  const limited = results.filter(r => r.provider.degraded || !r.limits.decisionsRan).length;
  const rows = results.map(report => {
    const count = countFindings(report.findings);
    return { ...count, total:count.count, report, path:shortPath(report.input.finalUrl) };
  }).sort((a, b) => b.high - a.high || b.total - a.total || a.path.localeCompare(b.path));
  const scope = sm.sitemapUrl
    ? 'Selected ' + sm.urls.length + ' of ' + sm.totalFound + ' sitemap URLs' + (sm.truncated ? ' (page limit reached).' : '.')
    : 'Selected ' + sm.urls.length + ' URLs from your list.';
  const siteStrip = moduleStrip(all);
  /**
   * Findings that only exist across pages, shown above the per-page table because they
   * are about the site rather than about any one row in it. Same group component as
   * everywhere else, so a site finding reads exactly like a page finding.
   */
  const siteBlock = site && site.findings && site.findings.length
    ? '<section class="card sitewide"><div class="section-label"><h2>Across the whole site</h2>' +
      '<span>' + site.findings.length + (site.findings.length === 1 ? ' finding' : ' findings') +
      ' from ' + site.signals.pages + ' pages</span></div>' +
      moduleStrip(site.findings) +
      renderGroups(site.findings, []) +
      '<p class="scope-note">' + site.limits.map(esc).join(' ') + '</p></section>'
    : '';
  let h = reportHeading(results.length + ' pages analysed', failures.length + ' failed · ' + sm.urls.length + ' selected', partial ? 'In progress' : 'Selected pages') +
    '<div class="notice"><strong>Scope of this scan</strong><p>' + esc(scope) + ' These results apply only to successfully analysed pages, not the entire website.</p></div>';
  if (limited) h += '<div class="notice warning"><strong>' + limited + ' pages have limited semantic coverage</strong><p>Static findings are included. Open each page to see its analysis limits.</p></div>';
  if (failures.length) h += '<div class="card err"><h2>' + failures.length + ' pages could not be analysed</h2><ul>' +
    failures.map(f => '<li>' + pageLink(f.url) + '<p>' + esc(f.error && f.error.message || 'Request failed.') + '</p></li>').join('') +
    '</ul><p>Retry these pages with the URL list tab. Successful pages are included below.</p></div>';
  if (!results.length) return h + '<div class="empty-result"><h3>No page reports are available</h3><p>Review the errors above and try again. No conclusion can be drawn about these pages.</p></div>';
  // Site-wide findings come before the table: they are about the site, not about any
  // one row in it.
  h += summaryCards(c) + planCard(site && site.opportunities, 'site') + siteBlock +
    focusCard(site && site.focusCoverage) +
    coverageCard(site && site.coverage, 'site') + '<div class="card tbl-card"><div class="table-title"><h2>Choose a page to work on</h2><p class="sub">Ordered by “Fix first” findings, then total findings. Open a page for its report and scope.</p></div>' +
    '<div class="tscroll" role="region" aria-label="Page reports, scroll horizontally on small screens" tabindex="0"><table class="tbl"><thead><tr>' +
    '<th scope="col">Page</th><th scope="col" class="c-n">Fix first</th><th scope="col" class="c-n">Worth doing</th><th scope="col" class="c-n">Minor</th><th scope="col" class="c-n">Total</th>' +
    '</tr></thead><tbody>' + rows.map(pageRow).join('') + '</tbody></table></div></div>';
  return h;
}
function pageRow(r, i) {
  const d = r.report;
  return '<tr class="prow"><td><button type="button" class="page-toggle" aria-expanded="false" aria-controls="row' + i + '">' +
    '<span><span class="ptitle">' + esc(d.input.title || r.path) + '</span><span class="ppath">' + esc(d.input.finalUrl) + '</span>' +
    (d.provider.degraded || !d.limits.decisionsRan ? '<span class="page-status">Limited semantic coverage</span>' : '') + '</span></button></td>' +
    ['high','medium','low'].map(p => '<td class="c-n"><span class="n ' + (r[p] ? p : 'zero') + '">' + r[p] + '</span></td>').join('') +
    '<td class="c-n"><b>' + r.total + '</b></td></tr><tr class="pbody" id="row' + i + '" hidden><td colspan="5">' +
    '<p>' + pageLink(d.input.finalUrl,'Open source page') + '</p>' + modelNotice(d) + limitsCard(d) + findingsBody(d,'all') + techCard(d) + '</td></tr>';
}
/**
 * Bring-your-own Jev key.
 *
 * Stored in localStorage, NOT a cookie. A cookie is attached automatically to every
 * request the browser makes to this origin — including page loads and asset requests —
 * which puts the key into far more places than it needs to be. localStorage is read
 * only when we choose to send it, on the one request that needs it.
 *
 * The key is sent to this Worker, used for that single request, and never stored
 * server-side. It never leaves the browser otherwise.
 */
const KEY_STORE = 'siteclarity.jevKey';

/**
 * Whether this deployment expects the visitor to supply their own key.
 *
 * Read from a meta tag the Worker stamps at serve time, not probed over the network:
 * it costs no request and is correct on first paint.
 */
let needsKey = false;
let skipKeyOnce = false;

function readNeedsKey() {
  const m = document.querySelector('meta[name="sc-requires-key"]');
  return !!m && m.getAttribute('content') === '1';
}

function loadKey() {
  try { return localStorage.getItem(KEY_STORE) || ''; } catch (err) { return ''; }
}
function saveKey(value) {
  try {
    if (value) localStorage.setItem(KEY_STORE, value); else localStorage.removeItem(KEY_STORE);
    return true;
  } catch (err) { return false; }
}
function promptForKey() {
  const box = $('keybox');
  if (box) { box.open = true; box.classList.toggle('needed', true); }
  showOutput(
    '<div class="card err"><strong>Add your Jev API key to run an audit.</strong>' +
    '<p class="sub">This site keeps no keys of its own, so audits run on your own ' +
    '<a href="https://typesafe.ai" target="_blank" rel="noopener noreferrer">TypeSafe</a> ' +
    'account. Paste your key in the API key box above — it is saved in this browser only.</p>' +
    '<p><button type="button" id="skip-key" class="ghost">Run structure checks only, without a key</button></p></div>',
    true,
  );
  announce('An API key is required before running an audit.');
  const input = $('key-input');
  if (input) input.focus();
}

const SETTINGS_STORE = 'siteclarity.settings';

/**
 * Model settings, stored beside the key and sent as headers with each audit. Nothing
 * is remembered server-side, so two visitors can point the same deployment at
 * different models.
 */
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORE);
    const p = raw ? JSON.parse(raw) : {};
    return { provider: p.provider || 'systemone', server: p.server || '', model: p.model || '' };
  } catch (err) { return { provider: 'systemone', server: '', model: '' }; }
}
function saveSettings(v) {
  try { localStorage.setItem(SETTINGS_STORE, JSON.stringify(v)); return true; } catch (err) { return false; }
}
function isSelfHosted(provider) { return provider === 'systemone-self' || provider === 'laya'; }

/**
 * What the owner says the page is about.
 *
 * The gap between this and what the page says is the most useful thing the product can
 * report, and it is invisible to whoever wrote the page because they already know what
 * they meant.
 */
function readFocus() {
  const el = $('focus');
  if (!el || !el.value) return [];
  return el.value.split(String.fromCharCode(10)).map(t => t.trim()).filter(t => t.length >= 8).slice(0, 3);
}

function analyzeHeaders() {
  const h = { 'content-type': 'application/json' };
  const k = loadKey();
  const s = loadSettings();
  if (k) h['x-jev-key'] = k;
  // 'systemone-self' is a UI distinction only: same wire format as hosted Jev,
  // pointed at a different base URL.
  h['x-sc-backend'] = s.provider === 'laya' ? 'laya' : 'systemone';
  if (isSelfHosted(s.provider) && s.server) h['x-sc-base-url'] = s.server;
  if (s.model) h['x-sc-model'] = s.model;
  return h;
}
function maskKey(k) {
  if (!k) return '';
  return k.length <= 10 ? '•'.repeat(k.length) : k.slice(0, 4) + '•'.repeat(10) + k.slice(-4);
}

const PROVIDER_NOTES = {
  'systemone': 'Runs on TypeSafe\u2019s hosted Jev. Needs your own API key.',
  'systemone-self': 'Kev and Decider speak the same wire format as Jev, so only the server URL changes.',
  'laya': 'Laya is Apache-2.0 and runs on your own hardware. Different endpoint (/ai/run) and a much smaller context, so very long sections may be rejected rather than truncated.',
};

function renderSettingsState() {
  const s = loadSettings();
  const sel = $('provider-select');
  if (!sel) return;
  const row = $('server-row'), note = $('provider-note');
  const server = $('server-input'), model = $('model-input');
  sel.value = s.provider;
  if (row) row.hidden = !isSelfHosted(s.provider);
  if (note) note.textContent = PROVIDER_NOTES[s.provider] || '';
  if (server) server.value = s.server;
  if (model) {
    model.value = s.model;
    model.placeholder = s.provider === 'laya'
      ? 'laya (default) · laya/english · laya/multilingual'
      : 'jev-latest (default)';
  }
}

function renderKeyState() {
  renderSettingsState();
  const k = loadKey();
  const status = $('key-status');
  const input = $('key-input');
  if (!status || !input) return;
  const box = $('keybox');
  if (box) box.classList.toggle('needed', needsKey && !k);
  if (k) {
    status.textContent = 'Saved in this browser: ' + maskKey(k);
    input.value = '';
    input.placeholder = 'Enter a new key to replace it';
  } else {
    status.textContent = needsKey
      ? '— required to run a full audit'
      : 'No key saved. This deployment uses its own configured model.';
    input.placeholder = 'Paste your TypeSafe Jev API key';
  }
}

needsKey = readNeedsKey();
renderKeyState();

function resetPrompts() { __prompts.length = 0; }

function renderGroups(list, sections) {
  const groups = new Map();
  for (const f of [...list].sort((a,b) => priorities[a.priority] - priorities[b.priority])) {
    const key = f.checkId + ':' + f.priority;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return [...groups.values()].map(items => {
    const f = items[0]; const id = 'finding-' + __gid++;
    return '<details class="grp"><summary class="group-summary" aria-controls="' + id + '">' +
      '<div class="group-meta"><span class="tag ' + esc(f.priority) + '">' + label(f.priority) + '</span>' +
      '<span class="modtag">' + esc(moduleLabel(f.module)) + '</span>' +
      '<span class="muted">' + items.length + (items.length === 1 ? ' finding' : ' findings') + '</span></div>' +
      '<h3>' + esc(headline(f,items.length)) + '</h3><p>' + esc(f.whyItMatters) + '</p></summary>' +
      '<div id="' + id + '">' + items.map(it => '<div class="ins"><div class="insh">' + esc(sectionName(it,sections)) +
      ' <span class="muted">· ' + esc(it.confidence) + ' confidence</span></div>' +
      (it.evidence.length ? '<span class="evl">From your page</span>' + it.evidence.map(e =>
        '<blockquote>' + mark(e.quote,it.highlights) + '</blockquote><p class="evidence-ref">Passage ' + esc(e.passageId) +
        (e.sectionId ? ' · Section ' + esc(e.sectionId) : '') + '</p>').join('') :
        '<p class="muted">Page-level structural check. There is no text passage to quote.</p>') +
      '<p class="fix"><span class="fixl">What to change</span>' + esc(it.recommendedAction) + '</p>' +
      '<div class="prompt-row">' + promptButton(it, it._page) +
      '<span class="muted prompt-hint">Paste into an AI agent to fix this</span></div>' +
      '</div>').join('') + '</div></details>';
  }).join('');
}
/**
 * Copy-prompt support.
 *
 * Turns one finding into a self-contained instruction an AI coding agent can act on.
 * Everything in it comes from the audit response — the quote is the verbatim passage,
 * the words are the ones actually matched on the page. The prompt explicitly forbids
 * inventing facts, because the agent receiving it has no more access to the truth than
 * we do.
 */
const __prompts = [];

function buildPrompt(it, pageUrl) {
  const quotes = (it.evidence || []).map(e => e.quote);
  const words = (it.highlights || []);
  const lines = [
    'Fix one issue on this web page: ' + (it._page || pageUrl || ''),
    '',
    'PROBLEM',
    it.observation,
    '',
    'WHY IT MATTERS',
    it.whyItMatters,
    '',
    'WHAT TO CHANGE',
    it.recommendedAction,
  ];
  if (quotes.length) {
    lines.push('', 'EXACT TEXT ON THE PAGE (quote verbatim, do not paraphrase this input)');
    quotes.forEach(q => lines.push('  "' + q + '"'));
  }
  if (words.length) {
    lines.push('', 'WORDS TO REPLACE', '  ' + words.join(', '));
  }
  lines.push(
    '',
    'RULES',
    '- Keep the original meaning. Do not change what the page claims.',
    '- Do not invent numbers, customers, benchmarks or sources.',
    '- If a specific figure is needed and you do not have it, leave [TODO: add figure] in place.',
    '- Rewrite only the text quoted above. Leave the rest of the page alone.',
    '- Return the replacement text only.',
  );
  return lines.join('\\n');
}

async function handleCopyPrompt(btn) {
  const text = btn.dataset.all === '1' ? __prompts.join('\\n\\n---\\n\\n') : __prompts[Number(btn.dataset.p)];
  if (!text) return;
  const ok = await copyText(text);
  const was = btn.textContent;
  btn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
  if (!ok) window.prompt('Copy this prompt:', text);
  announce(ok ? 'Prompt copied to clipboard.' : 'Copy failed. Use the dialog to copy manually.');
  setTimeout(() => { btn.textContent = was; }, 1600);
}

function promptButton(it, pageUrl, cls) {
  const i = __prompts.push(buildPrompt(it, pageUrl)) - 1;
  return '<button type="button" class="' + (cls || 'copy-prompt') + '" data-p="' + i +
    '">Copy prompt</button>';
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) { /* fall through to the textarea path below */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch (err) { return false; }
}


// Highlight text before escaping, so source strings can never become HTML.
function mark(quote, terms) {
  const wanted = (terms || []).filter(Boolean).sort((a,b) => b.length-a.length);
  if (!wanted.length) return esc(quote);
  // NOTE: do NOT escape '-'. This regex carries the 'u' flag (needed for \\p{L}), and
  // under Unicode mode '\\-' is an *invalid escape* that throws at construction. Every
  // hyphenated lexicon term — world-class, cutting-edge, best-in-class — crashed the
  // whole render. '-' is only special inside a character class; this is outside one.
  const escaped = wanted.map(t => t.replace(/[.*+?^$()|[\\]{}\\\\]/g, '\\\\$&'));
  const re = new RegExp('(?<![\\\\p{L}-])(' + escaped.join('|') + ')(?![\\\\p{L}-])','giu');
  let result = ''; let end = 0;
  for (const match of String(quote).matchAll(re)) {
    result += esc(quote.slice(end,match.index)) + '<mark>' + esc(match[0]) + '</mark>';
    end = match.index + match[0].length;
  }
  return result + esc(quote.slice(end));
}
function shortPath(u) { try { const p = new URL(u).pathname; return p === '/' ? '/' : p.replace(/\\/$/,''); } catch { return u; } }
function headline(f,n) {
  if (n === 1) return f.observation;
  const m = f.observation.match(/^[“"](.+)[”"]\\s+(.*)$/);
  return m ? n + ' sections ' + m[2].replace(/^does not/,'do not').replace(/^reads/,'read').replace(/^contains/,'contain').replace(/^holds/,'hold') : f.observation + ' (' + n + ' places)';
}
function sectionName(f,sections) {
  const ref = f.affects && f.affects.find(a => a.sectionId);
  const sectionId = ref && ref.sectionId || f.evidence[0] && f.evidence[0].sectionId;
  const section = (sections || []).find(s => s.sectionId === sectionId);
  if (section && section.heading) return section.heading;
  return sectionId ? 'Section ' + sectionId : 'This page';
}
function label(p) { return p === 'high' ? 'Fix first' : p === 'medium' ? 'Worth doing' : 'Minor'; }
function chip(v,text,n,on) {
  return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-f="' + v + '" aria-pressed="' + on + '">' + esc(text) + '<span>' + n + '</span></button>';
}
function limitsCard(d) {
  return '<section class="card limits"><div class="section-label"><h2>What was and wasn’t examined</h2></div><ul>' +
    d.limits.statements.map(s => '<li>' + esc(s) + '</li>').join('') +
    '<li>Only served HTML is read. JavaScript-rendered content and ranking or citation outcomes are not assessed.</li></ul></section>';
}
function techCard(d) {
  const p = d.provider;
  const passages = d.sections.reduce((n,s) => n + s.passageCount,0);
  return '<details class="card tech"><summary>Analysis details</summary><div class="stats">' +
    stat(d.sections.length,'sections extracted') + stat(passages,'passages extracted') +
    stat(d.timings.totalMs + ' ms','time taken') + stat(p.inputTokens.toLocaleString(),'input tokens') +
    '</div><p>Model: <code>' + esc(p.model || 'Unavailable') + '</code> · ' + p.calls +
    ' calls. Low-confidence decisions are not reported.' +
    (p.degraded ? ' Provider unavailable: ' + esc(p.degradedReason || 'No reason supplied.') : '') +
    '</p><p>Fetched: ' + esc(d.input.fetchedAt) + '</p></details>';
}
function stat(v,text) { return '<div class="stat"><b>' + esc(v) + '</b><span>' + esc(text) + '</span></div>'; }
</script>
</body>
</html>`

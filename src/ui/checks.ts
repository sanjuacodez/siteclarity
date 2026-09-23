import { CHECKS } from '../assemble/checks'
import { QUESTION_CATALOGUE_VERSION } from '../semantic/questions'
import type { Question } from '../provider/types'
import {
  TEMPLATE_GROUPS,
  QUESTION_GROUPS,
  allCheckIds,
  type DocumentedTemplate,
} from '../checks/registry'

// The catalogues remain the source of truth for every documented check and question.
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const priorityLabel = (priority: DocumentedTemplate['priority']) =>
  ({ high: 'Fix first', medium: 'Worth doing', low: 'Minor' })[priority]

const checkName = (id: string) => {
  const words = id.replace(/_/g, ' ').replace(/\b(h1|faq|js)\b/gi, (word) => word.toUpperCase())
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function renderQuestion(id: string, q: Question): string {
  const kind = q.type === 'noul' ? 'Yes / no' : q.type === 'choice' ? 'Multiple choice' : 'Descriptive rubric'
  const options = q.type === 'score'
    ? q.criteria.map((c) => `<li>${esc(c)}</li>`).join('')
    : Object.entries(q.criteria).map(([key, value]) =>
      `<li><code>${esc(key)}</code><span>${esc(value)}</span></li>`).join('')

  return `<details class="question">
    <summary><span>${esc(q.instructions)}</span><span class="kind">${kind}</span></summary>
    <div class="detail-body"><p class="detail-label">Available answers</p>
      <ul class="options">${options}</ul><p class="source">Question: <code>${esc(id)}</code></p>
    </div>
  </details>`
}

function renderTemplate(id: string, template: DocumentedTemplate, source?: string): string {
  return `<details class="check">
    <summary><span>${esc(checkName(id))}</span><span class="tag ${template.priority}">${priorityLabel(template.priority)}</span></summary>
    <div class="detail-body">
      <p class="detail-label">Finding template</p><p class="observation">${esc(template.observation.replace('{label}', 'Section title'))}</p>
      <p class="detail-label">Why it matters</p><p>${esc(template.whyItMatters)}</p>
      <div class="action"><p class="detail-label">Recommended action</p><p>${esc(template.recommendedAction)}</p></div>
      <p class="source">Check: <code>${esc(id)}</code>${source ? ` · ${source}` : ''}</p>
    </div>
  </details>`
}

export function renderChecksPage(): string {
  // Every section, count and nav link comes from src/checks/registry.ts. Adding a module
  // means adding it there and nowhere else; the registry guard fails the suite if a
  // catalogue exists on disk without being registered.
  const totalChecks = allCheckIds().length
  const questions = QUESTION_GROUPS

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="See exactly what SiteClarity checks, how findings are made, and what an audit can and cannot tell you.">
<title>How it works · SiteClarity</title>
<style>
:root{color-scheme:light dark;--bg:#f7f7fa;--surface:#fff;--subtle:#f1f0f6;--border:#e5e4ec;--text:#23212d;--muted:#696575;--accent:#6d4aff;--accent-soft:#f0ecff;--warn:#8a5707;--warn-soft:#fff4df;--bad:#b13e42;--bad-soft:#fff0ef;--radius:18px}
@media(prefers-color-scheme:dark){:root{--bg:#141419;--surface:#1c1c24;--subtle:#23232e;--border:#34333f;--text:#f2f0fa;--muted:#aeabba;--accent:#aa96ff;--accent-soft:#2d2548;--warn:#e6ba70;--warn-soft:#342b1c;--bad:#f0a0a4;--bad-soft:#3a232c}}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--accent);text-underline-offset:3px}a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:5px;border-radius:6px}.skip{position:fixed;top:-100px;left:16px;padding:10px 16px;background:var(--surface);z-index:5}.skip:focus{top:12px}.shell{max-width:1120px;margin:0 auto;padding:0 28px}.topbar{min-height:88px;display:flex;align-items:center;gap:36px;border-bottom:1px solid var(--border)}.brand{display:inline-flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font-size:20px;font-weight:750;letter-spacing:-.6px}.brand-icon{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:var(--accent);color:var(--surface);font-size:20px;font-weight:700}.topnav{display:flex;gap:26px;margin-left:auto}.topnav a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:550;padding:8px 0}.topnav a[aria-current]{color:var(--accent)}.oss{padding:4px 10px;border:1px solid var(--border);border-radius:99px;font-size:11px;font-weight:650;color:var(--muted);white-space:nowrap}.hero{max-width:740px;padding:58px 0 34px}.eyebrow{margin:0 0 12px;font-size:11px;font-weight:750;letter-spacing:.13em;text-transform:uppercase;color:var(--accent)}h1{font-size:clamp(30px,4vw,43px);line-height:1.16;letter-spacing:-1.5px;font-weight:700;margin:0 0 18px}.lede{font-size:17px;line-height:1.7;color:var(--muted);margin:0}.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:34px}.step{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px}.step-num{display:inline-grid;place-items:center;width:30px;height:30px;background:var(--accent-soft);color:var(--accent);border-radius:9px;font-size:12px;font-weight:750}.step h2{font-size:16px;margin:14px 0 7px;letter-spacing:-.2px}.step p{font-size:13px;color:var(--muted);margin:0}.content-layout{display:grid;grid-template-columns:195px minmax(0,1fr);gap:40px;padding:20px 0 72px}.contents{align-self:start;position:sticky;top:24px}.contents p{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin:0 0 12px}.contents a{display:block;padding:8px 12px;color:var(--muted);text-decoration:none;font-size:13px;border-left:2px solid var(--border)}.contents a:hover{color:var(--accent);border-color:var(--accent);background:var(--accent-soft)}section{margin-bottom:42px}section:last-child{margin-bottom:0}.section-heading{display:flex;align-items:center;gap:12px;margin-bottom:9px}.section-heading h2{font-size:23px;line-height:1.3;letter-spacing:-.65px;margin:0}.count{font-size:11px;border:1px solid var(--border);border-radius:99px;padding:2px 9px;color:var(--muted);white-space:nowrap}.section-note{margin:0 0 18px;color:var(--muted);font-size:14px}h3{font-size:14px;letter-spacing:-.15px;margin:25px 0 5px}.scope-note{font-size:13px;color:var(--muted);margin:0 0 12px}.check,.question{background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;overflow:hidden}.check summary,.question summary{display:flex;align-items:center;gap:12px;list-style:none;cursor:pointer;padding:16px 18px;font-size:14px;font-weight:600}.check summary::-webkit-details-marker,.question summary::-webkit-details-marker{display:none}.check summary:after,.question summary:after{content:'+';font-size:20px;line-height:1;color:var(--muted);font-weight:400;margin-left:2px;flex:none}details[open]>summary:after{content:'−'}summary>span:first-child{flex:1}summary:hover{background:var(--subtle)}details[open]>summary{border-bottom:1px solid var(--border)}.tag{font-size:10px;font-weight:650;padding:3px 8px;border-radius:5px;white-space:nowrap}.tag.high{color:var(--bad);background:var(--bad-soft)}.tag.medium{color:var(--warn);background:var(--warn-soft)}.tag.low{color:var(--muted);background:var(--subtle)}.detail-body{padding:20px;font-size:13px}.detail-body p{margin:0 0 15px}.detail-body p:last-child{margin-bottom:0}.detail-body .detail-label{font-size:10px;font-weight:750;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 6px}.observation{font-weight:550}.action{background:var(--accent-soft);border-radius:10px;padding:15px;margin-bottom:16px}.detail-body .source{font-size:11px;color:var(--muted);overflow-wrap:anywhere}code{font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--subtle);padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}.kind{font-size:10px;line-height:1.5;color:var(--muted);font-weight:500;flex:none;max-width:90px}.options{list-style:none;margin:0 0 18px;padding:0}.options li{margin:0;padding:8px 0;border-bottom:1px solid var(--border);color:var(--muted)}.options li:last-child{border-bottom:0}.options code{display:inline-block;margin-right:7px;color:var(--text)}.note{padding:18px 20px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--muted);font-size:13px}.note strong{color:var(--text)}.note p{margin:0 0 8px}.note p:last-child{margin:0}.limitations{margin:0;padding:0;list-style:none}.limitations li{padding:15px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--muted)}.limitations li:first-child{padding-top:0}.limitations strong{display:block;color:var(--text);font-size:14px;margin-bottom:3px}.cta{display:inline-flex;align-items:center;gap:12px;border-radius:10px;background:var(--accent);color:#fff;font-size:13px;font-weight:650;padding:11px 17px;text-decoration:none;margin-top:20px}@media(prefers-color-scheme:dark){.cta{color:#1b1331}}footer{display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--border);padding:22px 0 30px;color:var(--muted);font-size:11px}footer p{margin:0}@media(max-width:760px){.shell{padding:0 20px}.topbar{min-height:76px;gap:18px}.topnav{gap:18px}.oss{display:none}.hero{padding-top:38px}.steps{grid-template-columns:1fr;gap:10px}.step{padding:20px}.step-num{float:left;margin-right:14px}.step h2{margin:2px 0 7px}.step p{margin-left:44px}.content-layout{grid-template-columns:1fr;gap:28px}.contents{position:static;display:flex;gap:8px;flex-wrap:wrap}.contents p{flex-basis:100%;margin-bottom:0}.contents a{border:1px solid var(--border);border-radius:8px;padding:6px 10px}.section-heading h2{font-size:21px}footer{flex-direction:column;gap:5px}}@media(max-width:420px){.shell{padding:0 16px}.brand{font-size:18px}.brand-icon{width:28px;height:28px}.topnav{gap:14px}.topnav a{font-size:12px}.check summary,.question summary{padding:14px;gap:8px;font-size:13px}.kind{max-width:58px}.detail-body{padding:16px}.section-heading{gap:8px}.section-heading h2{font-size:20px}.count{font-size:10px;padding:2px 7px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
.site-header{background:var(--surface);border-bottom:1px solid var(--border)}
.section-heading{flex-wrap:wrap}
.topbar{min-height:78px;border:0;gap:40px}.shell{padding-inline:32px}
.brand{font-size:1.15rem;letter-spacing:-.035em}.brand-icon{width:30px;height:30px;border-radius:9px;color:#fff}.brand-icon svg{width:20px;height:20px}
.topnav{margin-left:0;align-self:stretch;gap:28px}.topnav a{display:flex;align-items:center;border-bottom:2px solid transparent;font-size:.85rem;font-weight:400;padding:2px 0 0}.topnav a[aria-current]{border-bottom-color:var(--accent);font-weight:600}
.oss{margin-left:auto;font-size:.75rem;font-weight:400}.oss::before{content:"";display:inline-block;width:6px;height:6px;background:#267357;border-radius:50%;margin-right:7px}
@media(prefers-color-scheme:dark){.brand-icon{color:#1b1338}.oss::before{background:#8ed4b3}}
@media(max-width:850px){.shell{padding-inline:24px}}
@media(max-width:560px){.shell{padding-inline:18px}.topbar{min-height:67px;gap:22px}.brand{font-size:1rem;gap:7px}.brand-icon{width:27px;height:27px}.topnav{gap:17px}.topnav a{font-size:.77rem}.oss{display:none}}
</style></head><body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="shell topbar"><a class="brand" href="/" aria-label="SiteClarity home"><span class="brand-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M5 12h9M5 17h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="m15 16 2 2 4-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>SiteClarity</a>
    <nav class="topnav" aria-label="Main navigation"><a href="/">Audit</a><a href="/checks" aria-current="page">How it works</a></nav>
    <span class="oss">Open source · MIT</span>
  </div></header>
<div class="shell">
  <main id="main">
    <div class="hero"><p class="eyebrow">Behind the audit</p><h1>Know what’s being checked.</h1>
      <p class="lede">SiteClarity looks at how clearly your content answers a reader’s questions, and how easily those answers can be extracted. Here’s what goes into each finding.</p>
    </div>
    <div class="steps">
      <article class="step"><span class="step-num" aria-hidden="true">01</span><h2>Read the page</h2><p>Fetch the served HTML and separate the main content into sections and passages.</p></article>
      <article class="step"><span class="step-num" aria-hidden="true">02</span><h2>Check the content</h2><p>Apply structure and language rules, then ask the decision model focused questions.</p></article>
      <article class="step"><span class="step-num" aria-hidden="true">03</span><h2>Make findings actionable</h2><p>Pair each observation with a next step and evidence verified against the extracted page.</p></article>
    </div>
    <div class="content-layout">
      <nav class="contents" aria-label="On this page"><p>On this page</p><a href="#modules">Modules</a>${TEMPLATE_GROUPS.map((g) => `<a href="#${g.id}">${esc(g.title)}</a>`).join('')}<a href="#decisions">Content understanding</a><a href="#questions">Model questions</a><a href="#limits">Scope &amp; limitations</a></nav>
      <div>
        <section id="modules"><div class="section-heading"><h2>Modules</h2><span class="count">2 modules</span></div>
<p class="section-note">SiteClarity is planned as ten modules over one shared analysis. Two
are built, and every finding in a report is tagged with the module that produced it.</p>
<details class="check">
<summary><span>Answer readiness</span></summary>
<div class="detail-body"><p>Can a search engine or AI assistant find,
understand and quote the answers on this page? Structured data, heading hierarchy,
extractability, self-containment, promotional density, buried answers.</p></div>
</details>
<details class="check">
<summary><span>Evidence &amp; trust</span></summary>
<div class="detail-body"><p>Does each marketing claim have proof beside
it? Claims and evidence are both located deterministically and the distance between them
is measured. Whether nearby proof is actually <em>about</em> the claim is the one
judgement left to the model.</p></div>
</details>
<p class="scope-note">Planned: messaging, website understanding, question coverage, buyer
journey, audience coverage, product portfolio, content overlap, and an opportunity
roll-up across all of them.</p>
</section>

${TEMPLATE_GROUPS.map((group) => `
        <section id="${group.id}"><div class="section-heading"><h2>${esc(group.title)}</h2><span class="count">${Object.keys(group.templates).length} checks</span></div>
          <p class="section-note">${esc(group.description)}</p>
          ${Object.entries(group.templates).map(([id, template]) => renderTemplate(id, template)).join('')}
        </section>`).join('')}

        <section id="decisions"><div class="section-heading"><h2>Content understanding</h2><span class="count">${CHECKS.length} checks</span></div>
          <p class="section-note">The decision model evaluates clarity and substance. Its typed answers select findings from these templates; it does not write the report copy.</p>
          ${CHECKS.map((check) => renderTemplate(check.id, check, `Question: <code>${esc(check.questionId)}</code>${check.requiresPromissoryHeading ? ' · only for headings that promise a question or topic' : ''}`)).join('')}
          <div class="note"><p><strong>A model judgment still needs review.</strong> Typed answers can be incorrect. Answers below the configured confidence threshold are not reported, and every evidence quote must match an extracted passage.</p><p>Suggestions use predefined actions and words found in the page. SiteClarity identifies what to work on; it leaves the writing to you.</p></div>
        </section>
        <section id="questions"><div class="section-heading"><h2>Questions the model sees</h2></div>
          <p class="section-note">Each question receives the relevant page, section or passage. Expand a question to inspect its available answers. Rubric answers are used internally, never as a page rating.</p>
          ${questions.map((group) => `<h3>${group.title}</h3><p class="scope-note">${group.description}</p>${Object.entries(group.catalogue).map(([id, question]) => renderQuestion(id, question)).join('')}`).join('')}
        </section>
        <section id="limits"><div class="section-heading"><h2>Read the limits with the findings.</h2></div>
          <p class="section-note">An audit is a view of the content examined. Every report includes its scope and any analysis limitations.</p>
          <ul class="limitations">
            <li><strong>A site scan is a sample.</strong> One-page mode examines one URL. Sitemap and URL-list modes examine up to 25 pages; they do not establish complete website coverage.</li>
            <li><strong>The served HTML is what we read.</strong> SiteClarity does not run the page’s JavaScript. Content loaded only in a browser can be missed.</li>
            <li><strong>Some content is excluded.</strong> Navigation and page chrome, detected testimonials and link cards, and sections with too little text are skipped. Exclusions and section limits are disclosed in the report.</li>
            <li><strong>Language and model availability matter.</strong> English-specific rules are skipped for unsupported languages. If the decision model cannot run, the report is labelled as static checks only.</li>
            <li><strong>Findings are suggestions, not a visibility prediction.</strong> SiteClarity does not report an overall score, rank, citation probability, search volume or traffic estimate. Review each finding in the context of your content and audience.</li>
          </ul>
          <a class="cta" href="/">Start an audit <span aria-hidden="true">↗</span></a>
        </section>
      </div>
    </div>
  </main>
  <footer><p>SiteClarity · Open source under MIT</p><p>${totalChecks} catalogue checks · Question catalogue v${esc(QUESTION_CATALOGUE_VERSION)}</p></footer>
</div></body></html>`
}

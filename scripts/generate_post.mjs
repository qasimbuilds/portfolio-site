import fs from "fs";
import path from "path";

const API_KEY = process.env.GEMINI_API_KEY;
const POSTS_DIR = "./blog";
const BLOG_INDEX = "./blog/index.html";
const SITEMAP_FILE = "./sitemap.xml";
const SITE_URL = "https://qasimbuilds.online";

const SEED_TOPICS = [
  {
    title: "How to Fix Orphan Contacts and Deals in HubSpot CRM Without Creating Duplicates",
    keyword: "fix orphan contacts and deals in HubSpot",
    tag: "HUBSPOT HYGIENE",
    relatedProject: { name: "Demanzo — HubSpot CRM Audit", url: "../projects/demanzo.html" }
  },
  {
    title: "How to Build Country-Based Lead Routing Workflows in HubSpot for Global Sales Teams",
    keyword: "HubSpot country based lead routing workflow",
    tag: "LEAD ROUTING & SLA",
    relatedProject: { name: "NovaScale — Lead Routing & Sales SLA", url: "../projects/novascale.html" }
  },
  {
    title: "How to Reactivate Dormant CRM Leads Automatically with n8n, OpenAI, and WhatsApp",
    keyword: "n8n automated lead reactivation workflow",
    tag: "n8n + AI WORKFLOWS",
    relatedProject: { name: "Lazarus Engine", url: "../projects/lazarus-engine.html" }
  },
  {
    title: "HubSpot Lifecycle Stage Audit: Catching Customers With Zero Closed-Won Deals",
    keyword: "HubSpot lifecycle stage audit contradictions",
    tag: "REVOPS AUDIT",
    relatedProject: { name: "Demanzo — HubSpot CRM Audit", url: "../projects/demanzo.html" }
  },
  {
    title: "AI Lead Qualification Architecture: Connecting Webhooks, OpenAI, HubSpot, and Calendly in n8n",
    keyword: "n8n OpenAI HubSpot lead qualification",
    tag: "AI PIPELINES",
    relatedProject: { name: "LeadFlow AI", url: "../projects/leadflow-ai.html" }
  },
  {
    title: "Multi-Channel Outbound Sequencing in n8n: Fallback Logic, Reply Detection, and CRM Sync",
    keyword: "n8n multi channel outreach CRM sync",
    tag: "OUTBOUND SYSTEMS",
    relatedProject: { name: "Multi-Channel Lead Outreach", url: "../projects/multichannel-outreach.html" }
  }
];

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function callGemini(prompt) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini API Error (${res.status}): ${JSON.stringify(data)}`);
  }

  let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  rawText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(rawText);
}

async function run() {
  if (!API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in GitHub Repository Secrets.");
  }
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }

  const existingFiles = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith(".html") && f !== "index.html");

  // Pick next unpublished topic from seed list, or ask Gemini to invent a fresh RevOps/n8n topic
  let item = SEED_TOPICS.find(t => !existingFiles.includes(`${slugify(t.title)}.html`));

  if (!item) {
    const newIdea = await callGemini(
      `Suggest 1 new, specific B2B SEO blog topic for Qasim Shaikh (HubSpot CRM Specialist & n8n Automation Engineer).
Already published slugs: ${existingFiles.join(", ")}.
Return ONLY valid JSON: {"title": "...", "keyword": "...", "tag": "REVOPS & AUTOMATION"}`
    );
    item = {
      title: newIdea.title,
      keyword: newIdea.keyword,
      tag: newIdea.tag || "REVOPS & AUTOMATION",
      relatedProject: { name: "Demanzo — HubSpot CRM Audit", url: "../projects/demanzo.html" }
    };
  }

  const slug = slugify(item.title);
  const today = new Date().toISOString().split("T")[0];

  const prompt = `You are Qasim Shaikh, a Marketing Automation & HubSpot CRM Specialist (portfolio: https://qasimbuilds.online).
Write a practical, step-by-step technical playbook on: "${item.title}".
Target search keyword: "${item.keyword}".
Audience: B2B founders, RevOps managers, and hiring managers looking for a HubSpot & n8n Automation Specialist.

Return ONLY valid JSON with these exact keys:
- "title": SEO-optimized headline (max 68 chars)
- "metaDescription": Compelling meta description (135-155 chars)
- "summary": 2-sentence card summary for the blog index page
- "htmlBody": Clean semantic HTML (900-1200 words) using <h2>, <h3>, <p>, <ul>, <ol>, and <pre><code>. Include exact HubSpot property/filter names or n8n node logic, common pitfalls ("Watch Out"), and concrete verification steps. Do NOT include an <h1> tag.
- "faqs": Array of 3 objects [{"question": "...", "answer": "..."}] answering real buyer questions for AI search citation.`;

  const article = await callGemini(prompt);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": (article.faqs || []).map(f => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": { "@type": "Answer", "text": f.answer }
    }))
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": article.title,
    "description": article.metaDescription,
    "datePublished": today,
    "author": {
      "@type": "Person",
      "name": "Qasim Shaikh",
      "url": "https://qasimbuilds.online/"
    },
    "mainEntityOfPage": `${SITE_URL}/blog/${slug}.html`
  };

  const faqHtml = (article.faqs || []).map(f => `
    <div class="faq-item">
      <h3>${escapeHtml(f.question)}</h3>
      <p>${escapeHtml(f.answer)}</p>
    </div>`).join("");

  const postHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(article.title)} | Qasim Shaikh</title>
<meta name="description" content="${escapeHtml(article.metaDescription)}">
<meta name="author" content="Qasim Shaikh">
<link rel="canonical" href="${SITE_URL}/blog/${slug}.html">
<link rel="icon" type="image/png" href="../Qasim-consultant.png">
<meta property="og:title" content="${escapeHtml(article.title)}">
<meta property="og:description" content="${escapeHtml(article.metaDescription)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE_URL}/blog/${slug}.html">
<script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap');
:root{--bg:#05070b;--panel:#0a0e15;--text:#f4f7fb;--muted:#9aa5b4;--line:rgba(255,255,255,.09);--cyan:#63e6ff;--violet:#a98bff;--green:#69e6a1}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Manrope,system-ui,sans-serif;line-height:1.8}
a{color:var(--cyan);text-decoration:none}a:hover{text-decoration:underline}
.topline{height:2px;background:linear-gradient(90deg,transparent,var(--cyan),var(--violet),transparent)}
nav{position:sticky;top:0;z-index:50;background:rgba(5,7,11,.82);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
.navin{max-width:1100px;margin:auto;padding:0 20px;height:68px;display:flex;align-items:center;justify-content:space-between}
.logo{font:600 15px "DM Mono";color:#fff;letter-spacing:.08em}.logo b{color:var(--cyan)}
.navcta{padding:9px 14px;border:1px solid rgba(99,230,255,.35);border-radius:9px;background:rgba(99,230,255,.07);color:#fff;font-size:13px}
article{max-width:780px;margin:60px auto 90px;padding:0 20px}
.kicker{font:11px "DM Mono";color:var(--cyan);letter-spacing:.12em;text-transform:uppercase}
h1{font:700 clamp(30px,4.5vw,48px) "Space Grotesk";letter-spacing:-.04em;line-height:1.12;margin:14px 0 18px}
.byline{font:11px "DM Mono";color:#7c8899;padding-bottom:24px;border-bottom:1px solid var(--line);margin-bottom:32px}
article h2{font:700 25px "Space Grotesk";margin:38px 0 12px;color:#fff}
article h3{font:600 18px "Space Grotesk";margin:24px 0 8px;color:#dffaff}
article p,article li{color:#b7c1ce;font-size:16px}
article ul,article ol{padding-left:22px}article li{margin-bottom:8px}
pre{background:#090e16;border:1px solid var(--line);border-radius:12px;padding:16px;overflow-x:auto;font:13px "DM Mono";color:#aeefff}
code{font-family:"DM Mono",monospace;color:var(--cyan);font-size:14px}
.faq-box{margin-top:48px;padding:28px;border:1px solid var(--line);border-radius:16px;background:#090d14}
.faq-item{border-top:1px solid var(--line);padding-top:16px;margin-top:16px}.faq-item:first-of-type{border-top:0;padding-top:0;margin-top:12px}
.cta-card{margin-top:48px;padding:30px;border:1px solid rgba(99,230,255,.28);border-radius:18px;background:linear-gradient(145deg,#0b131d,#080b11)}
.cta-card h3{margin-top:0;color:#fff;font-size:22px}
.btns{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}
.btn{padding:12px 16px;border-radius:9px;font-weight:700;font-size:13px;border:1px solid var(--line);background:#0d121a;color:#fff}
.btn.primary{background:#eefbff;color:#061018;border-color:#eefbff}
</style>
</head>
<body>
<div class="topline"></div>
<nav><div class="navin"><a class="logo" href="../"><b>Q</b>ASIM.SHAIKH</a><div style="display:flex;gap:18px;align-items:center"><a href="./" style="font-size:13px;color:#aab4c2">← All Playbooks</a><a class="navcta" href="mailto:skqasim923@gmail.com">Let's talk ↗</a></div></div></nav>
<article>
  <div class="kicker">${escapeHtml(item.tag)} · ${today}</div>
  <h1>${escapeHtml(article.title)}</h1>
  <div class="byline">By Qasim Shaikh · Marketing Automation & HubSpot CRM Specialist · Related build: <a href="${item.relatedProject.url}">${escapeHtml(item.relatedProject.name)} ↗</a></div>
  ${article.htmlBody}
  <section class="faq-box">
    <div class="kicker">Frequently Asked Questions</div>
    ${faqHtml}
  </section>
  <section class="cta-card">
    <h3>Need help implementing this in your CRM or n8n stack?</h3>
    <p>Explore my live architecture breakdown for <a href="${item.relatedProject.url}">${escapeHtml(item.relatedProject.name)}</a> or reach out directly to discuss your HubSpot or workflow automation project.</p>
    <div class="btns">
      <a class="btn primary" href="../#contact">Work with Qasim ↗</a>
      <a class="btn" href="https://wa.me/919403140692?text=Hi%20Qasim%2C%20I%20read%20your%20playbook%20and%20want%20to%20discuss%20an%20automation%20project." target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>
    </div>
  </section>
</article>
</body>
</html>`;

  fs.writeFileSync(path.join(POSTS_DIR, `${slug}.html`), postHtml, "utf8");

  if (fs.existsSync(BLOG_INDEX)) {
    let idx = fs.readFileSync(BLOG_INDEX, "utf8");
    const card = `<!-- POSTS_LIST -->
    <a class="card" href="${slug}.html">
      <div>
        <div class="meta">${escapeHtml(item.tag)} · ${today}</div>
        <h2>${escapeHtml(article.title)}</h2>
        <p>${escapeHtml(article.summary)}</p>
      </div>
      <div class="chips"><span>${escapeHtml(item.keyword)}</span><span>HubSpot</span><span>Automation</span></div>
    </a>`;
    idx = idx.replace("<!-- POSTS_LIST -->", card);
    fs.writeFileSync(BLOG_INDEX, idx, "utf8");
  }

  if (fs.existsSync(SITEMAP_FILE)) {
    let sm = fs.readFileSync(SITEMAP_FILE, "utf8");
    const entry = `  <url><loc>${SITE_URL}/blog/${slug}.html</loc><lastmod>${today}</lastmod><priority>0.7</priority></url>\n</urlset>`;
    sm = sm.replace("</urlset>", entry);
    fs.writeFileSync(SITEMAP_FILE, sm, "utf8");
  }

  console.log(`Successfully published: /blog/${slug}.html`);
}

run();

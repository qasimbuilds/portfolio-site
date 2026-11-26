import fs from "fs";
import path from "path";

const API_KEY = process.env.OPENAI_API_KEY;
const POSTS_DIR = "./blog"; // Folder where your HTML/Markdown posts live
const INDEX_FILE = "./blog/index.html";
const SITEMAP_FILE = "./sitemap.xml";
const SITE_URL = "https://qasimbuilds.online";

// Niche topics aligned with your RevOps, HubSpot, and n8n portfolio
const TOPICS = [
  "How to Fix Orphan Contacts and Deals in HubSpot CRM Without Creating Duplicates",
  "Designing a Country-Based Lead Routing Workflow in HubSpot for Global Sales Teams",
  "Building an Automated Dead-Lead Reactivation Pipeline with n8n and Webhooks",
  "HubSpot Lifecycle Stage Audit: Fixing Customers With Zero Closed-Won Deals",
  "REST API vs Webhooks in CRM Automation: When to Use Which in n8n"
];

async function run() {
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

  // Pick a topic that hasn't been published yet
  const existingFiles = fs.readdirSync(POSTS_DIR);
  const topic = TOPICS.find(t => {
    const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return !existingFiles.includes(`${slug}.html`);
  });

  if (!topic) {
    console.log("All queued topics have been published.");
    return;
  }

  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const today = new Date().toISOString().split("T")[0];

  const prompt = `Write a practical, technical SEO blog post on: "${topic}".
Target audience: B2B founders, RevOps managers, and hiring managers looking for a HubSpot & n8n Automation Specialist.
Return ONLY valid JSON with keys: "title", "metaDescription" (max 155 chars), "primaryKeyword", and "htmlBody" (clean semantic HTML using <h2>, <h3>, <p>, <ul>, <pre><code> tags, 800-1000 words, concrete steps, zero fluff).`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  const article = JSON.parse(data.choices[0].message.content);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${article.title} | Qasim Shaikh</title>
  <meta name="description" content="${article.metaDescription}" />
  <meta name="keywords" content="${article.primaryKeyword}, HubSpot CRM, n8n Automation, RevOps" />
  <link rel="canonical" href="${SITE_URL}/blog/${slug}.html" />
</head>
<body>
  <main style="max-width: 760px; margin: 40px auto; padding: 0 20px; font-family: system-ui, sans-serif; line-height: 1.7;">
    <a href="/">← Back to Portfolio</a>
    <p><small>Published on ${today} • By Qasim Shaikh</small></p>
    <h1>${article.title}</h1>
    ${article.htmlBody}
  </main>
</body>
</html>`;

  fs.writeFileSync(path.join(POSTS_DIR, `${slug}.html`), fullHtml, "utf8");

  // Append URL to sitemap.xml if it exists
  if (fs.existsSync(SITEMAP_FILE)) {
    let sitemap = fs.readFileSync(SITEMAP_FILE, "utf8");
    const urlEntry = `  <url><loc>${SITE_URL}/blog/${slug}.html</loc><lastmod>${today}</lastmod></url>\n</urlset>`;
    sitemap = sitemap.replace("</urlset>", urlEntry);
    fs.writeFileSync(SITEMAP_FILE, sitemap, "utf8");
  }

  console.log(`Published: ${slug}.html`);
}

run();

const express = require("express");
const axios = require("axios");
const iconv = require("iconv-lite");

const app = express();

async function vkRequest(oid) {
  const response = await axios.post(
    "https://vk.com/al_video.php?act=load_videos_silent",
    new URLSearchParams({
      al: "1",
      need_albums: "0",
      offset: "0",
      oid: oid,
      rowlen: "3",
      section: "all",
      snippet_video: "0"
    }).toString(),
    {
      responseType: "arraybuffer",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    }
  );

  let decoded = iconv.decode(Buffer.from(response.data), "windows-1251").trim();
  if (decoded.startsWith("for(;;);")) decoded = decoded.slice(8);
  if (decoded.startsWith("<!--")) decoded = decoded.slice(4);
  if (decoded.endsWith("-->")) decoded = decoded.slice(0, -3);

  return JSON.parse(decoded);
}

// Декодируем HTML сущности
function decodeHTMLEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#(\d+);/g, (m, code) => String.fromCharCode(code))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Экранируем только закрывающий тег CDATA
function escapeCDATA(str) {
  if (!str) return "";
  return str.replace(/\]\]>/g, "]]&gt;");
}

// Экранируем URL (чтобы & превращались в &amp;)
function escapeURL(url) {
  if (!url) return "";
  return url.replace(/&/g, "&amp;");
}

// Вытаскиваем имя автора из html <a ...>Author</a>
function extractAuthor(html) {
  if (!html) return "Unknown";
  const match = html.match(/>([^<]+)<\/a>/);
  return match ? match[1].trim() : "Unknown";
}

function generateRSS(oid, videos, limit = 10) {
  const firstAuthorHtml = videos[0]?.[8] || "";
  const channelTitle = extractAuthor(firstAuthorHtml) || `VK Videos ${oid}`;
  const channelLink = videos[0]?.[39] ? videos[0][39] : `https://vk.com/videos${oid}`;

  const items = videos.slice(0, limit).map(v => {
    const title = v[3];
    const link = "https://vk.com" + v[20];
    const pubDate = new Date(v[9] * 1000).toUTCString();
    const thumb = v[2];

    const cleanTitle = decodeHTMLEntities(title);
    const safeThumb = escapeURL(thumb);

    return `
      <item>
        <title><![CDATA[${escapeCDATA(cleanTitle)}]]></title>
        <link>${link}</link>
        <pubDate>${pubDate}</pubDate>
        <description><![CDATA[<img src="${safeThumb}" alt="thumbnail"/>]]></description>
        <guid isPermaLink="false">${oid}_${v[1]}</guid>
      </item>
    `;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>${channelTitle}</title>
      <link>${channelLink}</link>
      <description>RSS feed for VK videos</description>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      ${items}
    </channel>
  </rss>`;
}

app.get("/rss", async (req, res) => {
  const oid = req.query.oid;
  const limit = parseInt(req.query.limit) || 10;

  if (!oid) return res.status(400).send("Missing oid");

  try {
    const json = await vkRequest(oid);
    const list = json.payload?.[1]?.[0]?.all?.list;
    if (!list) return res.status(500).send("No videos found");

    const rss = generateRSS(oid, list, limit);
    res.set("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(rss);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching videos");
  }
});

app.listen(3000, () => console.log("RSS server running on http://localhost:3000"));

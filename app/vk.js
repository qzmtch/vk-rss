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

function generateRSS(oid, videos, limit = 10) {
  const items = videos.slice(0, limit).map(v => {
    const title = v[3];
    const link = "https://vk.com" + v[20];
    const pubDate = new Date(v[9] * 1000).toUTCString();
    const thumb = v[2];
// Декодируем HTML сущности
function decodeHTMLEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#(\d+);/g, (m, code) => String.fromCharCode(code)) // &#123;
    .replace(/&#x([0-9a-fA-F]+);/g, (m, code) => String.fromCharCode(parseInt(code, 16))) // &#x1F60D;
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Экранируем уже нормальный текст для XML (без удвоений)
function escapeXML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Если используем CDATA, то экранируем только закрывающий тег
function escapeCDATA(str) {
  if (!str) return "";
  return str.replace(/\]\]>/g, "]]&gt;");
}
const cleanTitle = decodeHTMLEntities(title);
    return `
      <item>
        <title><![CDATA[${escapeCDATA(cleanTitle)}]]></title>
        <link>${link}</link>
        <pubDate>${pubDate}</pubDate>
        <enclosure url="${thumb}" type="image/jpeg"/>
        <guid isPermaLink="false">${oid}_${v[1]}</guid>
      </item>
    `;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>VK Videos ${oid}</title>
      <link>https://vk.com/videos${oid}</link>
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

export default async function handler(req, res) {
  const url = 'https://vk.com/al_video.php?act=load_videos_silent';
  const body = new URLSearchParams({
    al: '1', need_albums: '0', offset: '0',
    oid: '-51890028', rowlen: '3', section: 'all', snippet_video: '0'
  }).toString();

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Origin': 'https://vk.com',
    'Referer': 'https://vk.com/videos-51890028',
    'X-Requested-With': 'XMLHttpRequest',
    ...(process.env.VK_COOKIE ? { Cookie: process.env.VK_COOKIE } : {}),
  };

  const r = await fetch(url, { method: 'POST', headers, body });
  const text = await r.text();
  console.log('Upstream status:', r.status);
  res
    .status(r.status)
    .setHeader('Content-Type', r.headers.get('content-type') || 'text/plain; charset=utf-8')
    .send(text);
}

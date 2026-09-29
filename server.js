// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files from project root
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Root route sends index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// TikTok User Lookup API
app.get('/api/tiktok-user/:username', async (req, res) => {
  const username = req.params.username.trim().replace(/^@/, '');

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username is required' });
  }

  try {
    // 1. TikTok oEmbed endpoint verifies if the account exists
    const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${encodeURIComponent(username)}`;
    const oembedRes = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!oembedRes.ok) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const oembedData = await oembedRes.json();
    let nickname = oembedData.author_name || username;
    let avatarUrl = oembedData.thumbnail_url || '';
    let verified = false;

    // 2. Fetch OpenGraph meta tags via social crawler header to get high-res avatar
    try {
      const pageRes = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.html)'
        }
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        const imgMatch = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
        if (imgMatch && imgMatch[1]) {
          avatarUrl = imgMatch[1].replace(/&amp;/g, '&');
        }
        if (html.includes('"verified":true') || html.includes('"isVerified":true')) {
          verified = true;
        }
      }
    } catch (crawlErr) {
      console.warn('Crawler avatar fetch warning:', crawlErr.message);
    }

    // Fallback avatar if none found
    if (!avatarUrl) {
      avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname)}&background=FE2C55&color=fff`;
    }

    return res.json({
      success: true,
      username: username,
      nickname: nickname,
      avatar: avatarUrl,
      verified: verified
    });
  } catch (error) {
    console.error('TikTok Fetch Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch TikTok user details.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` TikTok Recharge App is running!`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
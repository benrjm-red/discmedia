const { Client } = require('discord.js-selfbot-v13');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, '..', 'data', 'media');
const INDEX_FILE = path.join(MEDIA_DIR, 'index.json');

function ensureMediaDir() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify([]));
  }
}

function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveIndex(index) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

async function downloadAttachment(url, filename) {
  const dest = path.join(MEDIA_DIR, filename);
  const response = await axios.get(url, { responseType: 'stream' });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(dest);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v']);

function isMediaAttachment(attachment) {
  // Check content-type first, fall back to file extension
  const ct = attachment.contentType || '';
  if (ct.startsWith('image/') || ct.startsWith('video/')) return true;
  const ext = path.extname(attachment.name || '').toLowerCase();
  return IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext);
}

function guessContentType(attachment) {
  if (attachment.contentType) return attachment.contentType;
  const ext = path.extname(attachment.name || '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image/' + (ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1));
  if (VIDEO_EXTS.has(ext)) return 'video/' + ext.slice(1);
  return 'application/octet-stream';
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function startBot() {
  ensureMediaDir();

  const client = new Client({ checkUpdate: false });

  client.on('ready', () => {
    console.log(`[bot] Logged in as ${client.user.tag}`);
  });

  client.on('messageCreate', async (message) => {
    // Only process DMs
    if (message.channel.type !== 'DM') return;

    console.log(`[bot] DM from ${message.author.tag} — ${message.attachments.size} attachment(s)`);

    if (message.attachments.size === 0) return;

    // Log attachment details to help debug
    for (const a of message.attachments.values()) {
      console.log(`[bot]   attachment: ${a.name} | contentType: ${a.contentType} | url: ${a.url}`);
    }

    const mediaAttachments = [...message.attachments.values()].filter(isMediaAttachment);
    if (mediaAttachments.length === 0) {
      console.log('[bot]   no media attachments matched (wrong type/extension)');
      return;
    }

    const index = loadIndex();

    for (const attachment of mediaAttachments) {
      const timestamp = Date.now();
      const safe = sanitizeFilename(attachment.name || 'file');
      const filename = `${timestamp}_${safe}`;

      try {
        await downloadAttachment(attachment.url, filename);
        const entry = {
          filename,
          originalName: attachment.name,
          contentType: guessContentType(attachment),
          sender: message.author.tag,
          senderId: message.author.id,
          timestamp: new Date().toISOString(),
          messageId: message.id,
        };
        index.unshift(entry); // newest first
        saveIndex(index);
        console.log(`[bot] Saved: ${filename} from ${message.author.tag}`);
      } catch (err) {
        console.error(`[bot] Failed to download ${attachment.name}:`, err.message);
      }
    }
  });

  client.login(process.env.DISCORD_TOKEN);

  return client;
}

module.exports = { startBot };

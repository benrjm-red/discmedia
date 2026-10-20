const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, '..', 'data', 'media');
const INDEX_FILE = path.join(MEDIA_DIR, 'index.json');
const VIEWS_DIR = path.join(__dirname, '..', 'views');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
}

function createServer() {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(PUBLIC_DIR));

  app.use(session({
    secret: process.env.SESSION_SECRET || 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
  }));

  // Login
  app.get('/login', (req, res) => {
    if (req.session && req.session.authenticated) return res.redirect('/');
    res.sendFile(path.join(VIEWS_DIR, 'login.html'));
  });

  app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.SITE_PASSWORD) {
      req.session.authenticated = true;
      return res.redirect('/');
    }
    res.redirect('/login?error=1');
  });

  app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
  });

  // Serve media files
  app.get('/media/:filename', requireAuth, (req, res) => {
    const filename = path.basename(req.params.filename);
    const filepath = path.join(MEDIA_DIR, filename);
    if (!fs.existsSync(filepath)) return res.status(404).send('Not found');
    res.sendFile(filepath);
  });

  // Gallery
  app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(VIEWS_DIR, 'gallery.html'));
  });

  // JSON API for the gallery to fetch items
  app.get('/api/items', requireAuth, (req, res) => {
    res.json(loadIndex());
  });

  return app;
}

module.exports = { createServer };

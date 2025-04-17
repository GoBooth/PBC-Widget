const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const BACKDROPS_FILE = path.join(DATA_DIR, 'backdrops.json');
// Path to user-uploaded/backdrop images in public folder
const PHOTOS_DIR = path.join(__dirname, 'public', 'Backdrop_photos');

function loadJSON(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Expose app version to all views for display
const { version } = require('./package.json');
app.locals.version = version;
app.use(express.static(path.join(__dirname, 'public')));

// Expose currentUser to all views
app.use((req, res, next) => {
  const users = loadJSON(USERS_FILE);
  const user = users.find(u => u.id === req.session.userId);
  res.locals.currentUser = user || null;
  next();
});

// Public homepage
app.get('/', (req, res) => {
  res.render('index');
});

// Auth routes
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadJSON(USERS_FILE);
  const user = users.find(u => u.email === email);
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user.id;
    return res.redirect('/dashboard/widget');
  }
  res.render('login', { error: 'Invalid email or password' });
});

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', async (req, res) => {
  const { businessName, username, email, password } = req.body;
  const users = loadJSON(USERS_FILE);
  if (users.find(u => u.email === email)) {
    return res.render('register', { error: 'Email already registered' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    businessName,
    username,
    email,
    password: hashed,
    apiKey: uuidv4(),
    selectedBackdrops: [],
    isAdmin: false,
  };
  users.push(newUser);
  saveJSON(USERS_FILE, users);
  req.session.userId = newUser.id;
  res.redirect('/dashboard/widget');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Auth middleware
function ensureAuth(req, res, next) {
  if (res.locals.currentUser) return next();
  res.redirect('/login');
}

// Dashboard
app.get('/dashboard', ensureAuth, (req, res) => res.redirect('/dashboard/widget'));

// Widget page
app.get('/dashboard/widget', ensureAuth, (req, res) => {
  // Construct the embed URL for the iframe widget
  const host = req.get('host');
  const embedUrl = `${req.protocol}://${host}/embed/v1/${res.locals.currentUser.apiKey}`;
  res.render('dashboard/widget', { activeTab: 'widget', embedUrl });
});

// Backdrops (dynamically scan public/Backdrop_photos)
app.get('/dashboard/backdrops', ensureAuth, (req, res) => {
  let backdrops = [];
  if (fs.existsSync(PHOTOS_DIR)) {
    backdrops = fs.readdirSync(PHOTOS_DIR)
      .filter(file => /\.(jpe?g|png|gif)$/i.test(file))
      .map(file => ({ id: file, url: `/Backdrop_photos/${file}` }));
  }
  const selected = res.locals.currentUser.selectedBackdrops || [];
  res.render('dashboard/backdrops', { activeTab: 'backdrops', backdrops, selectedBackdrops: selected });
});
app.post('/dashboard/backdrops', ensureAuth, (req, res) => {
  const selected = req.body.selected || [];
  const users = loadJSON(USERS_FILE);
  const idx = users.findIndex(u => u.id === res.locals.currentUser.id);
  users[idx].selectedBackdrops = Array.isArray(selected) ? selected : [selected];
  saveJSON(USERS_FILE, users);
  res.redirect('/dashboard/backdrops');
});

// Account
app.get('/dashboard/account', ensureAuth, (req, res) => {
  res.render('dashboard/account', { activeTab: 'account', message: null });
});
app.post('/dashboard/account', ensureAuth, async (req, res) => {
  const { businessName, username, email, password, confirmPassword } = req.body;
  const users = loadJSON(USERS_FILE);
  const idx = users.findIndex(u => u.id === res.locals.currentUser.id);
  if (password) {
    if (password !== confirmPassword) {
      return res.render('dashboard/account', { activeTab: 'account', message: 'Passwords do not match' });
    }
    users[idx].password = await bcrypt.hash(password, 10);
  }
  users[idx].businessName = businessName;
  users[idx].username = username;
  users[idx].email = email;
  saveJSON(USERS_FILE, users);
  res.render('dashboard/account', { activeTab: 'account', message: 'Account updated' });
});

// Help
app.get('/dashboard/help', ensureAuth, (req, res) => {
  res.render('dashboard/help', { activeTab: 'help' });
});

// Admin
// Admin: manage files in public/Backdrop_photos
app.get('/dashboard/admin', ensureAuth, (req, res) => {
  if (!res.locals.currentUser.isAdmin) return res.redirect('/dashboard/widget');
  let backdrops = [];
  if (fs.existsSync(PHOTOS_DIR)) {
    backdrops = fs.readdirSync(PHOTOS_DIR)
      .filter(file => /\.(jpe?g|png|gif)$/i.test(file))
      .map(file => ({ id: file, url: `/Backdrop_photos/${file}` }));
  }
  res.render('dashboard/admin', { activeTab: 'admin', backdrops });
});
// Delete a backdrop file
app.post('/dashboard/admin/delete', ensureAuth, (req, res) => {
  if (!res.locals.currentUser.isAdmin) return res.redirect('/dashboard/widget');
  const { id } = req.body;
  const filePath = path.join(PHOTOS_DIR, id);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.redirect('/dashboard/admin');
});

// 404 handler
// Embed widget route (public-facing)
app.get('/embed/v1/:apiKey', (req, res) => {
  const apiKey = req.params.apiKey;
  const users = loadJSON(USERS_FILE);
  const user = users.find(u => u.apiKey === apiKey);
  if (!user) return res.status(404).send('Invalid API key');
  // Collect selected backdrops or all if none selected
  let files = [];
  if (fs.existsSync(PHOTOS_DIR)) {
    files = fs.readdirSync(PHOTOS_DIR)
      .filter(f => /\.(jpe?g|png|gif)$/i.test(f));
    if (user.selectedBackdrops && user.selectedBackdrops.length) {
      files = files.filter(f => user.selectedBackdrops.includes(f));
    }
  }
  // Prepare backdrops with URL and display name
  const backdrops = files.map(f => ({
    url: encodeURI(`/Backdrop_photos/${f}`),
    name: f.replace(/\.[^/.]+$/, '')
  }));
  // Derive simple categories (first word of name) for filtering
  const categories = [...new Set(backdrops.map(b => b.name.split(' ')[0]))].sort();
  res.render('embed', { backdrops, categories });
});
// 404 handler
app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
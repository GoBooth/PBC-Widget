const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
// Email sending for backdrop selection (configure via env vars SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');
// (Unused) const BACKDROPS_FILE = path.join(DATA_DIR, 'backdrops.json');
// Path to user-uploaded/backdrop images in public folder
const PHOTOS_DIR = path.join(__dirname, 'public', 'Backdrop_photos');

function loadJSON(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

// Load analytics data (views, selections) per API key
function loadAnalytics() {
  if (!fs.existsSync(ANALYTICS_FILE)) return {};
  return JSON.parse(fs.readFileSync(ANALYTICS_FILE));
}

function saveAnalytics(data) {
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
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
// Widget page
app.get('/dashboard/widget', ensureAuth, (req, res) => {
  const host = req.get('host');
  // Load user widget options (default to showing controls)
  const defaultOpts = {
    search: true,
    sort: true,
    category: true,
    showAll: false,
    customCss: '',
    backgroundColor: '',
    captionBgColor: '',
    captionFontFamily: '',
    captionFontColor: '',
    selectionTitle: 'Couldn\'t have chosen better!',
    selectionDescription: 'Please provide your email, then select “Submit” to complete.',
    submitButtonText: 'Submit',
    thankYouMessage: 'Your backdrop choice is confirmed—thank you!'
  };
  const opts = Object.assign({}, defaultOpts, res.locals.currentUser.widgetOptions || {});
  // Build embed URL with query flags for controls
  const baseUrl = `${req.protocol}://${host}/embed/v1/${res.locals.currentUser.apiKey}`;
  const params = [];
  if (opts.search)    params.push('search=1');     else params.push('search=0');
  if (opts.sort)      params.push('sort=1');       else params.push('sort=0');
  if (opts.category)  params.push('category=1');   else params.push('category=0');
  if (opts.backgroundColor) params.push(`bgColor=${encodeURIComponent(opts.backgroundColor)}`);
  if (opts.showAll) params.push('forceall=1');
  const embedUrl = `${baseUrl}?${params.join('&')}`;
  res.render('dashboard/widget', { activeTab: 'widget', embedUrl, widgetOpts: opts });
});
// Regenerate API key
// Save widget display options
app.post('/dashboard/widget', ensureAuth, (req, res) => {
  const { search, sort, category, showAll, customCss, backgroundColor, captionBgColor, captionFontFamily, captionFontColor,
          selectionTitle, selectionDescription, submitButtonText, thankYouMessage } = req.body;
  const users = loadJSON(USERS_FILE);
  const idx = users.findIndex(u => u.id === res.locals.currentUser.id);
  if (idx !== -1) {
    users[idx].widgetOptions = {
      search: !!search,
      sort: !!sort,
      category: !!category,
      showAll: !!showAll,
      customCss: customCss || '',
      backgroundColor: backgroundColor || '',
      captionBgColor: captionBgColor || '',
      captionFontFamily: captionFontFamily || '',
      captionFontColor: captionFontColor || '',
      selectionTitle: selectionTitle || '',
      selectionDescription: selectionDescription || '',
      submitButtonText: submitButtonText || '',
      thankYouMessage: thankYouMessage || ''
    };
    saveJSON(USERS_FILE, users);
  }
  res.redirect('/dashboard/widget');
});
// Regenerate API key
app.post('/dashboard/widget/regenerate', ensureAuth, (req, res) => {
  const users = loadJSON(USERS_FILE);
  const idx = users.findIndex(u => u.id === res.locals.currentUser.id);
  if (idx !== -1) {
    users[idx].apiKey = uuidv4();
    saveJSON(USERS_FILE, users);
  }
  res.redirect('/dashboard/widget');
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
  const overrideNames = res.locals.currentUser.backdropNames || {};
  res.render('dashboard/backdrops', { activeTab: 'backdrops', backdrops, selectedBackdrops: selected, overrideNames });
});
app.post('/dashboard/backdrops', ensureAuth, (req, res) => {
  const selected = req.body.selected || [];
  const users = loadJSON(USERS_FILE);
  const idx = users.findIndex(u => u.id === res.locals.currentUser.id);
  users[idx].selectedBackdrops = Array.isArray(selected) ? selected : [selected];
  // Save custom override names
  const overrideNames = req.body.overrideNames || {};
  users[idx].backdropNames = overrideNames;
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
// Analytics
app.get('/dashboard/analytics', ensureAuth, (req, res) => {
  // Load per-API-key analytics
  let stats = {};
  try { stats = loadAnalytics(); } catch (e) { console.error('Analytics load error:', e); }
  const userKey = res.locals.currentUser.apiKey;
  const data = stats[userKey] || { views: 0 };
  res.render('dashboard/analytics', { activeTab: 'analytics', stats: data });
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
    // If not forcing all, apply user's selectedBackdrops filter
    if (!(user.widgetOptions && user.widgetOptions.showAll) && user.selectedBackdrops && user.selectedBackdrops.length) {
      files = files.filter(f => user.selectedBackdrops.includes(f));
    }
  }
  // Prepare backdrops with URL and display name (apply any user overrides)
  const overrideNames = (user.backdropNames && typeof user.backdropNames === 'object') ? user.backdropNames : {};
  const backdrops = files.map(f => {
    const defaultName = f.replace(/\.[^/.]+$/, '');
    return {
      url: encodeURI(`/Backdrop_photos/${f}`),
      name: overrideNames[f] || defaultName
    };
  });
  // Derive simple categories (first word of name) for filtering
  const categories = [...new Set(backdrops.map(b => b.name.split(' ')[0]))].sort();
  // Get widget options from user, with defaults
  const defaultOpts = {
    search: true,
    sort: true,
    category: true,
    showAll: false,
    customCss: '',
    backgroundColor: '',
    captionBgColor: '',
    captionFontFamily: '',
    captionFontColor: '',
    allowEmail: false,
    selectionTitle: "Couldn't have chosen better!",
    selectionDescription: 'Please provide your email, then select “Submit” to complete.',
    submitButtonText: 'Submit',
    thankYouMessage: 'Your backdrop choice is confirmed—thank you!'
  };
  const widgetOpts = Object.assign({}, defaultOpts, user.widgetOptions || {});
  // Allow override of background color via query param
  if (req.query.bgColor) {
    widgetOpts.backgroundColor = req.query.bgColor;
  }
  // Allow override of caption styling via query params
  if (req.query.captionBgColor) {
    widgetOpts.captionBgColor = req.query.captionBgColor;
  }
  if (req.query.captionFontColor) {
    widgetOpts.captionFontColor = req.query.captionFontColor;
  }
  if (req.query.captionFontFamily) {
    widgetOpts.captionFontFamily = req.query.captionFontFamily;
  }
  // Allow override of email selection options via query params
  if (req.query.allowEmail === '1') widgetOpts.allowEmail = true;
  if (req.query.allowEmail === '0') widgetOpts.allowEmail = false;
  if (req.query.selectionTitle) widgetOpts.selectionTitle = req.query.selectionTitle;
  if (req.query.selectionDescription) widgetOpts.selectionDescription = req.query.selectionDescription;
  if (req.query.submitButtonText) widgetOpts.submitButtonText = req.query.submitButtonText;
  if (req.query.thankYouMessage) widgetOpts.thankYouMessage = req.query.thankYouMessage;
  // Track analytics: count views for this API key
  try {
    const analytics = loadAnalytics();
    analytics[apiKey] = analytics[apiKey] || { views: 0 };
    analytics[apiKey].views++;
    saveAnalytics(analytics);
  } catch (e) {
    console.error('Analytics update error:', e);
  }
  res.render('embed', { backdrops, categories, widgetOpts, apiKey });
});
// Handle backdrop selection submissions from embed widget
app.post('/embed/v1/:apiKey/selection', express.json(), (req, res) => {
  const apiKey = req.params.apiKey;
  const users = loadJSON(USERS_FILE);
  const user = users.find(u => u.apiKey === apiKey);
  if (!user) return res.status(404).json({ success: false, error: 'Invalid API key' });
  const { backdropUrl, backdropName, name, email } = req.body;
  // Send email to the widget owner
  const mailOptions = {
    from: process.env.SMTP_FROM || 'no-reply@example.com',
    to: user.email,
    subject: `Backdrop selection from ${email || 'unknown'}`,
    text: `Backdrop: ${backdropName}\nURL: ${backdropUrl}\nName: ${name || 'N/A'}\nEmail: ${email || 'N/A'}`
  };
  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Selection email error:', err);
      return res.status(500).json({ success: false, error: 'Failed to send email' });
    }
    res.json({ success: true });
  });
});
// 404 handler
app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
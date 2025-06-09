const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');
const dataFile = path.join(__dirname, 'data', 'data.json');

function loadData() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ places: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dataFile));
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function send(res, status, data, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
}

function serveStatic(req, res) {
  const filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'text/plain';
    send(res, 200, fs.readFileSync(filePath), type);
    return true;
  }
  return false;
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = parse(req.url, true);
  if (serveStatic(req, res)) return;
  if (url.pathname === '/api/places' && req.method === 'GET') {
    const data = loadData();
    send(res, 200, data);
    return;
  }
  if (url.pathname === '/api/places' && req.method === 'POST') {
    const body = await parseBody(req);
    const data = loadData();
    const id = Date.now();
    data.places.push({ id, name: body.name, description: body.description, comments: [], photos: [] });
    saveData(data);
    send(res, 201, { id });
    return;
  }
  const placeMatch = url.pathname.match(/^\/api\/places\/(\d+)(?:\/(comments|photos))?/);
  if (placeMatch) {
    const id = parseInt(placeMatch[1]);
    const action = placeMatch[2];
    const data = loadData();
    const place = data.places.find(p => p.id === id);
    if (!place) { send(res, 404, { error: 'Not found' }); return; }
    if (req.method === 'POST' && action === 'comments') {
      const body = await parseBody(req);
      place.comments.push(body.text);
      saveData(data);
      send(res, 201, { ok: true });
      return;
    }
    if (req.method === 'POST' && action === 'photos') {
      const body = await parseBody(req);
      place.photos.push(body.data);
      saveData(data);
      send(res, 201, { ok: true });
      return;
    }
  }
  send(res, 404, { error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running on port ' + PORT));

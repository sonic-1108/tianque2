// A local stand-in for the room relay (relay/src/index.js), for headless 联机 tests:
//   node tools/relay-local.mjs [port]      then open the game with ?relay=ws://localhost:<port>
// The host's messages go to every guest of the room, a guest's to the host.
import { WebSocketServer } from 'ws';
const port = +(process.argv[2] || 8787);
const rooms = new Map();
const wss = new WebSocketServer({ port });
wss.on('connection', (ws, req) => {
  const u = new URL(req.url, 'http://x');
  const m = u.pathname.match(/^\/r\/([A-Za-z0-9_-]{3,24})$/);
  if (!m) return ws.close();
  const room = m[1].toUpperCase(), side = u.searchParams.get('side') === 'h' ? 'h' : 'g';
  if (!rooms.has(room)) rooms.set(room, new Set());
  const R = rooms.get(room);
  const me = { ws, side };
  R.add(me);
  ws.on('message', (data) => {
    const s = data.toString();
    if (s.startsWith('{"t":"echo"')) return ws.send(s);
    for (const o of R) if (o.side !== side && o.ws.readyState === 1) o.ws.send(s);
  });
  ws.on('close', () => R.delete(me));
});
console.log('relay on', port);

// The room relay (联机): a WebSocket to the Cloudflare worker in relay/ (deployed with the site when the repo has the
// Cloudflare secrets: its address is baked in as VITE_T2_RELAY), else 天阙 1's relay, which forwards the same way.
// ?relay=ws://... in the address overrides it (a local relay for tests: tools/relay-local.mjs).
export interface Relay {
  send(m: unknown): void;
  close(): void;
}
const fromUrl = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('relay') : null;
export const RELAY_URL: string = fromUrl || (import.meta as any).env?.VITE_T2_RELAY || 'wss://tianque-relay.msjzxy2022.workers.dev';

export function openRelay(room: string, side: 'h' | 'g', onMsg: (m: any) => void, onState: (s: string) => void): Relay {
  let ws: WebSocket | null = null;
  let closed = false;
  let tries = 0;
  const queue: string[] = [];
  const open = () => {
    try {
      ws = new WebSocket(`${RELAY_URL}/r/${room}?side=${side}`);
    } catch {
      onState('连不上联机服务器');
      return;
    }
    ws.onopen = () => {
      tries = 0;
      onState('open');
      for (const q of queue.splice(0)) ws!.send(q);
    };
    ws.onmessage = (e) => {
      try {
        onMsg(JSON.parse(typeof e.data === 'string' ? e.data : ''));
      } catch {
        /* not ours */
      }
    };
    ws.onclose = () => {
      if (closed) return;
      // the network blinked: try again a few times
      if (++tries <= 5) {
        onState(`连接断了，重连中（${tries}）……`);
        setTimeout(open, 800 * tries);
      } else onState('连不上联机服务器');
    };
    ws.onerror = () => {};
  };
  open();
  return {
    send(m) {
      const s = JSON.stringify(m);
      if (ws && ws.readyState === 1) ws.send(s);
      else if (queue.length < 20) queue.push(s);
    },
    close() {
      closed = true;
      try {
        ws?.close();
      } catch {
        /* gone */
      }
    },
  };
}

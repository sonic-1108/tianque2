// The server (relay/: 联机 rooms, and the hub: accounts, cloud saves, the big 江湖): tianque2's own Cloudflare worker,
// deployed from sonic-1108/tianque-assets (its `t2 relay` workflow, where the Cloudflare secrets are). VITE_T2_RELAY
// overrides it at build time; ?relay=ws://... in the address at run time (a local `wrangler dev` for tests).
export interface Relay {
  send(m: unknown): void;
  close(): void;
}
const fromUrl = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('relay') : null;
export const RELAY_URL: string = fromUrl || (import.meta as any).env?.VITE_T2_RELAY || 'wss://tianque2-relay.msjzxy2022.workers.dev';

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

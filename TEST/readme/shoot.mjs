/**
 * README 界面截图脚本（中间产物，不参与产品打包）。
 *
 * 背景：Chrome `--headless --screenshot --virtual-time-budget` 无法驱动 Recharts
 * （react-smooth）基于 requestAnimationFrame 的入场动画，会让柱/饼图元停留在
 * 动画起点。因此改用 CDP（Chrome DevTools Protocol）驱动，按真实时间等待动画
 * 完成后再截图。
 *
 * 依赖：Node 22 内置 WebSocket / fetch（无需第三方包）；本机已启动的 Vite dev（1420）
 * 与开启远程调试端口（9222）的无头 Chrome。
 *
 * 用法：node TEST/readme/shoot.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const ORIGIN = process.env.ORIGIN || "http://localhost:1420";
const OUTDIR = process.env.OUTDIR || "docs/images";
const WIDTH = Number(process.env.SHOT_W || 1680);
const HEIGHT = Number(process.env.SHOT_H || 1080);
const SCALE = Number(process.env.SHOT_SCALE || 2);

/** 待截取页面：?view 参数 → 输出文件名 */
const TARGETS = [
  { view: "datasource", file: "datasource.png" },
  { view: "dashboard", file: "dashboard.png" },
];

/** 极简 CDP 连接：按 id 匹配请求/响应，支持 flatten 会话。 */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.seq;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
  close() {
    try {
      this.ws.close();
    } catch {
      /* noop */
    }
  }
}

function openWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws), { once: true });
    ws.addEventListener("error", (e) => reject(new Error(`ws error: ${e?.message || e}`)), {
      once: true,
    });
  });
}

async function main() {
  mkdirSync(OUTDIR, { recursive: true });

  const version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  const ws = await openWs(version.webSocketDebuggerUrl);
  const cdp = new Cdp(ws);

  for (const t of TARGETS) {
    const url = `${ORIGIN}/TEST/readme/index.html?view=${t.view}`;
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });

    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE, mobile: false },
      sessionId,
    );
    await cdp.send("Page.navigate", { url }, sessionId);

    // 等待字体加载 + Recharts 入场动画（约 1.5s）完成
    await sleep(2800);

    const shot = await cdp.send(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: false },
      sessionId,
    );
    const out = `${OUTDIR}/${t.file}`;
    writeFileSync(out, Buffer.from(shot.data, "base64"));
    console.log(`✓ ${t.view}  ${WIDTH}x${HEIGHT}@${SCALE}  ->  ${out}`);

    await cdp.send("Target.closeTarget", { targetId });
    await sleep(150);
  }

  cdp.close();
}

main().catch((e) => {
  console.error("截图失败：", e);
  process.exitCode = 1;
});

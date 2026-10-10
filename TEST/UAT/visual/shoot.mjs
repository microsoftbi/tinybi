/**
 * UAT 截图取证脚本（中间产物，不参与产品打包）。
 *
 * 背景：Chrome `--headless --screenshot --virtual-time-budget` 无法驱动
 * Recharts（react-smooth）基于 requestAnimationFrame + performance.now 的入场动画，
 * 会导致柱/饼等图元停留在动画起点（高度/角度为 0）。因此改用 CDP
 * （Chrome DevTools Protocol）驱动，按真实时间等待动画完成后再截图。
 *
 * 依赖：Node 22 内置 WebSocket / fetch（无需第三方包）；本机已启动的 Vite dev（1420）。
 *
 * 用法：
 *   node TEST/UAT/visual/shoot.mjs            # 截全部 28 条
 *   node TEST/UAT/visual/shoot.mjs UAT-HL-01  # 只截指定用例
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const ORIGIN = process.env.ORIGIN || "http://localhost:1420";
const OUTDIR = process.env.OUTDIR || "TEST/UAT/screenshots";
const WIDTH = Number(process.env.SHOT_W || 1400);
const SCALE = Number(process.env.SHOT_SCALE || 2);
const VIEW_H = 900;

const ALL = Array.from(
  { length: 28 },
  (_, i) => `UAT-HL-${String(i + 1).padStart(2, "0")}`,
);
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
// 仪表盘外壳用例依赖 setTimeout 序列（约 1.65s）后呈现最终态，等待更久。
const DASH = new Set(["UAT-HL-11", "UAT-HL-12", "UAT-HL-13", "UAT-HL-14", "UAT-HL-28"]);

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

  for (const id of targets) {
    const url = `${ORIGIN}/TEST/UAT/visual/index.html?case=${id}`;
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });

    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: WIDTH, height: VIEW_H, deviceScaleFactor: SCALE, mobile: false },
      sessionId,
    );
    await cdp.send("Page.navigate", { url }, sessionId);

    await sleep(DASH.has(id) ? 3400 : 2200);

    // 依据内容真实高度二次调整视口，保证长页面（仪表盘 + 证据面板）完整入镜。
    let contentH = VIEW_H;
    try {
      const m = await cdp.send("Page.getLayoutMetrics", {}, sessionId);
      contentH = Math.ceil(m.cssContentSize?.height ?? m.contentSize?.height ?? VIEW_H);
      contentH = Math.max(200, Math.min(contentH, 2600));
    } catch {
      /* 用默认高度 */
    }
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: WIDTH, height: contentH, deviceScaleFactor: SCALE, mobile: false },
      sessionId,
    );
    await sleep(500);

    const shot = await cdp.send(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true },
      sessionId,
    );
    const out = `${OUTDIR}/${id}.png`;
    writeFileSync(out, Buffer.from(shot.data, "base64"));
    console.log(`✓ ${id}  ${contentH}px  ->  ${out}`);

    await cdp.send("Target.closeTarget", { targetId });
    await sleep(150);
  }

  cdp.close();
}

main().catch((e) => {
  console.error("截图失败：", e);
  process.exitCode = 1;
});

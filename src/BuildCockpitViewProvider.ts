import * as vscode from "vscode";
import { DataProvider } from "./dataProvider";
import { DashboardData } from "./types";

export class BuildCockpitViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly dataProvider: DataProvider
  ) {}

  async resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "toggleDep":
          await this.dataProvider.toggleDep(msg.name);
          await this.refresh();
          break;
        case "pauseAll":
          await this.dataProvider.pauseAllSafe();
          await this.refresh();
          break;
        case "activateAll":
          await this.dataProvider.activateAll();
          await this.refresh();
          break;
        case "createSampleDeps":
          await this.dataProvider.createSampleDeps();
          await this.refresh();
          break;
        case "createSampleTasks":
          await this.dataProvider.createSampleTasks();
          await this.refresh();
          break;
      }
    });

    await this.refresh();
  }

  async refresh() {
    if (!this.view) {
      return;
    }
    const data = await this.dataProvider.getDashboardData();
    this.view.webview.html = this.getHtml(data);
  }

  private getHtml(data: DashboardData): string {
    const nonce = getNonce();

    // If neither file exists, show onboarding
    if (!data.hasDepsFile && !data.hasTasksFile) {
      return this.getOnboardingHtml(nonce);
    }

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style nonce="${nonce}">
  :root {
    --bg: #0d0d0f;
    --surface: #161619;
    --border: #2a2a2f;
    --text: #e8e8ec;
    --text-dim: #8888a0;
    --accent: #00d4aa;
    --accent-glow: rgba(0, 212, 170, 0.15);
    --warn: #ffaa00;
    --danger: #ff4466;
    --gauge-track: #1e1e24;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 12px;
    overflow-x: hidden;
    padding: 8px;
  }

  /* ─── STATUS LIGHTS ─── */
  .status-bar {
    display: flex;
    gap: 10px;
    justify-content: center;
    padding: 8px 0 4px;
  }
  .status-light {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #444;
    box-shadow: 0 0 4px rgba(68,68,68,0.5);
  }
  .status-dot.green { background: #00cc88; box-shadow: 0 0 6px rgba(0,204,136,0.6); }
  .status-dot.amber { background: #ffaa00; box-shadow: 0 0 6px rgba(255,170,0,0.6); }
  .status-dot.red { background: #ff4466; box-shadow: 0 0 6px rgba(255,68,102,0.6); }

  /* ─── GAUGE CLUSTER ─── */
  .cluster {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 0;
  }
  .main-gauge {
    position: relative;
    width: 180px;
    height: 120px;
  }
  .main-gauge svg { width: 100%; height: 100%; }
  .gauge-label {
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
  }
  .gauge-value {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -1px;
    color: var(--text);
    line-height: 1;
  }
  .gauge-caption {
    font-size: 9px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 2px;
  }

  .sub-gauges {
    display: flex;
    gap: 16px;
    margin-top: 4px;
  }
  .sub-gauge {
    position: relative;
    width: 100px;
    height: 72px;
    text-align: center;
  }
  .sub-gauge svg { width: 100%; height: 100%; }
  .sub-gauge-label {
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
  }
  .sub-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
  }
  .sub-caption {
    font-size: 8px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-top: 1px;
  }

  /* ─── BADGE ─── */
  .badge {
    position: absolute;
    bottom: 22px;
    right: 10px;
    font-size: 8px;
    color: var(--text-dim);
    background: rgba(255,255,255,0.04);
    padding: 2px 6px;
    border-radius: 3px;
    letter-spacing: 0.5px;
  }

  /* ─── GLASS OVERLAY ─── */
  .glass-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(255,255,255,0.02) 0%,
      transparent 40%,
      transparent 60%,
      rgba(0,0,0,0.05) 100%
    );
    pointer-events: none;
    border-radius: 12px;
  }

  /* ─── DIVIDER ─── */
  .divider {
    height: 1px;
    background: var(--border);
    margin: 10px 0;
  }

  /* ─── SECTION HEADERS ─── */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .section-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-dim);
    font-weight: 600;
  }

  /* ─── DEP LIST ─── */
  .dep-list { display: flex; flex-direction: column; gap: 4px; }
  .dep-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 8px;
    transition: border-color 0.15s;
  }
  .dep-row:hover { border-color: #3a3a44; }
  .dep-info { display: flex; flex-direction: column; gap: 1px; }
  .dep-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
  }
  .dep-meta {
    font-size: 9px;
    color: var(--text-dim);
  }
  .dep-status {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 4px;
    vertical-align: middle;
  }
  .dep-status.active { background: var(--accent); }
  .dep-status.paused { background: var(--warn); }

  /* ─── BUTTONS ─── */
  .btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-glow);
  }
  .btn-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .btn-sm {
    padding: 2px 6px;
    font-size: 9px;
  }
  .btn.active-toggle {
    border-color: var(--accent);
    color: var(--accent);
  }
  .btn.pause-toggle {
    border-color: var(--warn);
    color: var(--warn);
  }

  /* ─── TASK LIST ─── */
  .task-list { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
  .task-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 11px;
  }
  .task-status-icon {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.5px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 8px;
  }
  .task-status-icon.done {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
  }
  .task-status-icon.doing {
    border-color: var(--accent);
    color: var(--accent);
  }
  .task-status-icon.blocked {
    border-color: var(--danger);
    color: var(--danger);
  }
  .task-title {
    flex: 1;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .task-title.blocked { color: var(--text-dim); text-decoration: line-through; }
  .task-weight {
    font-size: 9px;
    color: var(--text-dim);
    flex-shrink: 0;
  }
  .task-blocked-tag {
    font-size: 8px;
    color: var(--danger);
    background: rgba(255,68,102,0.1);
    padding: 1px 4px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  /* ─── MISSING FILE BANNERS ─── */
  .missing-banner {
    background: rgba(255,170,0,0.08);
    border: 1px solid rgba(255,170,0,0.2);
    border-radius: 6px;
    padding: 8px;
    text-align: center;
    margin-bottom: 8px;
  }
  .missing-banner p {
    font-size: 10px;
    color: var(--warn);
    margin-bottom: 6px;
  }
</style>
</head>
<body>
  <!-- STATUS LIGHTS -->
  <div class="status-bar">
    <div class="status-light">
      <span class="status-dot ${data.hasTasksFile ? "green" : "amber"}"></span>
      Tasks
    </div>
    <div class="status-light">
      <span class="status-dot ${data.hasDepsFile ? "green" : "amber"}"></span>
      Deps
    </div>
    <div class="status-light">
      <span class="status-dot ${data.blockedTasks > 0 ? "red" : "green"}"></span>
      Health
    </div>
    <div class="status-light">
      <span class="status-dot ${data.monthlyBurn > 50 ? "amber" : "green"}"></span>
      Burn
    </div>
  </div>

  <!-- GAUGE CLUSTER -->
  <div class="cluster">
    <div class="glass-overlay"></div>

    <!-- MAIN PROGRESS GAUGE -->
    <div class="main-gauge">
      <svg viewBox="0 0 200 130">
        <!-- Tick marks -->
        ${this.generateTicks(100, 105, 40, 200, 130)}
        <!-- Track -->
        <path d="${describeArc(100, 105, 72, 220, 320)}" fill="none" stroke="#1e1e24" stroke-width="12" stroke-linecap="round"/>
        <!-- Value arc -->
        <path d="${describeArc(100, 105, 72, 220, 220 + (data.progress / 100) * 100)}"
          fill="none" stroke="${this.progressColor(data.progress)}" stroke-width="12" stroke-linecap="round"
          style="filter: drop-shadow(0 0 6px ${this.progressColor(data.progress)}44);"/>
        <!-- Needle -->
        ${this.generateNeedle(100, 105, 58, 220 + (data.progress / 100) * 100)}
        <!-- Center cap -->
        <circle cx="100" cy="105" r="5" fill="#2a2a2f"/>
        <circle cx="100" cy="105" r="2.5" fill="${this.progressColor(data.progress)}"/>
      </svg>
      <div class="gauge-label">
        <div class="gauge-value">${data.progress}%</div>
        <div class="gauge-caption">Progress</div>
      </div>
    </div>

    <!-- SUB GAUGES -->
    <div class="sub-gauges">
      <!-- BURN GAUGE -->
      <div class="sub-gauge">
        <svg viewBox="0 0 120 80">
          ${this.generateTicks(60, 65, 25, 120, 80, true)}
          <path d="${describeArc(60, 65, 40, 220, 320)}" fill="none" stroke="#1e1e24" stroke-width="8" stroke-linecap="round"/>
          <path d="${describeArc(60, 65, 40, 220, 220 + Math.min(1, data.monthlyBurn / 200) * 100)}"
            fill="none" stroke="${data.monthlyBurn > 100 ? "#ff4466" : data.monthlyBurn > 50 ? "#ffaa00" : "#00d4aa"}"
            stroke-width="8" stroke-linecap="round"
            style="filter: drop-shadow(0 0 4px ${data.monthlyBurn > 100 ? "#ff446644" : data.monthlyBurn > 50 ? "#ffaa0044" : "#00d4aa44"});"/>
          <circle cx="60" cy="65" r="3" fill="#2a2a2f"/>
        </svg>
        <div class="sub-gauge-label">
          <div class="sub-value">$${data.monthlyBurn}</div>
          <div class="sub-caption">${data.activeDeps}/${data.totalDeps} active</div>
        </div>
      </div>

      <!-- BLOCKED GAUGE -->
      <div class="sub-gauge">
        <svg viewBox="0 0 120 80">
          ${this.generateTicks(60, 65, 25, 120, 80, true)}
          <path d="${describeArc(60, 65, 40, 220, 320)}" fill="none" stroke="#1e1e24" stroke-width="8" stroke-linecap="round"/>
          <path d="${describeArc(60, 65, 40, 220, 220 + (data.totalTasks > 0 ? Math.min(1, data.blockedTasks / data.totalTasks) : 0) * 100)}"
            fill="none" stroke="${data.blockedTasks > 0 ? "#ff4466" : "#00d4aa"}"
            stroke-width="8" stroke-linecap="round"
            style="filter: drop-shadow(0 0 4px ${data.blockedTasks > 0 ? "#ff446644" : "#00d4aa44"});"/>
          <circle cx="60" cy="65" r="3" fill="#2a2a2f"/>
        </svg>
        <div class="sub-gauge-label">
          <div class="sub-value">${data.blockedTasks}</div>
          <div class="sub-caption">Blocked</div>
        </div>
      </div>
    </div>

    <div class="badge">by Restolad</div>
  </div>

  <div class="divider"></div>

  <!-- MISSING FILE BANNERS -->
  ${!data.hasDepsFile ? `
  <div class="missing-banner">
    <p>No deps.yaml found</p>
    <button class="btn btn-sm" onclick="send('createSampleDeps')">Create Sample</button>
  </div>` : ""}
  ${!data.hasTasksFile ? `
  <div class="missing-banner">
    <p>No tasks.json found</p>
    <button class="btn btn-sm" onclick="send('createSampleTasks')">Create Sample</button>
  </div>` : ""}

  <!-- DEPENDENCIES -->
  ${data.hasDepsFile ? `
  <div class="section-header">
    <span class="section-title">Dependencies</span>
    <div class="btn-row">
      <button class="btn btn-sm" onclick="send('pauseAll')">Pause Safe</button>
      <button class="btn btn-sm" onclick="send('activateAll')">Activate All</button>
    </div>
  </div>
  <div class="dep-list">
    ${data.deps
      .map(
        (d) => `
    <div class="dep-row">
      <div class="dep-info">
        <span class="dep-name"><span class="dep-status ${d.status}"></span>${d.name}</span>
        <span class="dep-meta">${d.billing}${d.cost_monthly ? ` \u00b7 $${d.cost_monthly}/mo` : ""}${d.safe_to_pause ? " \u00b7 safe" : ""}</span>
      </div>
      <button class="btn btn-sm ${d.status === "active" ? "active-toggle" : "pause-toggle"}"
        onclick="send('toggleDep', '${d.name}')">${d.status === "active" ? "Pause" : "Activate"}</button>
    </div>`
      )
      .join("")}
  </div>` : ""}

  ${data.hasTasksFile ? `
  <div class="divider"></div>

  <!-- TASKS -->
  <div class="section-header">
    <span class="section-title">Tasks</span>
    <span class="section-title" style="opacity:0.5">${data.doneWeight}/${data.totalWeight} pts</span>
  </div>
  <div class="task-list">
    ${data.tasks
      .map((t) => {
        const pausedDepNames = new Set(
          data.deps.filter((d) => d.status === "paused").map((d) => d.name)
        );
        const isBlocked =
          t.status !== "done" &&
          t.depends_on.some((dep) => pausedDepNames.has(dep));
        const icon =
          t.status === "done"
            ? "\u2713"
            : t.status === "doing"
            ? "\u25B6"
            : isBlocked
            ? "!"
            : "";
        const iconClass =
          t.status === "done"
            ? "done"
            : t.status === "doing"
            ? "doing"
            : isBlocked
            ? "blocked"
            : "";
        return `
    <div class="task-row">
      <span class="task-status-icon ${iconClass}">${icon}</span>
      <span class="task-title ${isBlocked ? "blocked" : ""}">${t.title}</span>
      ${isBlocked ? `<span class="task-blocked-tag">blocked</span>` : ""}
      <span class="task-weight">${t.weight}pt</span>
    </div>`;
      })
      .join("")}
  </div>` : ""}

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function send(type, name) {
      vscode.postMessage({ type, name });
    }
  </script>
</body>
</html>`;
  }

  private getOnboardingHtml(nonce: string): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style nonce="${nonce}">
  :root {
    --bg: #0d0d0f;
    --surface: #161619;
    --border: #2a2a2f;
    --text: #e8e8ec;
    --text-dim: #8888a0;
    --accent: #00d4aa;
    --accent-glow: rgba(0, 212, 170, 0.15);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 12px;
    padding: 20px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    min-height: 100vh;
  }
  .logo {
    width: 64px;
    height: 64px;
    opacity: 0.6;
    margin-top: 20px;
  }
  h2 {
    font-size: 16px;
    font-weight: 700;
    text-align: center;
  }
  p {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
    max-width: 220px;
    line-height: 1.5;
  }
  .btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    width: 200px;
    text-align: center;
  }
  .btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-glow);
  }
  .badge {
    font-size: 9px;
    color: var(--text-dim);
    margin-top: 20px;
    opacity: 0.5;
  }
</style>
</head>
<body>
  <svg class="logo" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 78a46 46 0 1 1 92 0" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <path d="M64 74 92 46" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    <circle cx="64" cy="74" r="6" fill="currentColor"/>
    <path d="M34 78h60" stroke="currentColor" stroke-width="10" stroke-linecap="round" opacity="0.7"/>
  </svg>
  <h2>Build Cockpit</h2>
  <p>Track your project's progress, dependency burn, and blocked tasks — all from the sidebar.</p>
  <p>Get started by creating the config files in your workspace root.</p>
  <button class="btn" onclick="send('createSampleDeps')">Create deps.yaml</button>
  <button class="btn" onclick="send('createSampleTasks')">Create tasks.json</button>
  <span class="badge">by Restolad</span>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function send(type) { vscode.postMessage({ type }); }
  </script>
</body>
</html>`;
  }

  private progressColor(progress: number): string {
    if (progress >= 75) return "#00d4aa";
    if (progress >= 40) return "#ffaa00";
    return "#ff4466";
  }

  private generateTicks(
    cx: number,
    cy: number,
    count: number,
    _viewW: number,
    _viewH: number,
    small = false
  ): string {
    const startAngle = 220;
    const endAngle = 320;
    const radius = small ? 46 : 82;
    const tickLen = small ? 4 : 6;
    const ticks: string[] = [];
    for (let i = 0; i <= count; i++) {
      const angle = startAngle + (i / count) * (endAngle - startAngle);
      const rad = (angle * Math.PI) / 180;
      const x1 = cx + (radius - tickLen) * Math.cos(rad);
      const y1 = cy + (radius - tickLen) * Math.sin(rad);
      const x2 = cx + radius * Math.cos(rad);
      const y2 = cy + radius * Math.sin(rad);
      const isMajor = i % (small ? 5 : 10) === 0;
      ticks.push(
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2a2a2f" stroke-width="${
          isMajor ? 1.5 : 0.5
        }" opacity="${isMajor ? 0.8 : 0.4}"/>`
      );
    }
    return ticks.join("\n        ");
  }

  private generateNeedle(
    cx: number,
    cy: number,
    length: number,
    angleDeg: number
  ): string {
    const rad = (angleDeg * Math.PI) / 180;
    const tipX = cx + length * Math.cos(rad);
    const tipY = cy + length * Math.sin(rad);
    const tailLen = 12;
    const tailX = cx - tailLen * Math.cos(rad);
    const tailY = cy - tailLen * Math.sin(rad);
    return `<line x1="${tailX}" y1="${tailY}" x2="${tipX}" y2="${tipY}" stroke="#e8e8ec" stroke-width="2" stroke-linecap="round" style="filter: drop-shadow(0 0 3px rgba(232,232,236,0.4));"/>`;
  }
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

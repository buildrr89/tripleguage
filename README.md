# Build Cockpit

A VS Code extension that adds a **sports car gauge-cluster dashboard** to your sidebar — track project progress, dependency burn rate, and blocked tasks at a glance.

**by Restolad**

## Features

- **Progress gauge** — weighted task completion with SVG needle, tick marks, and animated arcs
- **Burn gauge** — active paid dependency count and monthly cost
- **Blocked gauge** — tasks blocked by paused dependencies
- **Status lights** — quick health indicators for tasks, deps, health, and burn
- **Task editing** — click any task's status circle to cycle it through todo → doing → done
- **Dependency management** — toggle individual deps active/paused, or bulk pause all safe-to-pause deps
- **Activity Bar badge** — blocked task count shown on the extension icon
- **Theme-aware** — uses VS Code CSS variables so it looks correct in any color theme
- **Dual format** — supports both `tasks.json` and `tasks.yaml`
- **Configurable** — burn threshold, max scale, and file names via VS Code settings
- **Auto-refresh** — file watchers detect changes instantly
- **Onboarding** — if config files are missing, one-click sample file creation

## Getting Started

1. Install dependencies and compile:

```bash
npm install
npm run compile
```

2. Press **F5** in VS Code to launch the Extension Development Host.

3. Click the speedometer icon in the Activity Bar to open Build Cockpit.

4. If no config files exist, use the onboarding buttons to create samples.

## Configuration Files

Place these in your workspace root.

### `deps.yaml`

```yaml
deps:
  - name: "Supabase"
    billing: "monthly"
    cost_monthly: 25
    status: "active"
    safe_to_pause: true
    required_for_tasks: ["auth", "db"]
  - name: "Stripe"
    billing: "usage"
    status: "active"
    safe_to_pause: false
    required_for_tasks: ["payments"]
```

### `tasks.json` (or `tasks.yaml`)

```json
{
  "tasks": [
    {
      "id": "auth-1",
      "title": "Sign in with Apple",
      "weight": 30,
      "status": "done",
      "depends_on": ["Supabase"]
    }
  ]
}
```

## Settings

Open VS Code settings and search for "Build Cockpit":

| Setting | Default | Description |
|---------|---------|-------------|
| `buildCockpit.burnThreshold` | `50` | Monthly burn ($) above which the status light turns amber |
| `buildCockpit.burnMax` | `200` | Max value for the burn gauge scale |
| `buildCockpit.depsFileName` | `"deps.yaml"` | Dependencies file name |
| `buildCockpit.tasksFileNames` | `["tasks.json", "tasks.yaml"]` | Task file names (priority order) |

## Calculations

| Metric | Formula |
|--------|---------|
| Progress % | `sum(done weights) / sum(all weights) * 100` |
| Monthly Burn | `sum(cost_monthly)` for active monthly deps |
| Blocked | Tasks not done whose `depends_on` includes a paused dep |

## Packaging as VSIX

```bash
npm install -g @vscode/vsce
vsce package
```

Install the `.vsix` in VS Code or Cursor via **Extensions > Install from VSIX**.

## Cursor Compatibility

This extension is standard VS Code API — install via VSIX in Cursor the same way.

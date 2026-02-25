import * as vscode from "vscode";
import { BuildCockpitViewProvider } from "./BuildCockpitViewProvider";
import { DataProvider } from "./dataProvider";

export function activate(context: vscode.ExtensionContext) {
  const dataProvider = new DataProvider();
  const viewProvider = new BuildCockpitViewProvider(context, dataProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "buildCockpit.dashboard",
      viewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // File watchers for auto-refresh
  const depsWatcher = vscode.workspace.createFileSystemWatcher("**/deps.yaml");
  const tasksJsonWatcher = vscode.workspace.createFileSystemWatcher("**/tasks.json");
  const tasksYamlWatcher = vscode.workspace.createFileSystemWatcher("**/tasks.yaml");

  const refresh = () => viewProvider.refresh();

  for (const watcher of [depsWatcher, tasksJsonWatcher, tasksYamlWatcher]) {
    watcher.onDidChange(refresh);
    watcher.onDidCreate(refresh);
    watcher.onDidDelete(refresh);
    context.subscriptions.push(watcher);
  }

  // Refresh when settings change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("buildCockpit")) {
        refresh();
      }
    })
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("buildCockpit.refresh", refresh),
    vscode.commands.registerCommand("buildCockpit.pauseAll", async () => {
      await dataProvider.pauseAllSafe();
      refresh();
    }),
    vscode.commands.registerCommand("buildCockpit.createSampleDeps", async () => {
      await dataProvider.createSampleDeps();
      refresh();
    }),
    vscode.commands.registerCommand("buildCockpit.createSampleTasks", async () => {
      await dataProvider.createSampleTasks();
      refresh();
    })
  );
}

export function deactivate() {}

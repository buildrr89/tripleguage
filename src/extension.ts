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
  const tasksWatcher = vscode.workspace.createFileSystemWatcher("**/tasks.json");

  const refresh = () => viewProvider.refresh();
  depsWatcher.onDidChange(refresh);
  depsWatcher.onDidCreate(refresh);
  depsWatcher.onDidDelete(refresh);
  tasksWatcher.onDidChange(refresh);
  tasksWatcher.onDidCreate(refresh);
  tasksWatcher.onDidDelete(refresh);

  context.subscriptions.push(depsWatcher, tasksWatcher);

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

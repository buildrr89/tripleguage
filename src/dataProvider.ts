import * as vscode from "vscode";
import * as path from "path";
import YAML from "yaml";
import { Dependency, Task, DepsFile, TasksFile, DashboardData, CockpitSettings } from "./types";

export class DataProvider {
  private workspaceRoot: string | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  getSettings(): CockpitSettings {
    const config = vscode.workspace.getConfiguration("buildCockpit");
    return {
      burnThreshold: config.get<number>("burnThreshold", 50),
      burnMax: config.get<number>("burnMax", 200),
      depsFileName: config.get<string>("depsFileName", "deps.yaml"),
      tasksFileNames: config.get<string[]>("tasksFileNames", ["tasks.json", "tasks.yaml"]),
    };
  }

  async readDepsFile(): Promise<{ deps: Dependency[]; exists: boolean }> {
    if (!this.workspaceRoot) {
      return { deps: [], exists: false };
    }
    const settings = this.getSettings();
    const filePath = path.join(this.workspaceRoot, settings.depsFileName);
    try {
      const uri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(content).toString("utf-8");
      const parsed = YAML.parse(text) as DepsFile;
      const deps = (parsed?.deps ?? []).map((d) => ({
        name: d.name ?? "Unknown",
        billing: d.billing ?? "free",
        cost_monthly: d.cost_monthly ?? 0,
        status: d.status ?? "active",
        safe_to_pause: d.safe_to_pause ?? false,
        required_for_tasks: d.required_for_tasks ?? [],
      }));
      return { deps, exists: true };
    } catch {
      return { deps: [], exists: false };
    }
  }

  async readTasksFile(): Promise<{ tasks: Task[]; exists: boolean; format: "json" | "yaml" }> {
    if (!this.workspaceRoot) {
      return { tasks: [], exists: false, format: "json" };
    }
    const settings = this.getSettings();

    // Try each tasks file name in order
    for (const fileName of settings.tasksFileNames) {
      const filePath = path.join(this.workspaceRoot, fileName);
      try {
        const uri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(content).toString("utf-8");
        const isYaml = fileName.endsWith(".yaml") || fileName.endsWith(".yml");
        const parsed = isYaml
          ? (YAML.parse(text) as TasksFile)
          : (JSON.parse(text) as TasksFile);
        const tasks = (parsed?.tasks ?? []).map((t) => ({
          id: t.id ?? "unknown",
          title: t.title ?? "Untitled",
          weight: t.weight ?? 1,
          status: t.status ?? "todo",
          depends_on: t.depends_on ?? [],
        }));
        return { tasks, exists: true, format: isYaml ? "yaml" : "json" };
      } catch {
        // Try next file
      }
    }
    return { tasks: [], exists: false, format: "json" };
  }

  private _tasksFormat: "json" | "yaml" = "json";

  async getDashboardData(): Promise<DashboardData> {
    const settings = this.getSettings();
    const [depsResult, tasksResult] = await Promise.all([
      this.readDepsFile(),
      this.readTasksFile(),
    ]);

    this._tasksFormat = tasksResult.format;
    const { deps } = depsResult;
    const { tasks } = tasksResult;

    const totalWeight = tasks.reduce((s, t) => s + t.weight, 0);
    const doneWeight = tasks
      .filter((t) => t.status === "done")
      .reduce((s, t) => s + t.weight, 0);
    const progress = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;

    const activeDeps = deps.filter((d) => d.status === "active");
    const monthlyBurn = activeDeps
      .filter((d) => d.billing === "monthly")
      .reduce((s, d) => s + (d.cost_monthly ?? 0), 0);

    const pausedDepNames = new Set(
      deps.filter((d) => d.status === "paused").map((d) => d.name)
    );
    const blockedTasks = tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.depends_on.some((dep) => pausedDepNames.has(dep))
    ).length;

    return {
      progress,
      totalWeight,
      doneWeight,
      activeDeps: activeDeps.length,
      totalDeps: deps.length,
      monthlyBurn,
      blockedTasks,
      totalTasks: tasks.length,
      deps,
      tasks,
      hasDepsFile: depsResult.exists,
      hasTasksFile: tasksResult.exists,
    };
  }

  async writeDepsFile(deps: Dependency[]): Promise<void> {
    if (!this.workspaceRoot) {
      return;
    }
    const settings = this.getSettings();
    const filePath = path.join(this.workspaceRoot, settings.depsFileName);
    const uri = vscode.Uri.file(filePath);
    const content = YAML.stringify({ deps });
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
  }

  async writeTasksFile(tasks: Task[]): Promise<void> {
    if (!this.workspaceRoot) {
      return;
    }
    const settings = this.getSettings();
    // Write to the first file name that exists, or the first in the list
    const fileName = settings.tasksFileNames[0];
    const filePath = path.join(this.workspaceRoot, fileName);
    const uri = vscode.Uri.file(filePath);

    if (this._tasksFormat === "yaml") {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(YAML.stringify({ tasks }), "utf-8"));
    } else {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify({ tasks }, null, 2), "utf-8"));
    }
  }

  async toggleDep(depName: string): Promise<void> {
    const { deps, exists } = await this.readDepsFile();
    if (!exists) {
      return;
    }
    const dep = deps.find((d) => d.name === depName);
    if (dep) {
      dep.status = dep.status === "active" ? "paused" : "active";
      await this.writeDepsFile(deps);
    }
  }

  async cycleTaskStatus(taskId: string): Promise<void> {
    const { tasks, exists } = await this.readTasksFile();
    if (!exists) {
      return;
    }
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const cycle: Record<string, "todo" | "doing" | "done"> = {
        todo: "doing",
        doing: "done",
        done: "todo",
      };
      task.status = cycle[task.status] ?? "todo";
      await this.writeTasksFile(tasks);
    }
  }

  async pauseAllSafe(): Promise<void> {
    const { deps, exists } = await this.readDepsFile();
    if (!exists) {
      return;
    }
    for (const dep of deps) {
      if (dep.safe_to_pause) {
        dep.status = "paused";
      }
    }
    await this.writeDepsFile(deps);
  }

  async activateAll(): Promise<void> {
    const { deps, exists } = await this.readDepsFile();
    if (!exists) {
      return;
    }
    for (const dep of deps) {
      dep.status = "active";
    }
    await this.writeDepsFile(deps);
  }

  async createSampleDeps(): Promise<void> {
    if (!this.workspaceRoot) {
      return;
    }
    const sample: DepsFile = {
      deps: [
        {
          name: "Supabase",
          billing: "monthly",
          cost_monthly: 25,
          status: "active",
          safe_to_pause: true,
          required_for_tasks: ["auth", "db"],
        },
        {
          name: "Stripe",
          billing: "usage",
          cost_monthly: 0,
          status: "active",
          safe_to_pause: false,
          required_for_tasks: ["payments"],
        },
        {
          name: "Vercel",
          billing: "monthly",
          cost_monthly: 20,
          status: "active",
          safe_to_pause: true,
          required_for_tasks: ["deploy"],
        },
        {
          name: "Resend",
          billing: "free",
          cost_monthly: 0,
          status: "paused",
          safe_to_pause: true,
          required_for_tasks: ["email"],
        },
      ],
    };
    const settings = this.getSettings();
    const filePath = path.join(this.workspaceRoot, settings.depsFileName);
    const uri = vscode.Uri.file(filePath);
    await vscode.workspace.fs.writeFile(
      uri,
      Buffer.from(YAML.stringify(sample), "utf-8")
    );
  }

  async createSampleTasks(): Promise<void> {
    if (!this.workspaceRoot) {
      return;
    }
    const sample: TasksFile = {
      tasks: [
        {
          id: "auth-1",
          title: "Sign in with Apple",
          weight: 30,
          status: "done",
          depends_on: ["Supabase"],
        },
        {
          id: "auth-2",
          title: "OAuth social login",
          weight: 20,
          status: "doing",
          depends_on: ["Supabase"],
        },
        {
          id: "pay-1",
          title: "Stripe checkout flow",
          weight: 25,
          status: "todo",
          depends_on: ["Stripe"],
        },
        {
          id: "email-1",
          title: "Welcome email sequence",
          weight: 10,
          status: "todo",
          depends_on: ["Resend"],
        },
        {
          id: "deploy-1",
          title: "Production deployment",
          weight: 15,
          status: "todo",
          depends_on: ["Vercel"],
        },
      ],
    };
    const settings = this.getSettings();
    const filePath = path.join(this.workspaceRoot, settings.tasksFileNames[0]);
    const uri = vscode.Uri.file(filePath);
    await vscode.workspace.fs.writeFile(
      uri,
      Buffer.from(JSON.stringify(sample, null, 2), "utf-8")
    );
  }
}

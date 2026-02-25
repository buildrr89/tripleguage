export interface Dependency {
  name: string;
  billing: "monthly" | "usage" | "free";
  cost_monthly?: number;
  status: "active" | "paused";
  safe_to_pause: boolean;
  required_for_tasks: string[];
}

export interface Task {
  id: string;
  title: string;
  weight: number;
  status: "todo" | "doing" | "done";
  depends_on: string[];
}

export interface DepsFile {
  deps: Dependency[];
}

export interface TasksFile {
  tasks: Task[];
}

export interface DashboardData {
  progress: number;
  totalWeight: number;
  doneWeight: number;
  activeDeps: number;
  totalDeps: number;
  monthlyBurn: number;
  blockedTasks: number;
  totalTasks: number;
  deps: Dependency[];
  tasks: Task[];
  hasDepsFile: boolean;
  hasTasksFile: boolean;
}

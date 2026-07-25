import {
  Task,
  TaskStatus,
} from '../types/task';

export type StatusTabKey = "all" | "incomplete" | "progress" | "complete";

const TAB_TO_STATUS: Record<Exclude<StatusTabKey, "all">, TaskStatus> = {
  incomplete: "PENDING",
  progress: "IN_PROGRESS",
  complete: "COMPLETED",
};

export function filterTasksByTab(tasks: Task[], tab: StatusTabKey): Task[] {
  const filteredTasks =
    tab === "all"
      ? [...tasks]
      : tasks.filter((t) => t.status === TAB_TO_STATUS[tab]);

  return filteredTasks.sort((a, b) => b.sortOrder - a.sortOrder);
}

export function countTasksByTab(tasks: Task[]) {
  return {
    all: tasks.length,
    incomplete: tasks.filter((t) => t.status === "PENDING").length,
    progress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    complete: tasks.filter((t) => t.status === "COMPLETED").length,
  };
}

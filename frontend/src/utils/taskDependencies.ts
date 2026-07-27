import { Task } from '../types/task';

export interface TaskDependencyInfo {
    dependsOnIds: string[];
    dependsOnTasks: Task[];
    activeBlockers: Task[];
    isBlocked: boolean;
    blockingTasks: Task[]; // Tasks that depend on THIS task
}

export function getTaskDependencies(task: Task, allTasks: Task[]): TaskDependencyInfo {
    if (!task || !allTasks || allTasks.length === 0) {
        return {
            dependsOnIds: [],
            dependsOnTasks: [],
            activeBlockers: [],
            isBlocked: false,
            blockingTasks: [],
        };
    }

    // Find meta entries for dependsOn or blockedBy
    const dependsOnMetas = task.meta?.filter(
        (m) => (m.key === 'dependsOn' || m.key === 'blockedBy' || m.key === 'prerequisite') && m.value
    ) || [];

    const dependsOnIds = Array.from(
        new Set(
            dependsOnMetas
                .map((m) => m.value!)
                .flatMap((val) => val.split(',').map((id) => id.trim()))
                .filter((id) => id !== task.id)
        )
    );

    const dependsOnTasks = allTasks.filter((t) => dependsOnIds.includes(t.id));
    
    // Active blockers are prerequisite tasks that are NOT completed yet
    const activeBlockers = dependsOnTasks.filter((t) => t.status !== 'COMPLETED');

    // Tasks that depend on THIS task
    const blockingTasks = allTasks.filter((otherTask) => {
        if (otherTask.id === task.id) return false;
        const otherMetas = otherTask.meta?.filter(
            (m) => (m.key === 'dependsOn' || m.key === 'blockedBy' || m.key === 'prerequisite') && m.value
        ) || [];
        const otherDependsOnIds = otherMetas.flatMap((m) => m.value!.split(',').map((id) => id.trim()));
        return otherDependsOnIds.includes(task.id);
    });

    return {
        dependsOnIds,
        dependsOnTasks,
        activeBlockers,
        isBlocked: activeBlockers.length > 0 && task.status !== 'COMPLETED',
        blockingTasks,
    };
}

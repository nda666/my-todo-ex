import { Task } from '../types/task';

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PriorityInfo {
    level: PriorityLevel;
    label: string;
    color: string;
    tagColor: string;
    bgClass: string;
    borderClass: string;
    textClass: string;
}

export const PRIORITY_MAP: Record<PriorityLevel, PriorityInfo> = {
    CRITICAL: {
        level: 'CRITICAL',
        label: 'Critical',
        color: '#ef4444',
        tagColor: 'red',
        bgClass: 'bg-red-50 dark:bg-red-950/40',
        borderClass: 'border-red-200 dark:border-red-900/60',
        textClass: 'text-red-600 dark:text-red-400',
    },
    HIGH: {
        level: 'HIGH',
        label: 'High',
        color: '#f97316',
        tagColor: 'orange',
        bgClass: 'bg-orange-50 dark:bg-orange-950/40',
        borderClass: 'border-orange-200 dark:border-orange-900/60',
        textClass: 'text-orange-600 dark:text-orange-400',
    },
    MEDIUM: {
        level: 'MEDIUM',
        label: 'Medium',
        color: '#3b82f6',
        tagColor: 'blue',
        bgClass: 'bg-blue-50 dark:bg-blue-950/40',
        borderClass: 'border-blue-200 dark:border-blue-900/60',
        textClass: 'text-blue-600 dark:text-blue-400',
    },
    LOW: {
        level: 'LOW',
        label: 'Low',
        color: '#64748b',
        tagColor: 'default',
        bgClass: 'bg-slate-100 dark:bg-slate-800',
        borderClass: 'border-slate-200 dark:border-slate-700',
        textClass: 'text-slate-600 dark:text-slate-400',
    },
};

export const PRIORITY_OPTIONS = [
    { label: '🔴 Critical', value: 'CRITICAL' },
    { label: '🟠 High', value: 'HIGH' },
    { label: '🔵 Medium', value: 'MEDIUM' },
    { label: '⚪ Low', value: 'LOW' },
];

export function getTaskPriority(task: Task | null | undefined): PriorityInfo {
    if (!task) return PRIORITY_MAP.MEDIUM;

    if (task.priority && PRIORITY_MAP[task.priority]) {
        return PRIORITY_MAP[task.priority];
    }

    const priorityMeta = task.meta?.find(
        (m) => m.key.toLowerCase() === 'priority' || m.key.toLowerCase() === 'prioritas'
    );

    const val = (priorityMeta?.value || 'MEDIUM').toUpperCase() as PriorityLevel;
    return PRIORITY_MAP[val] || PRIORITY_MAP.MEDIUM;
}

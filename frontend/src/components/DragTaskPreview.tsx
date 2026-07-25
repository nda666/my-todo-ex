// frontend/src/components/DragTaskPreview.tsx
import React from 'react';

import { Tag } from 'antd';

import { STATUS_OPTIONS } from '../constants/taskStatus';
import { Task } from '../types/task';

// Kartu "ghost" yang mengikuti kursor selama drag (dirender lewat DragOverlay).
// Sengaja versi ringkas/non-interaktif - detail lengkap ada di kartu asli.
export default function DragTaskPreview({ task }: { task: Task }) {
    const activeStatus = STATUS_OPTIONS.find((s) => s.value === task.status)
    return (
        <div className="w-full !bg-white dark:!bg-slate-900 !border !border-blue-300 dark:!border-blue-700 rounded-xl shadow-2xl px-5 py-4 rotate-1 scale-[1.03] cursor-grabbing">
            <div className="flex items-center gap-2">
                <span className="font-semibold !text-slate-800 dark:!text-slate-100 truncate">{task.title}</span>
                <Tag color={activeStatus?.color || 'default'} className="shrink-0">{activeStatus?.label || task.status}</Tag>
            </div>
        </div>
    )
}
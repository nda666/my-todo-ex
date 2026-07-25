import React from 'react';

import { Badge } from 'antd';

import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    PlayCircleOutlined,
    TagOutlined,
} from '@ant-design/icons';

interface TaskStatsProps {
    total: number
    pending: number
    inProgress: number
    completed: number
}

export default function TaskStats({ total, pending, inProgress, completed }: TaskStatsProps) {
    const rows = [
        { icon: <TagOutlined className="!text-slate-400" />, label: 'Total', count: total, color: '#3b82f6' },
        { icon: <ClockCircleOutlined className="!text-amber-500" />, label: 'Pending', count: pending, color: '#f59e0b' },
        { icon: <PlayCircleOutlined className="!text-blue-500" />, label: 'In Progress', count: inProgress, color: '#10b981' },
        { icon: <CheckCircleOutlined className="!text-emerald-500" />, label: 'Completed', count: completed, color: '#10b981' },
    ]

    return (
        <div className="flex flex-col gap-1.5 mt-2">
            {rows.map((row) => (
                <div
                    key={row.label}
                    className="flex justify-between items-center px-3 py-2 !bg-slate-50 dark:!bg-slate-950/20 !border !border-slate-100 dark:!border-slate-800/50 rounded-lg text-sm"
                >
                    <span className="flex items-center gap-2 !text-slate-600 dark:!text-slate-300">
                        {row.icon} {row.label}
                    </span>
                    <Badge count={row.count} color={row.color} className="font-semibold" />
                </div>
            ))}
        </div>
    )
}
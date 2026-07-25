import React from 'react';

import { Tag } from 'antd';

import { TaskMeta } from '../types/task';

export default function MetaDisplay({ meta, compact = false }: { meta: TaskMeta; compact?: boolean }) {
    const label = <Tag className="m-0 font-mono text-xs" color="blue">{meta.key}</Tag>

    const wrapperClass = compact
        ? 'inline-flex items-center gap-1.5 !bg-slate-50 dark:!bg-slate-950 !border !border-slate-200 dark:!border-slate-800 rounded-full px-2 py-1'
        : 'flex items-center gap-1.5'

    switch (meta.type) {
        case 'COLOR':
            return (
                <div className={wrapperClass}>
                    {label}
                    <span
                        className="inline-block w-4 h-4 rounded !border !border-slate-300"
                        style={{ backgroundColor: meta.value || '#ccc' }}
                    />
                    {!compact && <span className="!text-slate-500 text-xs">{meta.value}</span>}
                </div>
            )

        case 'LINK':
            return (
                <div className={wrapperClass}>
                    {label}
                    <a href={meta.value || '#'} target="_blank" rel="noreferrer" className="!text-blue-600 text-xs truncate max-w-[140px]">
                        {meta.value}
                    </a>
                </div>
            )

        case 'DATE':
            return (
                <div className={wrapperClass}>
                    {label}
                    <span className="!text-slate-700 dark:!text-slate-300 text-xs">
                        {meta.value ? new Date(meta.value).toLocaleDateString('id-ID') : '-'}
                    </span>
                </div>
            )

        case 'IMAGE':
            return (
                <div className={wrapperClass}>
                    {label}
                    {meta.value && (
                        <img src={meta.value} alt={meta.key} className={compact ? 'h-6 w-6 object-cover rounded' : 'h-12 w-12 object-cover rounded !border !border-slate-200'} />
                    )}
                </div>
            )

        case 'FILE':
            return (
                <div className={wrapperClass}>
                    {label}
                    <a href={meta.value || '#'} target="_blank" rel="noreferrer" className="!text-blue-600 text-xs">
                        Buka file
                    </a>
                </div>
            )

        default:
            return (
                <div className={wrapperClass}>
                    {label}
                    <span className="!text-slate-700 dark:!text-slate-300 text-xs truncate max-w-[140px]">{meta.value || '-'}</span>
                </div>
            )
    }
}
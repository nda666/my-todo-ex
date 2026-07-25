// frontend/src/components/SortableTaskCard.tsx
import React from 'react';

import { HolderOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { CloudinaryUploadResult } from '../lib/cloudinary';
import {
  MetaDraft,
  Task,
  TaskStatus,
} from '../types/task';
import TaskCard from './TaskCard';

interface UpdateTaskInput {
    title?: string
    description?: string | null
    status?: TaskStatus
}

interface SortableTaskCardProps {
    task: Task
    onUpdate: (id: string, input: UpdateTaskInput) => void
    onDelete: (id: string) => Promise<void>
    onAddComment: (taskId: string, content: string, parentId: string | null, attachments: CloudinaryUploadResult[]) => Promise<void>
    onToggleReaction: (commentId: string, emoji: string) => void
    onSetMeta: (taskId: string, key: string, value: string | null, type: MetaDraft['type']) => Promise<{ id: string }>
    onDeleteMeta: (id: string) => Promise<void>
    onReorderMeta: (taskId: string, orderedIds: string[]) => void
    readOnly?: boolean
}

export default function SortableTaskCard({ task, ...rest }: SortableTaskCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        active,
        over,
    } = useSortable({ id: task.id })

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    }

    const isOverMe = !!over && over.id === task.id && active?.id !== task.id
    const activeIndex = active?.data.current?.sortable?.index ?? -1
    const overIndex = over?.data.current?.sortable?.index ?? -1
    const dropAbove = activeIndex > overIndex // dragged dari bawah -> sisip di atas target

    return (
        <div ref={setNodeRef} style={style} className={`relative group my-2 ${isDragging ? 'z-30' : 'z-0'}`}>
            {isOverMe && (
                <div
                    className={`absolute left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 z-40 pointer-events-none animate-in fade-in duration-150 ${dropAbove ? '-top-[9px]' : '-bottom-[9px]'
                        }`}
                >
                    <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]" />
                </div>
            )}

            {!rest.readOnly && (
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute -left-2.5 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-7 rounded-full cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all duration-150 !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-700 shadow-sm hover:shadow-md hover:!border-blue-300 dark:hover:!border-blue-700 hover:scale-110"
                >
                    <HolderOutlined className="!text-slate-400 group-hover:!text-blue-500 text-sm" />
                </div>
            )}

            <div
                className={`transition-all duration-150 rounded-xl ${isDragging ? 'opacity-40 scale-[0.98] ring-2 ring-blue-400/60' : ''
                    }`}
            >
                <TaskCard task={task} {...rest} />
            </div>
        </div>
    )
}
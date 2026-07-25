// frontend/src/components/TaskTable.tsx
import React, { useState } from 'react';

import {
  Button,
  Popconfirm,
  Select,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { STATUS_OPTIONS } from '../constants/taskStatus';
import { CloudinaryUploadResult } from '../lib/cloudinary';
import {
  MetaDraft,
  Task,
  TaskStatus,
} from '../types/task';
import CommentThread from './CommentThread';
import MetaDisplay from './MetaDisplay';
import SubtaskList from './SubtaskList';
import TaskEditModal from './TaskEditModal';

interface UpdateTaskInput {
    title?: string
    description?: string | null
    status?: TaskStatus
}

interface TaskTableProps {
    tasks: Task[]
    onUpdate: (id: string, input: UpdateTaskInput) => void
    onDelete: (id: string) => Promise<void>
    onAddComment: (taskId: string, content: string, parentId: string | null, attachments: CloudinaryUploadResult[]) => Promise<void>
    onToggleReaction: (commentId: string, emoji: string) => void
    onSetMeta: (taskId: string, key: string, value: string | null, type: MetaDraft['type']) => Promise<{ id: string }>
    onDeleteMeta: (id: string) => Promise<void>
    onReorderMeta: (taskId: string, orderedIds: string[]) => void
    onReorderTasks?: (orderedIds: string[]) => void // <-- baru, opsional (kalau tidak dipasang, drag dimatikan)
    isRowEditable?: (task: Task) => boolean
}

const META_PREVIEW_COUNT = 5

function DraggableRow({
    children,
    draggable,
    ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { 'data-row-key': string; draggable: boolean }) {
    const rowKey = (props as any)['data-row-key'] as string
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: rowKey,
        disabled: !draggable,
    })
    const style: React.CSSProperties = {
        ...(props.style || {}),
        transform: CSS.Transform.toString(transform ? { ...transform, scaleY: 1 } : transform),
        transition,
        ...(isDragging ? { position: 'relative', zIndex: 999, background: 'var(--ant-color-bg-container)' } : {}),
    }

    return (
        <tr {...props} ref={setNodeRef} style={style}>
            {React.Children.map(children, (child: any) => {
                if (child?.key === 'drag-handle') {
                    return React.cloneElement(child, {
                        children: draggable ? (
                            <HolderOutlined
                                {...attributes}
                                {...listeners}
                                className="cursor-grab !text-slate-400 hover:!text-slate-600"
                            />
                        ) : null,
                    })
                }
                return child
            })}
        </tr>
    )
}

export default function TaskTable({
    tasks,
    onUpdate,
    onDelete,
    onAddComment,
    onToggleReaction,
    onSetMeta,
    onDeleteMeta,
    onReorderMeta,
    onReorderTasks,
    isRowEditable = () => true,
}: TaskTableProps) {
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [editSubmitting, setEditSubmitting] = useState(false)
    const [expandedMetaRows, setExpandedMetaRows] = useState<Record<string, boolean>>({})
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const handleEditSubmit = async (id: string, input: UpdateTaskInput) => {
        setEditSubmitting(true)
        try {
            await onUpdate(id, input)
            setEditingTask(null)
        } finally {
            setEditSubmitting(false)
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        if (!onReorderTasks) return
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = tasks.findIndex((t) => t.id === active.id)
        const newIndex = tasks.findIndex((t) => t.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return
        const reordered = arrayMove(tasks, oldIndex, newIndex)
        onReorderTasks(reordered.map((t) => t.id))
    }

    const columns: ColumnsType<Task> = [
        ...(onReorderTasks ? [{
            title: '',
            key: 'drag-handle',
            width: 32,
            render: () => null,
        }] : []),
        {
            title: 'Judul',
            dataIndex: 'title',
            key: 'title',
            render: (_, record) => (
                <div>
                    <div className="font-semibold !text-slate-800 dark:!text-slate-100">{record.title}</div>
                    {record.description ? (
                        <div className="text-xs !text-slate-500 dark:!text-slate-400 mt-0.5 max-w-md truncate">
                            {record.description}
                        </div>
                    ) : (
                        <div className="text-xs italic !text-slate-400 dark:!text-slate-500 mt-0.5">Tidak ada deskripsi</div>
                    )}
                </div>
            ),
        },
        {
            title: 'Info Tambahan',
            dataIndex: 'meta',
            key: 'meta',
            width: 260,
            render: (_, record) => {
                if (!record.meta.length) {
                    return <span className="text-xs italic !text-slate-400 dark:!text-slate-500">-</span>
                }
                const isExpanded = expandedMetaRows[record.id]
                const visible = isExpanded ? record.meta : record.meta.slice(0, META_PREVIEW_COUNT)
                const hidden = record.meta.length - META_PREVIEW_COUNT
                return (
                    <div className="flex flex-wrap items-center gap-1.5 max-w-[240px]">
                        {visible.map((m) => <MetaDisplay key={m.id} meta={m} compact />)}
                        {!isExpanded && hidden > 0 && (
                            <button
                                type="button"
                                onClick={() => setExpandedMetaRows((prev) => ({ ...prev, [record.id]: true }))}
                                className="text-xs !text-blue-600 hover:underline"
                            >
                                +{hidden}
                            </button>
                        )}
                    </div>
                )
            },
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 150,
            render: (_, record) => {
                const activeStatus = STATUS_OPTIONS.find((s) => s.value === record.status)
                if (!isRowEditable(record)) {
                    return <Tag color={activeStatus?.color || 'default'}>{activeStatus?.label || record.status}</Tag>
                }
                return (
                    <Select
                        value={record.status}
                        size="small"
                        options={STATUS_OPTIONS}
                        className="w-full"
                        onChange={(val) => onUpdate(record.id, { status: val })}
                    />
                )
            },
        },
        {
            title: 'Dibuat',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 160,
            render: (value: string) => (
                <span className="text-xs !text-slate-500 dark:!text-slate-400">
                    {new Date(value).toLocaleString('id-ID')}
                </span>
            ),
        },
        {
            title: 'Aksi',
            key: 'actions',
            width: 110,
            render: (_, record) => {
                if (!isRowEditable(record)) return null
                return (
                    <div className="flex items-center gap-1.5">
                        <Button size="small" icon={<EditOutlined />} onClick={() => setEditingTask(record)} />
                        <Popconfirm
                            title="Hapus Task"
                            description="Apakah Anda yakin ingin menghapus task ini?"
                            onConfirm={() => onDelete(record.id)}
                            okText="Ya"
                            cancelText="Tidak"
                            okButtonProps={{ danger: true }}
                        >
                            <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    </div>
                )
            },
        },
    ]

    const table = (
        <Table<Task>
            rowKey="id"
            columns={columns}
            dataSource={tasks}
            pagination={false}
            className="!bg-white dark:!bg-slate-900 rounded-xl overflow-hidden"
            components={onReorderTasks ? {
                body: {
                    row: (props: any) => (
                        <DraggableRow {...props} draggable={isRowEditable(tasks.find((t) => t.id === props['data-row-key'])!)} />
                    ),
                },
            } : undefined}
            expandable={{
                expandedRowRender: (record) => (
                    <div className="!bg-slate-50 dark:!bg-slate-950 p-4 rounded-lg !border !border-slate-100 dark:!border-slate-800 space-y-4">
                        <div>
                            <SubtaskList taskId={record.id} subtasks={record.subtasks || []} readOnly={!isRowEditable(record)} />
                        </div>
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                            <div className="text-xs font-semibold !text-slate-500 dark:!text-slate-400 uppercase mb-2">
                                Komentar ({record.comments?.length || 0})
                            </div>
                            <CommentThread
                                taskId={record.id}
                                comments={record.comments}
                                onAddComment={onAddComment}
                                onToggleReaction={onToggleReaction}
                            />
                        </div>
                    </div>
                ),
            }}
        />
    )

    return (
        <>
            {onReorderTasks ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                        {table}
                    </SortableContext>
                </DndContext>
            ) : table}

            <TaskEditModal
                open={!!editingTask}
                task={editingTask}
                onCancel={() => setEditingTask(null)}
                onSubmit={handleEditSubmit}
                onSetMeta={onSetMeta}
                onDeleteMeta={onDeleteMeta}
                onReorderMeta={onReorderMeta}
                loading={editSubmitting}
            />
        </>
    )
}
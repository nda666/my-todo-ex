import React, { useState } from 'react';

import {
    Button,
    Card,
    Popconfirm,
    Tag,
    Typography,
} from 'antd';

import {
    CommentOutlined,
    DeleteOutlined,
    EditOutlined,
    FieldTimeOutlined,
} from '@ant-design/icons';

import { STATUS_OPTIONS } from '../constants/taskStatus';
import { CloudinaryUploadResult } from '../lib/cloudinary';
import {
    MetaDraft,
    Task,
    TaskStatus,
} from '../types/task';
import TaskDetailModal from './TaskDetailModal';
import TaskEditModal from './TaskEditModal';

const { Title, Text } = Typography

interface TeamBoardTaskCardProps {
    task: Task
    editable: boolean
    onUpdate: (id: string, input: { title?: string; description?: string | null; status?: TaskStatus }) => void
    onDelete: (id: string) => Promise<void>
    onAddComment: (taskId: string, content: string, parentId: string | null, attachments: CloudinaryUploadResult[]) => Promise<void>
    onToggleReaction: (commentId: string, emoji: string) => void
    onSetMeta: (taskId: string, key: string, value: string | null, type: MetaDraft['type']) => Promise<{ id: string }>
    onDeleteMeta: (id: string) => Promise<void>
    onReorderMeta: (taskId: string, orderedIds: string[]) => void
}

export default function TeamBoardTaskCard({
    task, editable, onUpdate, onDelete, onAddComment, onToggleReaction, onSetMeta, onDeleteMeta, onReorderMeta,
}: TeamBoardTaskCardProps) {
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [updating, setUpdating] = useState(false)

    const activeStatus = STATUS_OPTIONS.find((s) => s.value === task.status)

    const handleEditSubmit = async (id: string, input: any) => {
        setUpdating(true)
        try {
            await onUpdate(id, input)
        } finally {
            setUpdating(false)
        }
    }

    return (
        <>
            <Card
                className="shadow-sm hover:shadow-md transition-shadow !border !border-slate-200 dark:!border-slate-800 !bg-white dark:!bg-slate-900 rounded-xl mb-3"
                bodyStyle={{ padding: '1rem' }}
            >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <Title level={5} className="!mb-0 font-semibold !text-slate-800 dark:!text-slate-100 truncate">
                        {task.title}
                    </Title>
                    <Tag color={activeStatus?.color || 'default'} className="shrink-0">{activeStatus?.label || task.status}</Tag>
                </div>

                {task.description ? (
                    <Text className="text-xs !text-slate-500 dark:!text-slate-400 block truncate">{task.description}</Text>
                ) : (
                    <Text className="text-xs italic !text-slate-400 dark:!text-slate-500 block">Tidak ada deskripsi.</Text>
                )}

                <div className="flex items-center gap-1.5 mt-2 text-[10px] !text-slate-400 dark:!text-slate-500">
                    <FieldTimeOutlined />
                    <span>{new Date(task.createdAt).toLocaleDateString('id-ID')}</span>
                </div>

                <div className="flex items-center gap-1.5 mt-3">
                    <Button size="small" icon={<CommentOutlined />} onClick={() => setIsDetailOpen(true)}>
                        {task.comments?.length || 0}
                    </Button>
                    {editable && (
                        <>
                            <Button size="small" icon={<EditOutlined />} onClick={() => setIsEditOpen(true)} />
                            <Popconfirm
                                title="Hapus Task"
                                description="Apakah Anda yakin ingin menghapus task ini?"
                                onConfirm={() => onDelete(task.id)}
                                okText="Ya"
                                cancelText="Tidak"
                                okButtonProps={{ danger: true }}
                            >
                                <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </>
                    )}
                </div>
            </Card>

            <TaskDetailModal
                open={isDetailOpen}
                task={task}
                onClose={() => setIsDetailOpen(false)}
                readOnly={!editable}
                onAddComment={onAddComment}
                onToggleReaction={onToggleReaction}
            />

            {editable && (
                <TaskEditModal
                    open={isEditOpen}
                    task={task}
                    onCancel={() => setIsEditOpen(false)}
                    onSubmit={async (id, input) => {
                        await handleEditSubmit(id, input)
                        setIsEditOpen(false)
                    }}
                    onSetMeta={onSetMeta}
                    onDeleteMeta={onDeleteMeta}
                    onReorderMeta={onReorderMeta}
                    loading={updating}
                />
            )}
        </>
    )
}
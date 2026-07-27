import React, { useState } from 'react';

import {
    Avatar,
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
    UserOutlined,
} from '@ant-design/icons';

import { STATUS_OPTIONS } from '../constants/taskStatus';
import { CloudinaryUploadResult } from '../lib/cloudinary';
import {
    Colleague,
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
    members?: Colleague[]
    onUpdate: (id: string, input: { title?: string; description?: string | null; status?: TaskStatus; targetUserKode?: string }) => void
    onDelete: (id: string) => Promise<void>
    onAddComment: (taskId: string, content: string, parentId: string | null, attachments: CloudinaryUploadResult[]) => Promise<void>
    onToggleReaction: (commentId: string, emoji: string) => void
    onSetMeta: (taskId: string, key: string, value: string | null, type: MetaDraft['type']) => Promise<{ id: string }>
    onDeleteMeta: (id: string) => Promise<void>
    onReorderMeta: (taskId: string, orderedIds: string[]) => void
}

export default function TeamBoardTaskCard({
    task, editable, members, onUpdate, onDelete, onAddComment, onToggleReaction, onSetMeta, onDeleteMeta, onReorderMeta,
}: TeamBoardTaskCardProps) {
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [updating, setUpdating] = useState(false)

    const activeStatus = STATUS_OPTIONS.find((s) => s.value === task.status)
    const assignee = members?.find((m) => m.kodeku === task.userKode)

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

                <div className="flex items-center justify-between gap-1.5 mt-3 text-[10px] !text-slate-400 dark:!text-slate-500">
                    <div className="flex items-center gap-1">
                        <FieldTimeOutlined />
                        <span>{new Date(task.createdAt).toLocaleDateString('id-ID')}</span>
                    </div>

                    {assignee && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">
                            <Avatar size={14} src={assignee.avatarUrl} icon={!assignee.avatarUrl && <UserOutlined />} className="!bg-blue-200" />
                            <span className="truncate max-w-[80px] font-medium">{assignee.nama}</span>
                        </div>
                    )}
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
                members={members}
                onReassign={async (taskId, targetUserKode) => {
                    await onUpdate(taskId, { targetUserKode })
                }}
                onAddComment={onAddComment}
                onToggleReaction={onToggleReaction}
            />

            {editable && (
                <TaskEditModal
                    open={isEditOpen}
                    task={task}
                    assignees={members}
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
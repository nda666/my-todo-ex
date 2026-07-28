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
    LockOutlined,
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
import { getTaskPriority } from '../utils/taskPriority';
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
    const priority = getTaskPriority(task)

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
            <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500 shadow-2xs hover:shadow-xs transition-all duration-150 rounded-xl p-3.5 mb-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Title level={5} className="!mb-0 font-semibold !text-slate-800 dark:!text-slate-100 truncate">
                            {task.title}
                        </Title>
                        {task.meta?.some((m) => (m.key === 'dependsOn' || m.key === 'blockedBy') && m.value) && (
                            <Tag color="red" className="shrink-0 text-[10px] font-bold px-1.5 py-0 rounded flex items-center gap-0.5">
                                <LockOutlined /> BLOCKED
                            </Tag>
                        )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Tag color={priority.tagColor} className="m-0 text-[10px] font-semibold px-1.5 py-0 rounded">
                            {priority.label}
                        </Tag>
                        <Tag color={activeStatus?.color || 'default'} className="m-0 text-[10px]">{activeStatus?.label || task.status}</Tag>
                    </div>
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
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 border border-slate-200/50 dark:border-slate-600/50 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">
                            <Avatar size={14} src={assignee.avatarUrl} icon={!assignee.avatarUrl && <UserOutlined />} className="!bg-blue-200" />
                            <span className="truncate max-w-[80px] font-medium">{assignee.nama}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1.5 mt-3">
                    <Button
                        size="small"
                        icon={<CommentOutlined />}
                        onClick={() => setIsDetailOpen(true)}
                        className="!text-slate-600 dark:!text-slate-300 !border-slate-200 dark:!border-slate-700 !bg-slate-50 dark:!bg-slate-700/50 hover:!bg-slate-100 dark:hover:!bg-slate-700"
                    >
                        {task.comments?.length || 0}
                    </Button>
                    {editable && (
                        <>
                            <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => setIsEditOpen(true)}
                                className="!text-slate-600 dark:!text-slate-300 !border-slate-200 dark:!border-slate-700 !bg-slate-50 dark:!bg-slate-700/50 hover:!bg-slate-100 dark:hover:!bg-slate-700"
                            />
                            <Popconfirm
                                title="Hapus Task"
                                description="Apakah Anda yakin ingin menghapus task ini?"
                                onConfirm={() => onDelete(task.id)}
                                okText="Ya"
                                cancelText="Tidak"
                                okButtonProps={{ danger: true }}
                            >
                                <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    className="!border-red-200 dark:!border-red-900/50 !bg-red-50 dark:!bg-red-950/30 !text-red-600 dark:!text-red-400 hover:!bg-red-100 dark:hover:!bg-red-900/50"
                                />
                            </Popconfirm>
                        </>
                    )}
                </div>
            </div>

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
import React, { useState } from 'react';

import {
    Avatar,
    Button,
    Popconfirm,
    Tag,
    Typography,
} from 'antd';

import {
    CommentOutlined,
    CrownOutlined,
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
    const creator = members?.find((m) => m.kodeku === task.createdBy)
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
            <div
                className={`bg-white dark:bg-slate-850/90 border transition-all duration-200 rounded-2xl p-4 mb-3.5 shadow-xs hover:shadow-md ${task.meta?.some((m) => (m.key === 'dependsOn' || m.key === 'blockedBy') && m.value)
                        ? 'border-red-300 dark:border-red-900/80 bg-red-50/20 dark:bg-red-950/10'
                        : 'border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
            >
                {/* Header: Title & Badges */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <Title
                                level={5}
                                className="!mb-0 font-bold !text-slate-900 dark:!text-slate-100 text-sm tracking-tight leading-snug truncate"
                            >
                                {task.title}
                            </Title>
                            {task.meta?.some((m) => (m.key === 'dependsOn' || m.key === 'blockedBy') && m.value) && (
                                <Tag color="red" className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 m-0">
                                    <LockOutlined /> BLOCKED
                                </Tag>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        <Tag color={priority.tagColor} className="m-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {priority.label}
                        </Tag>
                        <Tag color={activeStatus?.color || 'default'} className="m-0 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            {activeStatus?.label || task.status}
                        </Tag>
                    </div>
                </div>

                {/* Task Description */}
                {task.description ? (
                    <Text className="text-xs !text-slate-600 dark:!text-slate-300 block line-clamp-2 mb-3 leading-relaxed">
                        {task.description}
                    </Text>
                ) : (
                    <Text className="text-xs italic !text-slate-400 dark:!text-slate-500 block mb-3">
                        Tidak ada deskripsi task.
                    </Text>
                )}

                {/* Footer Meta: Time, Creator, & Assignee */}
                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] !text-slate-500 dark:!text-slate-400 flex-wrap">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <FieldTimeOutlined className="text-slate-400" />
                        <span>{new Date(task.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {creator && (
                            <Tag icon={<CrownOutlined />} color={creator.statusLeader === 1 ? 'purple' : 'geekblue'} className="m-0 text-[10px] rounded-full px-2">
                                {creator.nama}
                            </Tag>
                        )}
                        {assignee ? (
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/80 px-2 py-0.5 rounded-full text-slate-700 dark:text-slate-200 text-[10px] font-medium shadow-2xs">
                                <Avatar size={14} src={assignee.avatarUrl} icon={!assignee.avatarUrl && <UserOutlined />} className="!bg-blue-500 text-white" />
                                <span className="truncate max-w-[80px]">{assignee.nama}</span>
                            </div>
                        ) : (
                            <span className="text-[10px] italic text-slate-400">Belum ditugaskan</span>
                        )}
                    </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-2">
                    <Button
                        size="small"
                        icon={<CommentOutlined />}
                        onClick={() => setIsDetailOpen(true)}
                        className="!text-slate-600 dark:!text-slate-300 !border-slate-200/80 dark:!border-slate-700 !bg-slate-50 dark:!bg-slate-800/80 hover:!bg-slate-100 dark:hover:!bg-slate-700 rounded-lg text-xs"
                    >
                        {task.comments?.length || 0} komentar
                    </Button>

                    {editable && (
                        <div className="flex items-center gap-1">
                            <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => setIsEditOpen(true)}
                                className="!text-slate-600 dark:!text-slate-300 !border-slate-200/80 dark:!border-slate-700 !bg-slate-50 dark:!bg-slate-800/80 hover:!bg-slate-100 dark:hover:!bg-slate-700 rounded-lg"
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
                                    className="!border-red-200 dark:!border-red-900/50 !bg-red-50 dark:!bg-red-950/30 !text-red-600 dark:!text-red-400 hover:!bg-red-100 dark:hover:!bg-red-900/50 rounded-lg"
                                />
                            </Popconfirm>
                        </div>
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
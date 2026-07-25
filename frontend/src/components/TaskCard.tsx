import React, { useState } from 'react';

import {
    Button,
    Card,
    Popconfirm,
    Select,
    Tag,
    Typography,
} from 'antd';

import {
    CommentOutlined,
    DeleteOutlined,
    EditOutlined,
    FieldTimeOutlined,
    UnorderedListOutlined,
} from '@ant-design/icons';

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

const { Title, Text, Paragraph } = Typography

const META_PREVIEW_COUNT = 5

interface UpdateTaskInput {
    title?: string
    description?: string | null
    status?: TaskStatus
}

interface TaskCardProps {
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

export default function TaskCard({
    task,
    onUpdate,
    onDelete,
    onAddComment,
    onToggleReaction,
    onSetMeta,
    onDeleteMeta,
    onReorderMeta,
    readOnly = false,
}: TaskCardProps) {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [updating, setUpdating] = useState(false)
    const [showAllMeta, setShowAllMeta] = useState(false)
    const [showComments, setShowComments] = useState(false)
    const [showSubtasks, setShowSubtasks] = useState(false)

    const activeStatus = STATUS_OPTIONS.find((s) => s.value === task.status)
    const visibleMeta = showAllMeta ? task.meta : task.meta.slice(0, META_PREVIEW_COUNT)
    const hiddenMetaCount = task.meta.length - META_PREVIEW_COUNT

    const handleEditSubmit = async (id: string, input: UpdateTaskInput) => {
        setUpdating(true)
        try {
            await onUpdate(id, input)
        } finally {
            setUpdating(false)
        }
    }

    return (
        <Card
            className="shadow-sm hover:shadow-md transition-shadow duration-200 !border !border-slate-200 dark:!border-slate-800 !bg-white dark:!bg-slate-900 rounded-xl overflow-hidden mb-4"
            bodyStyle={{ padding: '1.5rem' }}
        >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Title level={4} className="!mb-0 font-semibold !text-slate-800 dark:!text-slate-100">
                            {task.title}
                        </Title>
                        <Tag color={activeStatus?.color || 'default'} className="font-medium rounded-full px-2.5">
                            {activeStatus?.label || task.status}
                        </Tag>
                        {readOnly && (
                            <Tag color="default" className="font-medium rounded-full px-2.5">
                                Read-only
                            </Tag>
                        )}
                    </div>
                    {task.description ? (
                        <Paragraph className="!text-slate-600 dark:!text-slate-400 mb-0 max-w-2xl whitespace-pre-wrap font-light">
                            {task.description}
                        </Paragraph>
                    ) : (
                        <Text italic className="!text-slate-400 dark:!text-slate-500 text-sm">
                            Tidak ada deskripsi.
                        </Text>
                    )}

                    {/* Info Tambahan - selalu tampil, terpisah dari komentar */}
                    {task.meta.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            {visibleMeta.map((m) => <MetaDisplay key={m.id} meta={m} compact />)}
                            {!showAllMeta && hiddenMetaCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllMeta(true)}
                                    className="text-xs !text-blue-600 hover:underline"
                                >
                                    +{hiddenMetaCount} lainnya
                                </button>
                            )}
                            {showAllMeta && task.meta.length > META_PREVIEW_COUNT && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllMeta(false)}
                                    className="text-xs !text-slate-500 hover:underline"
                                >
                                    Sembunyikan
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 mt-3 text-xs !text-slate-400 dark:!text-slate-500">
                        <FieldTimeOutlined />
                        <span>Dibuat: {new Date(task.createdAt).toLocaleString('id-ID')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap md:flex-nowrap !border-t md:!border-t-0 pt-4 md:pt-0 !border-slate-100 dark:!border-slate-800">
                    {readOnly ? (
                        <Tag color={activeStatus?.color || 'default'} className="font-medium rounded-full px-3 py-1">
                            {activeStatus?.label || task.status}
                        </Tag>
                    ) : (
                        <Select
                            value={task.status}
                            onChange={(val) => onUpdate(task.id, { status: val })}
                            options={STATUS_OPTIONS}
                            className="w-36"
                            popupClassName="dark:!bg-slate-900"
                        />
                    )}

                    {!readOnly && (
                        <Button type="default" onClick={() => setIsEditModalOpen(true)} icon={<EditOutlined />}>
                            Edit
                        </Button>
                    )}

                    <Button type="dashed" onClick={() => setShowSubtasks(!showSubtasks)} icon={<UnorderedListOutlined />}>
                        Subtask ({task.subtasks?.filter((s) => s.status === 'COMPLETED').length || 0}/{task.subtasks?.length || 0})
                    </Button>

                    <Button type="dashed" onClick={() => setShowComments(!showComments)} icon={<CommentOutlined />}>
                        {showComments ? 'Tutup Komentar' : `Komentar (${task.comments?.length || 0})`}
                    </Button>

                    {!readOnly && (
                        <Popconfirm
                            title="Hapus Task"
                            description="Apakah Anda yakin ingin menghapus task ini?"
                            onConfirm={() => onDelete(task.id)}
                            okText="Ya"
                            cancelText="Tidak"
                            okButtonProps={{ danger: true }}
                        >
                            <Button type="primary" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    )}
                </div>
            </div>

            {showSubtasks && (
                <div className="mt-6 pt-6 !border-t !border-slate-100 dark:!border-slate-800 animate-fadeIn">
                    <SubtaskList taskId={task.id} subtasks={task.subtasks || []} readOnly={readOnly} />
                </div>
            )}

            {showComments && (
                <div className="mt-6 pt-6 !border-t !border-slate-100 dark:!border-slate-800 animate-fadeIn">
                    <CommentThread
                        taskId={task.id}
                        comments={task.comments}
                        onAddComment={onAddComment}
                        onToggleReaction={onToggleReaction}
                    />
                </div>
            )}

            <TaskEditModal
                open={isEditModalOpen}
                task={task}
                onCancel={() => setIsEditModalOpen(false)}
                onSubmit={async (id, input) => {
                    await handleEditSubmit(id, input)
                    setIsEditModalOpen(false)
                }}
                onSetMeta={onSetMeta}
                onDeleteMeta={onDeleteMeta}
                onReorderMeta={onReorderMeta}
                loading={updating}
            />
        </Card>
    )
}
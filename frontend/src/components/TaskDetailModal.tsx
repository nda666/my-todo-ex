import React from 'react';

import {
    Modal,
    Tag,
    Typography,
} from 'antd';

import { CommentOutlined } from '@ant-design/icons';

import { STATUS_OPTIONS } from '../constants/taskStatus';
import { CloudinaryUploadResult } from '../lib/cloudinary';
import { Task } from '../types/task';
import CommentThread from './CommentThread';
import MetaDisplay from './MetaDisplay';
import SubtaskList from './SubtaskList';

const { Title, Paragraph, Text } = Typography

interface TaskDetailModalProps {
    open: boolean
    task: Task | null
    onClose: () => void
    readOnly: boolean
    onAddComment: (taskId: string, content: string, parentId: string | null, attachments: CloudinaryUploadResult[]) => Promise<void>
    onToggleReaction: (commentId: string, emoji: string) => void
}

export default function TaskDetailModal({ open, task, onClose, readOnly, onAddComment, onToggleReaction }: TaskDetailModalProps) {
    if (!task) return null
    const activeStatus = STATUS_OPTIONS.find((s) => s.value === task.status)

    return (
        <Modal open={open} onCancel={onClose} footer={null} width={640} destroyOnClose className="dark:!bg-slate-900">
            <div className="mb-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Title level={4} className="!mb-0 font-semibold !text-slate-800 dark:!text-slate-100">
                        {task.title}
                    </Title>
                    <Tag color={activeStatus?.color || 'default'}>{activeStatus?.label || task.status}</Tag>
                </div>
                {task.description ? (
                    <Paragraph className="!text-slate-600 dark:!text-slate-400 whitespace-pre-wrap font-light">
                        {task.description}
                    </Paragraph>
                ) : (
                    <Text italic className="!text-slate-400 dark:!text-slate-500 text-sm">Tidak ada deskripsi.</Text>
                )}
            </div>

            {task.meta.length > 0 && (
                <div className="mb-4">
                    <div className="text-xs font-semibold !text-slate-500 dark:!text-slate-400 uppercase mb-2">Info Tambahan</div>
                    <div className="flex flex-wrap gap-2">
                        {task.meta.map((m) => <MetaDisplay key={m.id} meta={m} compact />)}
                    </div>
                </div>
            )}

            <div className="mb-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <SubtaskList taskId={task.id} subtasks={task.subtasks || []} readOnly={readOnly} />
            </div>

            <div>
                <div className="flex items-center gap-2 mb-2">
                    <CommentOutlined className="!text-slate-500" />
                    <span className="text-xs font-semibold !text-slate-500 dark:!text-slate-400 uppercase">
                        Komentar ({task.comments?.length || 0})
                    </span>
                </div>
                <CommentThread
                    taskId={task.id}
                    comments={task.comments}
                    onAddComment={onAddComment}
                    onToggleReaction={onToggleReaction}
                />
            </div>
        </Modal>
    )
}
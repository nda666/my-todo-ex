import React from 'react';

import {
    Avatar,
    Modal,
    Select,
    Tag,
    Typography,
} from 'antd';

import { CommentOutlined, UserOutlined } from '@ant-design/icons';

import { STATUS_OPTIONS } from '../constants/taskStatus';
import { CloudinaryUploadResult } from '../lib/cloudinary';
import { Colleague, Task } from '../types/task';
import CommentThread from './CommentThread';
import MetaDisplay from './MetaDisplay';
import SubtaskList from './SubtaskList';

const { Title, Paragraph, Text } = Typography

interface TaskDetailModalProps {
    open: boolean
    task: Task | null
    onClose: () => void
    readOnly: boolean
    members?: Colleague[]
    onReassign?: (taskId: string, targetUserKode: string) => Promise<void>
    onAddComment: (taskId: string, content: string, parentId: string | null, attachments: CloudinaryUploadResult[]) => Promise<void>
    onToggleReaction: (commentId: string, emoji: string) => void
}

export default function TaskDetailModal({ open, task, onClose, readOnly, members, onReassign, onAddComment, onToggleReaction }: TaskDetailModalProps) {
    if (!task) return null
    const activeStatus = STATUS_OPTIONS.find((s) => s.value === task.status)
    const currentAssignee = members?.find((m) => m.kodeku === task.userKode)

    return (
        <Modal open={open} onCancel={onClose} footer={null} width={640} destroyOnClose className="dark:!bg-slate-900">
            <div className="mb-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Title level={4} className="!mb-0 font-semibold !text-slate-800 dark:!text-slate-100">
                        {task.title}
                    </Title>
                    <Tag color={activeStatus?.color || 'default'}>{activeStatus?.label || task.status}</Tag>
                </div>

                {members && members.length > 0 && (
                    <div className="flex items-center gap-2 my-2 text-xs">
                        <span className="text-slate-500 font-medium">Penanggung Jawab:</span>
                        {onReassign && !readOnly ? (
                            <Select
                                size="small"
                                className="w-52"
                                value={task.userKode}
                                onChange={(val) => onReassign(task.id, val)}
                                options={members.map((m) => ({
                                    label: m.nama,
                                    value: m.kodeku,
                                }))}
                            />
                        ) : (
                            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                                <Avatar size={16} src={currentAssignee?.avatarUrl} icon={!currentAssignee?.avatarUrl && <UserOutlined />} className="!bg-blue-500" />
                                <span className="font-medium text-slate-700 dark:text-slate-200">{currentAssignee?.nama || task.userKode || 'Unassigned'}</span>
                            </div>
                        )}
                    </div>
                )}

                {task.description ? (
                    <Paragraph className="!text-slate-600 dark:!text-slate-400 whitespace-pre-wrap font-light mt-2">
                        {task.description}
                    </Paragraph>
                ) : (
                    <Text italic className="!text-slate-400 dark:!text-slate-500 text-sm block mt-2">Tidak ada deskripsi.</Text>
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
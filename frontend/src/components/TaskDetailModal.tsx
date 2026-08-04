import React from 'react';

import {
    Avatar,
    message,
    Modal,
    Select,
    Tag,
    Typography,
} from 'antd';

import {
    CommentOutlined,
    CrownOutlined,
    UserOutlined,
} from '@ant-design/icons';

import { STATUS_OPTIONS } from '../constants/taskStatus';
import { CloudinaryUploadResult } from '../lib/cloudinary';
import {
    Colleague,
    Task,
} from '../types/task';
import { getTaskPriority } from '../utils/taskPriority';
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
    const creator = members?.find((m) => m.kodeku === task.createdBy)
    const priority = getTaskPriority(task)

    return (
        <Modal open={open} onCancel={onClose} footer={null} width={640} destroyOnClose className="dark:!bg-slate-900">
            <div className="mb-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Title level={4} className="!mb-0 font-semibold !text-slate-800 dark:!text-slate-100">
                        {task.title}
                    </Title>
                    {task.meta?.some((m) => (m.key === 'dependsOn' || m.key === 'blockedBy') && m.value) && (
                        <Tag color="red" className="font-bold rounded-full px-2.5">
                            BLOCKED
                        </Tag>
                    )}
                    <Tag color={priority.tagColor} className="font-semibold rounded-full px-2.5">
                        Prioritas: {priority.label}
                    </Tag>
                    <Tag color={activeStatus?.color || 'default'}>{activeStatus?.label || task.status}</Tag>
                </div>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 my-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-semibold">Penanggung Jawab:</span>
                        {onReassign ? (
                            <Select
                                size="small"
                                className="w-48"
                                value={task.userKode || undefined}
                                onChange={async (val) => {
                                    try {
                                        await onReassign(task.id, val);
                                        message.success('Task berhasil dilimpahkan ulang!');
                                    } catch (err: any) {
                                        message.error(err.message || 'Gagal reassign task');
                                    }
                                }}
                                options={members?.map((m) => ({
                                    label: m.nama,
                                    value: m.kodeku,
                                }))}
                            />
                        ) : (
                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                                <Avatar size={16} src={currentAssignee?.avatarUrl} icon={!currentAssignee?.avatarUrl && <UserOutlined />} className="!bg-blue-500" />
                                <span className="font-medium text-slate-700 dark:text-slate-200">{currentAssignee?.nama || task.userKode || 'Unassigned'}</span>
                            </div>
                        )}
                    </div>

                    {creator && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-semibold">Pembuat Task:</span>
                            <Tag icon={<CrownOutlined />} color={creator.statusLeader === 1 ? 'purple' : 'geekblue'} className="rounded-full px-2.5 py-0.5 font-medium m-0">
                                {creator.nama} {creator.statusLeader === 1 ? '👑' : ''}
                            </Tag>
                        </div>
                    )}
                </div>

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
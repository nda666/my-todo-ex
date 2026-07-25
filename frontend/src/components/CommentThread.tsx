import React, { useState } from 'react';

import {
    Avatar,
    Button,
    Input,
    message,
    Upload,
} from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
    CloseCircleOutlined,
    LoadingOutlined,
    PaperClipOutlined,
    SendOutlined,
    UserOutlined,
} from '@ant-design/icons';

import {
    CloudinaryUploadResult,
    uploadToCloudinary,
} from '../lib/cloudinary';
import { TaskComment } from '../types/task';

const { TextArea } = Input
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😢']
const MAX_ATTACHMENTS = 3

interface CommentThreadProps {
    taskId: string
    comments: TaskComment[]
    readOnly?: boolean
    onAddComment: (taskId: string, content: string, parentId: string | null, attachments: CloudinaryUploadResult[]) => Promise<void>
    onToggleReaction: (commentId: string, emoji: string) => void
}

function CommentComposer({
    onSubmit,
    placeholder = 'Tulis komentar (mendukung markdown)...',
    compact = false,
}: {
    onSubmit: (content: string, attachments: CloudinaryUploadResult[]) => Promise<void>
    placeholder?: string
    compact?: boolean
}) {
    const [content, setContent] = useState('')
    const [attachments, setAttachments] = useState<CloudinaryUploadResult[]>([])
    const [uploading, setUploading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const handleUpload = async (file: File) => {
        if (attachments.length >= MAX_ATTACHMENTS) {
            message.warning(`Maksimal ${MAX_ATTACHMENTS} lampiran per komentar.`)
            return false
        }
        setUploading(true)
        try {
            const result = await uploadToCloudinary(file)
            setAttachments((prev) => [...prev, result])
        } catch (err: any) {
            message.error(err.message || 'Gagal mengunggah file')
        } finally {
            setUploading(false)
        }
        return false
    }

    const handleSubmit = async () => {
        if (!content.trim() && attachments.length === 0) return
        setSubmitting(true)
        try {
            await onSubmit(content.trim(), attachments)
            setContent('')
            setAttachments([])
        } catch (err: any) {
            message.error(err.message || 'Gagal mengirim komentar')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <TextArea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                autoSize={{ minRows: compact ? 1 : 2, maxRows: 6 }}
            />
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {attachments.map((a, idx) => (
                        <div key={idx} className="flex items-center gap-1 !bg-slate-100 dark:!bg-slate-800 rounded px-2 py-1 text-xs">
                            <span className="truncate max-w-[120px]">{a.fileName}</span>
                            <CloseCircleOutlined
                                className="cursor-pointer !text-slate-400 hover:!text-red-500"
                                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                            />
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-center justify-between">
                <Upload beforeUpload={handleUpload} showUploadList={false} multiple={false}>
                    <Button
                        size="small"
                        type="text"
                        icon={uploading ? <LoadingOutlined /> : <PaperClipOutlined />}
                        disabled={attachments.length >= MAX_ATTACHMENTS}
                    >
                        Lampirkan
                    </Button>
                </Upload>
                <Button
                    type="primary"
                    size="small"
                    icon={<SendOutlined />}
                    loading={submitting}
                    onClick={handleSubmit}
                >
                    Kirim
                </Button>
            </div>
        </div>
    )
}

function CommentItem({
    comment,
    taskId,
    readOnly,
    onAddComment,
    onToggleReaction,
    isReply = false,
}: {
    comment: TaskComment
    taskId: string
    readOnly?: boolean
    onAddComment: CommentThreadProps['onAddComment']
    onToggleReaction: CommentThreadProps['onToggleReaction']
    isReply?: boolean
}) {
    const [showReplyBox, setShowReplyBox] = useState(false)

    return (
        <div className={isReply ? 'ml-8 mt-2' : 'mt-3'}>
            <div className="flex gap-2">
                <Avatar size={24} icon={<UserOutlined />} className="!bg-blue-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className="!bg-slate-50 dark:!bg-slate-950 !border !border-slate-100 dark:!border-slate-800 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs !text-blue-600 dark:!text-blue-400">{comment.userKode}</span>
                            <span className="text-[10px] !text-slate-400 dark:!text-slate-500">
                                {new Date(comment.createdAt).toLocaleString('id-ID')}
                            </span>
                        </div>
                        <div className="text-sm !text-slate-700 dark:!text-slate-300 prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
                        </div>
                        {comment.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {comment.attachments.map((a) => {
                                    const isImage = a.fileType?.startsWith('image/')
                                    return isImage ? (
                                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                                            <img src={a.url} alt={a.fileName} className="h-16 w-16 object-cover rounded !border !border-slate-200" />
                                        </a>
                                    ) : (
                                        <a
                                            key={a.id}
                                            href={a.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-1 !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded px-2 py-1 text-xs !text-blue-600"
                                        >
                                            <PaperClipOutlined /> {a.fileName}
                                        </a>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 px-1">
                        <div className="flex items-center gap-1">
                            {REACTION_EMOJIS.map((emoji) => {
                                const summary = comment.reactions.find((r) => r.emoji === emoji)
                                return (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => onToggleReaction(comment.id, emoji)}
                                        className={`text-xs rounded-full px-1.5 py-0.5 border transition-colors ${summary?.reacted
                                            ? '!bg-blue-50 dark:!bg-blue-950/40 !border-blue-300 dark:!border-blue-800'
                                            : '!border-transparent hover:!bg-slate-100 dark:hover:!bg-slate-800'
                                            }`}
                                    >
                                        {emoji} {summary?.count ? summary.count : ''}
                                    </button>
                                )
                            })}
                        </div>
                        {!readOnly && !isReply && (
                            <button
                                type="button"
                                onClick={() => setShowReplyBox(!showReplyBox)}
                                className="text-xs !text-slate-500 dark:!text-slate-400 hover:!text-blue-600"
                            >
                                Balas
                            </button>
                        )}
                    </div>

                    {showReplyBox && (
                        <div className="mt-2">
                            <CommentComposer
                                compact
                                placeholder="Tulis balasan..."
                                onSubmit={async (content, attachments) => {
                                    await onAddComment(taskId, content, comment.id, attachments)
                                    setShowReplyBox(false)
                                }}
                            />
                        </div>
                    )}

                    {comment.replies?.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            taskId={taskId}
                            readOnly={readOnly}
                            onAddComment={onAddComment}
                            onToggleReaction={onToggleReaction}
                            isReply
                        />
                    ))}
                </div>
            </div>
        </div >
    )
}

export default function CommentThread({
    taskId,
    comments,
    onAddComment,
    onToggleReaction,
}: CommentThreadProps) {
    return (
        <div>
            {comments.length === 0 ? (
                <div className="text-xs italic !text-slate-400 dark:!text-slate-500 text-center py-4">
                    Belum ada komentar.
                </div>
            ) : (
                <div className="max-h-96 overflow-y-auto pr-1">
                    {comments.map((comment) => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            taskId={taskId}
                            onAddComment={onAddComment}
                            onToggleReaction={onToggleReaction}
                        />
                    ))}
                </div>
            )}


            <div className="mt-3 pt-3 !border-t !border-slate-100 dark:!border-slate-800">
                <CommentComposer onSubmit={(content, attachments) => onAddComment(taskId, content, null, attachments)} />
            </div>
        </div>
    )
}
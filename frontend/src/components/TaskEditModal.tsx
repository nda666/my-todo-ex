import React, {
    useEffect,
    useState,
} from 'react';

import {
    Button,
    Form,
    Input,
    Modal,
    Select,
    Typography,
} from 'antd';
import { useQuery } from '@apollo/client';

import { STATUS_OPTIONS } from '../constants/taskStatus';
import { GET_COLLEAGUES, GET_TASKS } from '../lib/queries';
import {
    Colleague,
    MetaDraft,
    Task,
    TaskStatus,
} from '../types/task';
import { PRIORITY_OPTIONS, PriorityLevel } from '../utils/taskPriority';
import TaskMetaEditor from './TaskMetaEditor';
import SubtaskList from './SubtaskList';

const { Title } = Typography
const { TextArea } = Input

interface EditTaskFormValues {
    title: string
    description?: string
    status: TaskStatus
    targetUserKode?: string
    priority?: PriorityLevel
    dependsOnTaskId?: string
}

interface TaskEditModalProps {
    open: boolean
    task: Task | null
    assignees?: Colleague[]
    onCancel: () => void
    onSubmit: (id: string, values: { title: string; description?: string | null; status: TaskStatus; targetUserKode?: string; meta?: Array<{ key: string; value?: string | null; type: MetaDraft['type'] }> }) => Promise<void>
    onSetMeta?: (taskId: string, key: string, value: string | null, type: MetaDraft['type']) => Promise<{ id: string }>
    onDeleteMeta?: (id: string) => Promise<void>
    onReorderMeta?: (taskId: string, orderedIds: string[]) => void
    loading: boolean
}

export default function TaskEditModal({ open, task, assignees, onCancel, onSubmit, loading }: TaskEditModalProps) {
    const [form] = Form.useForm<EditTaskFormValues>()
    const [metaItems, setMetaItems] = useState<MetaDraft[]>([])

    const { data: colleaguesData, loading: loadingColleagues } = useQuery(GET_COLLEAGUES, {
        skip: !open || !!assignees,
    })
    const { data: projectTasksData, loading: loadingTasks } = useQuery(GET_TASKS, {
        variables: { limit: 100, projectId: task?.projectId || undefined },
        skip: !open || !task,
    })

    const availableAssignees: Colleague[] = assignees || colleaguesData?.colleagues || []
    const availableTasks: Task[] = (projectTasksData?.tasks?.tasks || []).filter((t: Task) => t.id !== task?.id)

    useEffect(() => {
        if (task && open) {
            const dependsOnVal = task.meta?.find((m) => m.key === 'dependsOn' || m.key === 'blockedBy')?.value || undefined
            const priorityVal = (task.priority || task.meta?.find((m) => m.key.toLowerCase() === 'priority' || m.key.toLowerCase() === 'prioritas')?.value || 'MEDIUM').toUpperCase() as PriorityLevel

            form.setFieldsValue({
                title: task.title,
                description: task.description || undefined,
                status: task.status,
                targetUserKode: task.userKode || undefined,
                priority: priorityVal,
                dependsOnTaskId: dependsOnVal,
            })
            setMetaItems(
                (task.meta || []).map((m) => ({
                    draftId: m.id,
                    id: m.id,
                    key: m.key,
                    value: m.value || '',
                    type: m.type,
                }))
            )
        }
    }, [task, open, form])

    const handleFinish = async (values: EditTaskFormValues) => {
        if (!task) return

        let filteredMeta = metaItems.filter((item) => item.key.trim() && item.key.toLowerCase() !== 'priority' && item.key !== 'dependsOn')

        if (values.priority) {
            filteredMeta.push({
                draftId: 'meta-priority-' + Date.now(),
                key: 'priority',
                value: values.priority,
                type: 'TEXT',
            })
        }

        if (values.dependsOnTaskId) {
            filteredMeta.push({
                draftId: 'meta-dependsOn-' + Date.now(),
                key: 'dependsOn',
                value: values.dependsOnTaskId,
                type: 'TEXT',
            })
        }

        const formattedMeta = filteredMeta.map((item) => ({
            key: item.key.trim(),
            value: item.value || null,
            type: item.type,
        }))

        await onSubmit(task.id, {
            title: values.title.trim(),
            description: values.description?.trim() || null,
            status: values.status,
            priority: values.priority,
            targetUserKode: values.targetUserKode || undefined,
            meta: formattedMeta,
        })
    }

    return (
        <Modal
            title={
                <Title level={4} className="!mb-0 font-bold tracking-tight !text-slate-800 dark:!text-slate-100">
                    Edit Task
                </Title>
            }
            open={open}
            onCancel={onCancel}
            footer={null}
            destroyOnClose
            className="dark:!bg-slate-900"
            width={560}
        >
            <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false} className="mt-4">
                <Form.Item
                    name="title"
                    label="Judul Task"
                    rules={[{ required: true, message: 'Judul task tidak boleh kosong!' }]}
                >
                    <Input size="large" className="rounded-lg" />
                </Form.Item>

                <Form.Item name="targetUserKode" label="Penanggung Jawab / Assignee">
                    <Select
                        placeholder="Pilih assignee..."
                        allowClear
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                        loading={loadingColleagues}
                        options={availableAssignees.map((c) => ({
                            label: `${c.nama}${c.jabatan?.nama ? ` (${c.jabatan.nama})` : ''}`,
                            value: c.kodeku,
                        }))}
                        className="w-full"
                        size="large"
                    />
                </Form.Item>

                <Form.Item name="description" label="Deskripsi">
                    <TextArea rows={3} placeholder="Masukkan deskripsi task..." className="rounded-lg" />
                </Form.Item>

                <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                    <Select options={STATUS_OPTIONS} className="w-full" size="large" />
                </Form.Item>

                <Form.Item name="priority" label="Prioritas Task">
                    <Select options={PRIORITY_OPTIONS} className="w-full" size="large" />
                </Form.Item>

                <Form.Item name="dependsOnTaskId" label="Terhalang oleh / Depends On (Opsional)">
                    <Select
                        placeholder="Pilih task prasyarat yang harus selesai dulu..."
                        allowClear
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                        loading={loadingTasks}
                        options={availableTasks.map((t) => ({
                            label: `${t.title} [${t.status}]`,
                            value: t.id,
                        }))}
                        className="w-full"
                        size="large"
                    />
                </Form.Item>

                {task && (
                    <div className="mb-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <SubtaskList taskId={task.id} subtasks={task.subtasks || []} />
                    </div>
                )}

                <div className="mb-4">
                    <TaskMetaEditor items={metaItems} onChange={setMetaItems} />
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-4 !border-t !border-slate-100 dark:!border-slate-800">
                    <Button onClick={onCancel} size="large" className="rounded-lg">
                        Batal
                    </Button>
                    <Button type="primary" htmlType="submit" loading={loading} size="large" className="rounded-lg px-6 font-medium">
                        Simpan
                    </Button>
                </div>
            </Form>
        </Modal>
    )
}
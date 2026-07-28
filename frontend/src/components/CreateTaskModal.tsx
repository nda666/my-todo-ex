import React from 'react';

import { PlusOutlined, DeleteOutlined, UnorderedListOutlined } from '@ant-design/icons';
import {
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Typography,
} from 'antd';
import { Dayjs } from 'dayjs';
import { useQuery } from '@apollo/client';

import { GET_COLLEAGUES, GET_PROJECTS, GET_TASKS } from '../lib/queries';
import { Project } from '../types/project';
import { Colleague, MetaDraft, Task } from '../types/task';
import { PRIORITY_OPTIONS, PriorityLevel } from '../utils/taskPriority';
import TaskMetaEditor from './TaskMetaEditor';

const { Title } = Typography
const { TextArea } = Input

interface CreateTaskModalProps {
  open: boolean
  onCancel: () => void
  onCreate: (values: {
    title: string
    description?: string
    targetUserKode?: string
    priority?: PriorityLevel
    meta: MetaDraft[]
    startDate?: string
    dueDate?: string
    projectId?: string | null
    subtasks?: string[]
  }) => Promise<void>
  loading: boolean
  initialProjectId?: string
  assignees?: Colleague[]
}

export default function CreateTaskModal({ open, onCancel, onCreate, loading, initialProjectId, assignees }: CreateTaskModalProps) {
  const [form] = Form.useForm()
  const [metaItems, setMetaItems] = React.useState<MetaDraft[]>([])
  const [startDate, setStartDate] = React.useState<Dayjs | null>(null)
  const [dueDate, setDueDate] = React.useState<Dayjs | null>(null)
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(initialProjectId || null)
  const [selectedTargetUser, setSelectedTargetUser] = React.useState<string | undefined>(undefined)
  const [dependsOnTaskId, setDependsOnTaskId] = React.useState<string | null>(null)
  const [priority, setPriority] = React.useState<PriorityLevel>('MEDIUM')
  const [subtasks, setSubtasks] = React.useState<string[]>([])
  const [newSubtaskText, setNewSubtaskText] = React.useState('')

  const { data: projectsData, loading: loadingProjects } = useQuery(GET_PROJECTS, {
    skip: !open,
  })
  const { data: colleaguesData, loading: loadingColleagues } = useQuery(GET_COLLEAGUES, {
    skip: !open || !!assignees,
  })
  const { data: projectTasksData, loading: loadingTasks } = useQuery(GET_TASKS, {
    variables: { limit: 100, projectId: selectedProjectId || undefined },
    skip: !open,
  })

  const projects: Project[] = projectsData?.projects || []
  const availableAssignees: Colleague[] = assignees || colleaguesData?.colleagues || []
  const availableTasks: Task[] = projectTasksData?.tasks?.tasks || []

  React.useEffect(() => {
    if (open) {
      setSelectedProjectId(initialProjectId || null)
      setSelectedTargetUser(undefined)
      setDependsOnTaskId(null)
    }
  }, [open, initialProjectId])

  const resetLocalState = () => {
    setMetaItems([])
    setStartDate(null)
    setDueDate(null)
    setSelectedProjectId(initialProjectId || null)
    setSelectedTargetUser(undefined)
    setDependsOnTaskId(null)
    setPriority('MEDIUM')
    setSubtasks([])
    setNewSubtaskText('')
  }

  const handleAddSubtask = () => {
    const trimmed = newSubtaskText.trim()
    if (trimmed) {
      setSubtasks([...subtasks, trimmed])
      setNewSubtaskText('')
    }
  }

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index))
  }

  const handleFinish = async (values: { title: string; description?: string }) => {
    const allSubtasks = [...subtasks]
    if (newSubtaskText.trim()) {
      allSubtasks.push(newSubtaskText.trim())
    }

    let finalMeta = [...metaItems]
    finalMeta = finalMeta.filter((m) => m.key !== 'priority' && m.key !== 'dependsOn')

    finalMeta.push({
      draftId: 'meta-priority-' + Date.now(),
      key: 'priority',
      value: priority,
      type: 'TEXT',
    })

    if (dependsOnTaskId) {
      finalMeta.push({
        draftId: 'meta-dependsOn-' + Date.now(),
        key: 'dependsOn',
        value: dependsOnTaskId,
        type: 'TEXT',
      })
    }

    await onCreate({
      title: values.title,
      description: values.description,
      targetUserKode: selectedTargetUser,
      priority: priority,
      meta: finalMeta,
      startDate: startDate?.format('YYYY-MM-DD'),
      dueDate: dueDate?.format('YYYY-MM-DD'),
      projectId: selectedProjectId,
      subtasks: allSubtasks,
    })
    form.resetFields()
    resetLocalState()
  }

  const handleCancel = () => {
    onCancel()
    form.resetFields()
    resetLocalState()
  }

  return (
    <Modal
      title={<Title level={4} className="!mb-0 font-bold tracking-tight !text-slate-800 dark:!text-slate-100">Tambah Task Baru</Title>}
      open={open}
      onCancel={handleCancel}
      footer={null}
      destroyOnClose
      width={560}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false} className="mt-4">
        <Form.Item name="title" label="Judul Task" rules={[{ required: true, message: 'Judul task wajib diisi!' }]}>
          <Input placeholder="Masukkan judul tugas..." size="large" className="rounded-lg" />
        </Form.Item>

        <Form.Item label="Penanggung Jawab / Assignee (Opsional)">
          <Select
            placeholder="Pilih pegawai / bawahan..."
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
            loading={loadingColleagues}
            value={selectedTargetUser}
            onChange={(val) => setSelectedTargetUser(val || undefined)}
            options={availableAssignees.map((c) => ({
              label: `${c.nama}${c.jabatan?.nama ? ` (${c.jabatan.nama})` : ''}`,
              value: c.kodeku,
            }))}
            className="w-full"
            size="large"
          />
        </Form.Item>

        <Form.Item label="Project (Opsional)">
          <Select
            placeholder="Pilih project (bisa tanpa project)"
            allowClear
            loading={loadingProjects}
            value={selectedProjectId}
            onChange={(val) => setSelectedProjectId(val || null)}
            options={[
              { label: 'Tanpa Project', value: null },
              ...projects
                .filter((p) => p.status === 'active')
                .map((p) => ({
                  label: p.name,
                  value: p.id,
                })),
            ]}
            className="w-full"
            size="large"
          />
        </Form.Item>

        <Form.Item label="Prioritas Task">
          <Select
            value={priority}
            onChange={(val) => setPriority(val as PriorityLevel)}
            options={PRIORITY_OPTIONS}
            className="w-full"
            size="large"
          />
        </Form.Item>

        <Form.Item label="Terhalang oleh / Depends On (Opsional)">
          <Select
            placeholder="Pilih task prasyarat yang harus selesai dulu..."
            allowClear
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
            loading={loadingTasks}
            value={dependsOnTaskId}
            onChange={(val) => setDependsOnTaskId(val || null)}
            options={availableTasks.map((t) => ({
              label: `${t.title} [${t.status}]`,
              value: t.id,
            }))}
            className="w-full"
            size="large"
          />
        </Form.Item>

        <Form.Item name="description" label="Deskripsi">
          <TextArea rows={3} placeholder="Masukkan deskripsi tugas secara detail..." className="rounded-lg" />
        </Form.Item>

        <div className="grid grid-cols-2 gap-3">
          <Form.Item label="Tanggal Mulai (opsional)">
            <DatePicker
              className="w-full"
              format="DD/MM/YYYY"
              placeholder="Mulai"
              value={startDate}
              onChange={(date) => {
                setStartDate(date)
                // kalau start baru digeser lewat due yang sudah ada, geser due-nya juga
                if (date && dueDate && date.isAfter(dueDate, 'day')) {
                  setDueDate(null)
                }
              }}
              disabledDate={(current) => !!dueDate && !!current && current.isAfter(dueDate, 'day')}
            />
          </Form.Item>
          <Form.Item label="Target Selesai (opsional)">
            <DatePicker
              className="w-full"
              format="DD/MM/YYYY"
              placeholder="Target selesai"
              value={dueDate}
              onChange={setDueDate}
              disabledDate={(current) => !!startDate && !!current && current.isBefore(startDate, 'day')}
            />
          </Form.Item>
        </div>

        <div className="mb-4">
          <Form.Item label="Subtasks (opsional)" className="!mb-2">
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Tambah subtask..."
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onPressEnter={(e) => {
                  e.preventDefault()
                  handleAddSubtask()
                }}
                className="rounded-lg"
              />
              <Button onClick={handleAddSubtask} icon={<PlusOutlined />} className="rounded-lg">
                Tambah
              </Button>
            </div>
          </Form.Item>

          {subtasks.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {subtasks.map((st, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-sm"
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200 truncate">
                    <UnorderedListOutlined className="text-slate-400" />
                    {st}
                  </span>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveSubtask(idx)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <TaskMetaEditor items={metaItems} onChange={setMetaItems} />
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 !border-t !border-slate-100 dark:!border-slate-800">
          <Button onClick={handleCancel} size="large" className="rounded-lg">Batal</Button>
          <Button type="primary" htmlType="submit" loading={loading} size="large" className="rounded-lg px-6 font-medium">Tambah</Button>
        </div>
      </Form>
    </Modal>
  )
}
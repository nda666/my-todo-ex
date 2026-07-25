import React from 'react';

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

import {
  DeleteOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useQuery } from '@apollo/client';

import { GET_PROJECTS } from '../lib/queries';
import { Project } from '../types/project';
import { MetaDraft } from '../types/task';
import TaskMetaEditor from './TaskMetaEditor';

const { Title } = Typography
const { TextArea } = Input

interface CreateTaskModalProps {
  open: boolean
  onCancel: () => void
  onCreate: (values: {
    title: string
    description?: string
    meta: MetaDraft[]
    startDate?: string
    dueDate?: string
    projectId?: string | null
    subtasks?: string[]
  }) => Promise<void>
  loading: boolean
  initialProjectId?: string
}

export default function CreateTaskModal({ open, onCancel, onCreate, loading, initialProjectId }: CreateTaskModalProps) {
  const [form] = Form.useForm()
  const [metaItems, setMetaItems] = React.useState<MetaDraft[]>([])
  const [startDate, setStartDate] = React.useState<Dayjs | null>(null)
  const [dueDate, setDueDate] = React.useState<Dayjs | null>(null)
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(initialProjectId || null)
  const [subtasks, setSubtasks] = React.useState<string[]>([])
  const [newSubtaskText, setNewSubtaskText] = React.useState('')

  const { data: projectsData, loading: loadingProjects } = useQuery(GET_PROJECTS, {
    skip: !open,
  })
  const projects: Project[] = projectsData?.projects || []

  React.useEffect(() => {
    if (open) {
      setSelectedProjectId(initialProjectId || null)
    }
  }, [open, initialProjectId])

  const resetLocalState = () => {
    setMetaItems([])
    setStartDate(null)
    setDueDate(null)
    setSelectedProjectId(initialProjectId || null)
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
    await onCreate({
      title: values.title,
      description: values.description,
      meta: metaItems,
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
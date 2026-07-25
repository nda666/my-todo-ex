import React from 'react';

import {
    Button,
    Form,
    Input,
    Modal,
    Typography,
} from 'antd';

const { Title } = Typography
const { TextArea } = Input

interface CreateProjectModalProps {
    open: boolean
    onCancel: () => void
    onCreate: (values: { name: string; description?: string }) => Promise<void>
    loading: boolean
}

export default function CreateProjectModal({ open, onCancel, onCreate, loading }: CreateProjectModalProps) {
    const [form] = Form.useForm()

    const handleFinish = async (values: { name: string; description?: string }) => {
        await onCreate(values)
        form.resetFields()
    }

    return (
        <Modal
            title={<Title level={4} className="!mb-0 font-bold !text-slate-800 dark:!text-slate-100">Buat Project Baru</Title>}
            open={open}
            onCancel={() => { onCancel(); form.resetFields() }}
            footer={null}
            destroyOnClose
        >
            <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false} className="mt-4">
                <Form.Item name="name" label="Nama Project" rules={[{ required: true, message: 'Nama project wajib diisi!' }]}>
                    <Input placeholder="Misal: Aplikasi POS" size="large" className="rounded-lg" />
                </Form.Item>
                <Form.Item name="description" label="Deskripsi">
                    <TextArea rows={3} placeholder="Jelaskan tujuan project ini..." className="rounded-lg" />
                </Form.Item>
                <div className="flex justify-end gap-2 mt-4">
                    <Button onClick={() => { onCancel(); form.resetFields() }} size="large" className="rounded-lg">Batal</Button>
                    <Button type="primary" htmlType="submit" loading={loading} size="large" className="rounded-lg px-6 font-medium">Buat Project</Button>
                </div>
            </Form>
        </Modal>
    )
}
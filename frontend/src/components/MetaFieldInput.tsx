import React, { useState } from 'react';

import {
    Button,
    ColorPicker,
    DatePicker,
    Input,
    message,
    Upload,
} from 'antd';
import dayjs from 'dayjs';

import {
    LoadingOutlined,
    UploadOutlined,
} from '@ant-design/icons';

import { uploadToCloudinary } from '../lib/cloudinary';
import { MetaType } from '../types/task';

interface MetaFieldInputProps {
    type: MetaType
    value: string
    onChange: (value: string) => void
}

export default function MetaFieldInput({ type, value, onChange }: MetaFieldInputProps) {
    const [uploading, setUploading] = useState(false)

    const handleUpload = async (file: File) => {
        setUploading(true)
        try {
            const result = await uploadToCloudinary(file)
            onChange(result.url)
            message.success('File berhasil diunggah')
        } catch (err: any) {
            message.error(err.message || 'Gagal mengunggah file')
        } finally {
            setUploading(false)
        }
        return false // cegah antd Upload auto-submit
    }

    switch (type) {
        case 'TEXT':
            return <Input placeholder="Masukkan teks..." value={value} onChange={(e) => onChange(e.target.value)} />

        case 'LINK':
            return <Input placeholder="https://..." value={value} onChange={(e) => onChange(e.target.value)} />

        case 'COLOR':
            return (
                <ColorPicker
                    value={value || '#3b82f6'}
                    onChange={(_, hex) => onChange(hex)}
                    showText
                />
            )

        case 'DATE':
            return (
                <DatePicker
                    className="w-full"
                    value={value ? dayjs(value) : null}
                    onChange={(date) => onChange(date ? date.format('YYYY-MM-DD') : '')}
                    format="DD/MM/YYYY"
                />
            )

        case 'FILE':
        case 'IMAGE':
            return (
                <div className="flex items-center gap-2">
                    <Upload
                        beforeUpload={handleUpload}
                        showUploadList={false}
                        accept={type === 'IMAGE' ? 'image/*' : undefined}
                    >
                        <Button icon={uploading ? <LoadingOutlined /> : <UploadOutlined />} loading={uploading}>
                            {value ? 'Ganti File' : 'Unggah File'}
                        </Button>
                    </Upload>
                    {value && (
                        <a href={value} target="_blank" rel="noreferrer" className="text-xs !text-blue-600 truncate max-w-[160px]">
                            Lihat file
                        </a>
                    )}
                </div>
            )

        default:
            return <Input value={value} onChange={(e) => onChange(e.target.value)} />
    }
}
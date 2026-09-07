import React, { useEffect, useRef, useState } from 'react';

import {
  Badge,
  Button,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  FieldTimeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useMutation } from '@apollo/client';

import { CREATE_TASK } from '../lib/queries';
import { applyTaskEventToCache } from '../lib/taskCacheUpdates';
import { PriorityLevel } from '../utils/taskPriority';

const { Text } = Typography;

interface QuickCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function QuickCaptureModal({ open, onClose, onSuccess }: QuickCaptureModalProps) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'IN_PROGRESS' | 'PENDING'>('IN_PROGRESS');
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const [setTodayDate, setSetTodayDate] = useState(true);
  const inputRef = useRef<any>(null);

  const [createTask, { loading }] = useMutation(CREATE_TASK, {
    update(cache, { data }) {
      if (data?.createTask) {
        applyTaskEventToCache(cache, {
          action: 'CREATED',
          task: data.createTask,
        });
      }
    },
  });

  useEffect(() => {
    if (open) {
      setTitle('');
      setStatus('IN_PROGRESS');
      setPriority('MEDIUM');
      setSetTodayDate(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 120);
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      message.warning('Judul task tidak boleh kosong');
      return;
    }

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await createTask({
        variables: {
          input: {
            title: trimmedTitle,
            status,
            priority,
            startDate: setTodayDate ? todayStr : undefined,
            dueDate: setTodayDate ? todayStr : undefined,
          },
        },
      });

      message.success('Task berhasil dicatat!');
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      message.error('Gagal mencatat task: ' + (err.message || 'Terjadi kesalahan'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={560}
      centered
      destroyOnClose
      styles={{
        content: {
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            <ThunderboltOutlined className="text-amber-500 text-lg" />
            <span className="font-semibold text-base text-gray-800 dark:text-gray-100">
              Quick Capture Task
            </span>
            <Tag color="blue" className="text-xs ml-2 font-mono">
              Ctrl + K
            </Tag>
          </div>
          <Text type="secondary" className="text-xs">
            Tekan <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border text-xs">Enter</kbd> untuk simpan, <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border text-xs">Esc</kbd> batal
          </Text>
        </div>

        <div>
          <Input
            ref={inputRef}
            size="large"
            placeholder="Ketik apa yang sedang / akan kamu kerjakan..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="text-base py-2.5 rounded-lg border-blue-400 focus:border-blue-600 shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center space-x-2">
            <Text type="secondary" className="text-xs">Status:</Text>
            <Radio.Group
              size="small"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="IN_PROGRESS">
                <ClockCircleOutlined className="mr-1" />
                Sedang Dikerjakan
              </Radio.Button>
              <Radio.Button value="PENDING">
                Rencana (Pending)
              </Radio.Button>
            </Radio.Group>
          </div>

          <div className="flex items-center space-x-2">
            <Text type="secondary" className="text-xs">Prioritas:</Text>
            <Radio.Group
              size="small"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <Radio.Button value="LOW">Low</Radio.Button>
              <Radio.Button value="MEDIUM">Med</Radio.Button>
              <Radio.Button value="HIGH">High</Radio.Button>
            </Radio.Group>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
          <label className="flex items-center space-x-1.5 cursor-pointer text-gray-500 select-none">
            <input
              type="checkbox"
              checked={setTodayDate}
              onChange={(e) => setSetTodayDate(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span>Set tanggal untuk hari ini</span>
          </label>

          <Space size="small">
            <Button size="small" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="primary"
              size="small"
              loading={loading}
              onClick={handleSubmit}
              icon={<CheckCircleOutlined />}
            >
              Simpan Task
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
}

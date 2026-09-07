import React, { useState } from 'react';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Modal,
  Radio,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';

import {
  BugOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation } from '@apollo/client';

import { CREATE_TASK } from '../lib/queries';
import { applyTaskEventToCache } from '../lib/taskCacheUpdates';
import { PriorityLevel } from '../utils/taskPriority';

const { Title, Text, Paragraph } = Typography;

interface PresetTemplate {
  id: string;
  title: string;
  description: string;
  priority: PriorityLevel;
  icon: React.ReactNode;
  category: 'Harian' | 'Mingguan' | 'Teknis';
  defaultSelected: boolean;
}

const PROGRAMMER_PRESETS: PresetTemplate[] = [
  {
    id: 'standup',
    title: 'Daily Standup & Sprint Sync',
    description: 'Penyelarasan target harian, status blocker, dan pembagian tugas dengan tim programmer.',
    priority: 'MEDIUM',
    icon: <TeamOutlined className="text-blue-500" />,
    category: 'Harian',
    defaultSelected: true,
  },
  {
    id: 'code-review',
    title: 'Code Review Pull Requests & Peer Feedback',
    description: 'Review antrean PR rekan tim, cek standar koding, security, dan pastikan CI/CD lolos.',
    priority: 'HIGH',
    icon: <CodeOutlined className="text-emerald-500" />,
    category: 'Harian',
    defaultSelected: true,
  },
  {
    id: 'bug-triaging',
    title: 'Bug Triaging & Error Log Monitoring',
    description: 'Investigasi log error, laporan bug kritis di staging/production, dan prioritas perbaikan.',
    priority: 'HIGH',
    icon: <BugOutlined className="text-rose-500" />,
    category: 'Harian',
    defaultSelected: true,
  },
  {
    id: 'feature-dev',
    title: 'Feature Sprint Implementation & Testing',
    description: 'Pengerjaan fitur utama sprint, pembuatan logic baru, dan penulisan unit test.',
    priority: 'HIGH',
    icon: <RocketOutlined className="text-purple-500" />,
    category: 'Harian',
    defaultSelected: true,
  },
  {
    id: 'staging-deploy',
    title: 'Staging Deployment & Smoke Testing',
    description: 'Build dan deploy branch fitur ke environment staging, verifikasi API endpoint & UI.',
    priority: 'MEDIUM',
    icon: <DeploymentUnitOutlined className="text-amber-500" />,
    category: 'Teknis',
    defaultSelected: false,
  },
  {
    id: 'api-docs',
    title: 'API Documentation & Schema Update',
    description: 'Perbarui dokumentasi endpoint/GraphQL schema agar sinkron dengan frontend/mobile team.',
    priority: 'LOW',
    icon: <FileTextOutlined className="text-cyan-500" />,
    category: 'Teknis',
    defaultSelected: false,
  },
];

interface ProgrammerTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ProgrammerTemplateModal({ open, onClose, onSuccess }: ProgrammerTemplateModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    PROGRAMMER_PRESETS.filter((p) => p.defaultSelected).map((p) => p.id)
  );
  const [initialStatus, setInitialStatus] = useState<'IN_PROGRESS' | 'PENDING'>('IN_PROGRESS');
  const [isApplying, setIsApplying] = useState(false);

  const [createTask] = useMutation(CREATE_TASK, {
    update(cache, { data }) {
      if (data?.createTask) {
        applyTaskEventToCache(cache, {
          action: 'CREATED',
          task: data.createTask,
        });
      }
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === PROGRAMMER_PRESETS.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(PROGRAMMER_PRESETS.map((p) => p.id));
    }
  };

  const handleApplyTemplates = async () => {
    if (selectedIds.length === 0) {
      message.warning('Pilih minimal satu template task untuk dimuat.');
      return;
    }

    setIsApplying(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const chosenPresets = PROGRAMMER_PRESETS.filter((p) => selectedIds.includes(p.id));

    let successCount = 0;
    try {
      for (const preset of chosenPresets) {
        await createTask({
          variables: {
            input: {
              title: preset.title,
              description: preset.description,
              priority: preset.priority,
              status: initialStatus,
              startDate: todayStr,
              dueDate: todayStr,
            },
          },
        });
        successCount++;
      }

      message.success(`${successCount} template task programmer berhasil dimuat untuk hari ini!`);
      onClose();
      try {
        if (onSuccess) {
          onSuccess();
        }
      } catch (callbackErr) {
        console.warn('onSuccess callback error:', callbackErr);
      }
    } catch (err: any) {
      message.error(`Berhasil membuat ${successCount} task, tetapi terjadi error: ${err.message || 'Gagal membuat task'}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="flex items-center space-x-2">
          <CodeOutlined className="text-blue-600 text-lg" />
          <span className="font-semibold text-base">Template Harian Divisi Programmer</span>
        </div>
      }
      width={680}
      centered
      destroyOnClose
      footer={
        <div className="flex items-center justify-between">
          <Button size="middle" onClick={handleSelectAll}>
            {selectedIds.length === PROGRAMMER_PRESETS.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
          </Button>
          <Space>
            <Button onClick={onClose}>Tutup</Button>
            <Button
              type="primary"
              loading={isApplying}
              onClick={handleApplyTemplates}
              icon={<PlayCircleOutlined />}
              disabled={selectedIds.length === 0}
            >
              Muat {selectedIds.length} Task Hari Ini
            </Button>
          </Space>
        </div>
      }
    >
      <div className="space-y-4 my-2">
        <Alert
          type="info"
          showIcon
          description="Pilih aktivitas rutin yang akan dikerjakan hari ini. Task akan otomatis dibuat dengan tanggal hari ini sehingga Anda tidak perlu mengetik ulang dari awal."
        />

        <div className="flex items-center justify-between pb-1">
          <Text strong className="text-xs text-gray-500 uppercase tracking-wider">
            Status awal task saat dibuat:
          </Text>
          <Radio.Group
            size="small"
            value={initialStatus}
            onChange={(e) => setInitialStatus(e.target.value)}
          >
            <Radio.Button value="IN_PROGRESS">Sedang Dikerjakan (In Progress)</Radio.Button>
            <Radio.Button value="PENDING">Rencana (Pending)</Radio.Button>
          </Radio.Group>
        </div>

        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {PROGRAMMER_PRESETS.map((preset) => {
            const isChecked = selectedIds.includes(preset.id);
            return (
              <div
                key={preset.id}
                onClick={() => toggleSelect(preset.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start space-x-3 select-none ${
                  isChecked
                    ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-600 shadow-sm'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onChange={() => toggleSelect(preset.id)}
                  className="mt-0.5"
                />
                <div className="text-xl mt-0.5">{preset.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                      {preset.title}
                    </span>
                    <Space size={4}>
                      <Tag color="cyan" className="text-xs">
                        {preset.category}
                      </Tag>
                      <Tag
                        color={
                          preset.priority === 'HIGH'
                            ? 'red'
                            : preset.priority === 'MEDIUM'
                            ? 'gold'
                            : 'blue'
                        }
                        className="text-xs"
                      >
                        {preset.priority}
                      </Tag>
                    </Space>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-0 leading-relaxed">
                    {preset.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

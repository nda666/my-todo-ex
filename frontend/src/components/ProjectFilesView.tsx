import React from 'react';
import { Button, Empty, Table, Tag, Typography } from 'antd';
import { DownloadOutlined, FileOutlined } from '@ant-design/icons';

const { Title } = Typography;

export interface ProjectFileItem {
  id: string;
  fileName: string;
  url: string;
  sourceTask: string;
  type: string;
}

interface ProjectFilesViewProps {
  files: ProjectFileItem[];
}

export default function ProjectFilesView({ files }: ProjectFilesViewProps) {
  return (
    <div className="!bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-xl p-6">
      <Title level={5} className="!mb-4 !text-slate-800 dark:!text-slate-200">
        Berkas & Lampiran Project
      </Title>
      {files.length === 0 ? (
        <Empty description="Belum ada berkas lampiran di project ini." />
      ) : (
        <Table
          dataSource={files}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Nama Berkas',
              dataIndex: 'fileName',
              key: 'fileName',
              render: (text) => (
                <div className="flex items-center gap-2">
                  <FileOutlined className="text-blue-500" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">{text}</span>
                </div>
              ),
            },
            {
              title: 'Task Sumber',
              dataIndex: 'sourceTask',
              key: 'sourceTask',
              render: (text) => <Tag color="default">{text}</Tag>,
            },
            {
              title: 'Aksi',
              key: 'action',
              render: (_, record) => (
                <Button
                  type="primary"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(record.url, '_blank')}
                >
                  Lihat / Unduh
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

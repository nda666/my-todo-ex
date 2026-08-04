import React, {
    useMemo,
    useState,
} from 'react';

import {
    Avatar,
    Button,
    DatePicker,
    message,
    Modal,
    Progress,
    Select,
    Table,
    Tag,
    Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
    FileExcelOutlined,
    PrinterOutlined,
    UserOutlined,
} from '@ant-design/icons';

import {
    Colleague,
    Task,
} from '../types/task';
import { getWorkloadInfo } from './WorkloadCapacityWidget';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface ExportWorkloadReportModalProps {
    open: boolean;
    onClose: () => void;
    members: Colleague[];
    tasks: Task[];
    divisiName?: string;
}

export interface MemberSummaryRow {
    key: string;
    kodeku: string;
    nama: string;
    jabatan: string;
    statusLeader: number;
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    activeTasks: number;
    completionRate: number;
    workloadLevel: string;
    workloadColor: string;
}

export default function ExportWorkloadReportModal({
    open,
    onClose,
    members,
    tasks,
    divisiName = 'Divisi',
}: ExportWorkloadReportModalProps) {
    const [selectedMember, setSelectedMember] = useState<string | null>(null);

    // Group tasks by userKode
    const memberSummaries = useMemo<MemberSummaryRow[]>(() => {
        let filteredTasks = tasks;
        if (selectedMember) {
            filteredTasks = tasks.filter((t) => t.userKode === selectedMember);
        }

        return members.map((member) => {
            const userTasks = filteredTasks.filter((t) => t.userKode === member.kodeku);
            const totalTasks = userTasks.length;
            const pendingTasks = userTasks.filter((t) => t.status === 'PENDING').length;
            const inProgressTasks = userTasks.filter((t) => t.status === 'IN_PROGRESS').length;
            const completedTasks = userTasks.filter((t) => t.status === 'COMPLETED').length;
            const activeTasks = pendingTasks + inProgressTasks;
            const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const info = getWorkloadInfo(activeTasks);

            return {
                key: member.kodeku,
                kodeku: member.kodeku,
                nama: member.nama,
                jabatan: member.jabatan?.nama || 'Anggota',
                statusLeader: member.statusLeader,
                totalTasks,
                pendingTasks,
                inProgressTasks,
                completedTasks,
                activeTasks,
                completionRate,
                workloadLevel: info.label,
                workloadColor: info.color,
            };
        });
    }, [members, tasks, selectedMember]);

    const totalAllTasks = tasks.length;
    const completedAllTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const overallRate = totalAllTasks > 0 ? Math.round((completedAllTasks / totalAllTasks) * 100) : 0;

    // Export to CSV Function
    const handleExportCSV = () => {
        try {
            const nowStr = new Date().toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
            });

            let csvContent = '\uFEFF'; // BOM for UTF-8 Excel support

            // Header Section
            csvContent += `LAPORAN RINGKASAN BEBAN KERJA PEGAWAI PER DIVISI\n`;
            csvContent += `Divisi:,${divisiName}\n`;
            csvContent += `Tanggal Cetak:,${nowStr}\n`;
            csvContent += `Total Anggota:,${members.length}\n`;
            csvContent += `Total Tugas Divisi:,${totalAllTasks}\n`;
            csvContent += `Penyelesaian Tim:,${overallRate}%\n\n`;

            // Section 1: Ringkasan per Anggota
            csvContent += `--- TABEL RINGKASAN BEBAN KERJA PER ANGGOTA ---\n`;
            csvContent += `Kode User,Nama Pegawai,Jabatan,Total Task,Aktif (Pending/In Progress),Selesai,Rate Penyelesaian (%),Level Beban Kerja\n`;

            memberSummaries.forEach((m) => {
                csvContent += `"${m.kodeku}","${m.nama}","${m.jabatan}",${m.totalTasks},${m.activeTasks},${m.completedTasks},${m.completionRate}%,"${m.workloadLevel}"\n`;
            });

            csvContent += `\n\n`;

            // Section 2: Rincian Detail Tugas
            csvContent += `--- RINCIAN DAFTAR TASK PER ANGGOTA ---
`;
            csvContent += `Penanggung Jawab,Judul Task,Deskripsi,Status,Prioritas,Dibuat Oleh,Tanggal Mulai,Due Date,Progres Subtask\n`;

            tasks.forEach((t) => {
                const assignee = members.find((m) => m.kodeku === t.userKode)?.nama || t.userKode;
                const creator = members.find((m) => m.kodeku === t.createdBy)?.nama || t.createdBy;
                const cleanTitle = (t.title || '').replace(/"/g, '""');
                const cleanDesc = (t.description || '').replace(/"/g, '""').replace(/\n/g, ' ');
                const totalSub = t.subtasks?.length || 0;
                const compSub = t.subtasks?.filter((s) => s.status === 'COMPLETED').length || 0;
                const subProgress = totalSub > 0 ? `${compSub}/${totalSub}` : '-';

                csvContent += `"${assignee}","${cleanTitle}","${cleanDesc}","${t.status}","${t.priority || 'MEDIUM'}","${creator}","${t.startDate || '-'}","${t.dueDate || '-'}","${subProgress}"\n`;
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            const filename = `Laporan_Beban_Kerja_${divisiName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            message.success('Laporan CSV berhasil diunduh!');
        } catch (err: any) {
            message.error('Gagal mengunduh laporan: ' + err.message);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const columns: ColumnsType<MemberSummaryRow> = [
        {
            title: 'Pegawai',
            key: 'nama',
            render: (_, record) => (
                <div className="flex items-center gap-2">
                    <Avatar icon={<UserOutlined />} className="!bg-blue-600" size="small" />
                    <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                            {record.nama}
                            {record.statusLeader === 1 && (
                                <Tag color="gold" className="text-[10px] px-1 py-0 leading-tight">
                                    Leader
                                </Tag>
                            )}
                        </div>
                        <div className="text-xs text-slate-400">{record.jabatan}</div>
                    </div>
                </div>
            ),
        },
        {
            title: 'Total Task',
            dataIndex: 'totalTasks',
            key: 'totalTasks',
            align: 'center',
            render: (val) => <span className="font-bold text-slate-700 dark:text-slate-200">{val}</span>,
        },
        {
            title: 'Aktif',
            dataIndex: 'activeTasks',
            key: 'activeTasks',
            align: 'center',
            render: (val, record) => (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {val} (P: {record.pendingTasks}, WIP: {record.inProgressTasks})
                </span>
            ),
        },
        {
            title: 'Selesai',
            dataIndex: 'completedTasks',
            key: 'completedTasks',
            align: 'center',
            render: (val) => (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {val}
                </span>
            ),
        },
        {
            title: 'Tingkat Penyelesaian',
            dataIndex: 'completionRate',
            key: 'completionRate',
            width: 160,
            render: (rate) => (
                <div className="w-full">
                    <Progress percent={rate} size="small" strokeColor={rate >= 80 ? '#10b981' : rate >= 50 ? '#3b82f6' : '#f59e0b'} />
                </div>
            ),
        },
        {
            title: 'Kapasitas / Status',
            dataIndex: 'workloadLevel',
            key: 'workloadLevel',
            align: 'center',
            render: (val, record) => (
                <Tag style={{ color: record.workloadColor, borderColor: record.workloadColor }} className="font-semibold rounded-full px-2.5">
                    {val}
                </Tag>
            ),
        },
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={840}
            title={
                <div className="flex items-center justify-between pr-6 border-b pb-3 border-slate-100 dark:border-slate-800">
                    <div>
                        <Title level={4} className="!mb-0 font-bold text-slate-800 dark:text-slate-100">
                            Ringkasan Laporan Tugas & Beban Kerja
                        </Title>
                        <Text className="text-xs text-slate-500">
                            Evaluasi kapasitas dan kinerja tugas anggota divisi {divisiName}
                        </Text>
                    </div>
                </div>
            }
            className="dark:!bg-slate-900 print:p-0 print:m-0"
        >
            <div className="pt-2">
                {/* Action Controls & Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 print:hidden">
                    <div className="flex items-center gap-2">
                        <Text className="text-xs font-semibold text-slate-500">Filter Pegawai:</Text>
                        <Select
                            allowClear
                            placeholder="Semua Pegawai"
                            value={selectedMember}
                            onChange={(val) => setSelectedMember(val)}
                            className="w-48"
                            options={members.map((m) => ({ label: m.nama, value: m.kodeku }))}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="primary"
                            icon={<FileExcelOutlined />}
                            onClick={handleExportCSV}
                            className="bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium"
                        >
                            Ekspor CSV / Excel
                        </Button>
                        <Button
                            type="default"
                            icon={<PrinterOutlined />}
                            onClick={handlePrint}
                            className="rounded-lg text-xs font-medium"
                        >
                            Cetak PDF
                        </Button>
                    </div>
                </div>

                {/* Stats Cards Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 rounded-xl text-center">
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Pegawai</div>
                        <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{members.length}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-center">
                        <div className="text-xs text-slate-500 font-medium">Total Tugas</div>
                        <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{totalAllTasks}</div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl text-center">
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Selesai</div>
                        <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{completedAllTasks}</div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-center">
                        <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Penyelesaian Tim</div>
                        <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{overallRate}%</div>
                    </div>
                </div>

                {/* Summary Table */}
                <div className="mb-4">
                    <Title level={5} className="!mb-2 font-semibold text-slate-800 dark:text-slate-200">
                        Tabel Ringkasan Anggota
                    </Title>
                    <Table<MemberSummaryRow>
                        columns={columns}
                        dataSource={memberSummaries}
                        pagination={false}
                        size="small"
                        rowKey="kodeku"
                        className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
                    />
                </div>
            </div>
        </Modal>
    );
}

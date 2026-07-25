import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    Badge,
    Button,
    Empty,
    message,
    Spin,
    Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';

import {
    PlusOutlined,
    ProjectOutlined,
} from '@ant-design/icons';
import {
    useMutation,
    useQuery,
} from '@apollo/client';

import CreateProjectModal from '../components/CreateProjectModal';
import { useAuth } from '../contexts/AuthContext';
import { useTeamHeader } from '../layouts/TeamLayout';
import {
    CREATE_PROJECT,
    GET_PROJECTS,
} from '../lib/queries';
import { Project } from '../types/project';

const { Text } = Typography

export default function Projects() {
    const { me } = useAuth()
    const navigate = useNavigate()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const isLeader = me?.pegawai?.statusLeader === 1
    const { data, loading: queryLoading, refetch } = useQuery(GET_PROJECTS)

    const handleBack = useCallback(() => navigate('/'), [navigate])
    const headerExtra = useMemo(() => (
        isLeader ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                Buat Project
            </Button>
        ) : undefined
    ), [isLeader])
    useTeamHeader({ title: 'Project', onBack: handleBack, headerExtra })

    useEffect(() => {
        if (!queryLoading) {
            setProjects(data?.projects || [])
            setLoading(false)
        }
    }, [data, queryLoading])

    const [createProjectMutation, { loading: createLoading }] = useMutation(CREATE_PROJECT)

    useEffect(() => {
        setCreating(createLoading)
    }, [createLoading])

    const handleCreate = async (values: { name: string; description?: string }) => {
        setIsModalOpen(false)
        try {
            await createProjectMutation({
                variables: values,
            })
            message.success('Project berhasil dibuat!')
            await refetch()
        } catch (err: any) {
            message.error(err.message || 'Gagal membuat project')
            setIsModalOpen(true)
        } finally {
            // handled by createLoading
        }
    }

    return (
        < >
            {loading ? (
                <div className="flex justify-center py-20"><Spin size="large" /></div>
            ) : projects.length === 0 ? (
                <div className="py-16">
                    <Empty
                        description={
                            <span className="!text-slate-500 dark:!text-slate-400">
                                Belum ada project. {isLeader && 'Klik "Buat Project" untuk memulai kolaborasi lintas divisi.'}
                            </span>
                        }
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => navigate(`/projects/${p.id}`)}
                            className="group cursor-pointer !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-2xl p-5 hover:!border-blue-400 dark:hover:!border-blue-700 hover:shadow-md transition-all duration-150"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-xl !bg-blue-50 dark:!bg-blue-950/40">
                                    <ProjectOutlined className="text-xl !text-blue-600 dark:!text-blue-400" />
                                </div>
                                {p.status === 'archived' && (
                                    <span className="text-[10px] font-semibold !bg-slate-100 dark:!bg-slate-800 !text-slate-500 px-2 py-0.5 rounded-full">
                                        Arsip
                                    </span>
                                )}
                            </div>
                            <div className="font-semibold text-base !text-slate-800 dark:!text-slate-100 mb-1 truncate">{p.name}</div>
                            <Text className="text-sm !text-slate-500 dark:!text-slate-400 block mb-3 line-clamp-2">
                                {p.description || 'Tidak ada deskripsi.'}
                            </Text>
                            <div className="flex items-center gap-2 pt-3 !border-t !border-slate-100 dark:!border-slate-800">
                                <Badge count={p.divisions.length} color="#3b82f6" />
                                <Text className="text-xs !text-slate-500 dark:!text-slate-400">divisi tergabung</Text>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateProjectModal
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onCreate={handleCreate}
                loading={creating}
            />
        </>
    )
}
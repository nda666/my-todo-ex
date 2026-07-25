import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    Avatar,
    Button,
    Empty,
    Input,
    Spin,
    Typography,
} from 'antd';
import {
    useNavigate,
    useParams,
} from 'react-router-dom';

import {
    CrownFilled,
    SearchOutlined,
    TableOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@apollo/client';

import { useScrollRestoration } from '../contexts/ScrollRestorationContext';
import { useTeamHeader } from '../layouts/TeamLayout';
import { GET_COLLEAGUES_BY_DIVISI } from '../lib/queries';
import { Colleague } from '../types/task';

const { Text } = Typography

export default function TeamDivisionMembers() {
    const navigate = useNavigate()
    const { divisiId } = useParams<{ divisiId: string }>()
    const [members, setMembers] = useState<Colleague[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const { restoreScroll } = useScrollRestoration();
    const divisiKode = Number(divisiId)
    const handleBack = useCallback(() => navigate('/teams', { preventScrollReset: true }), [navigate])
    const headerExtra = useMemo(() => (
        <Button icon={<TableOutlined />} onClick={() => navigate(`/teams/${divisiKode}/team-board`)}>
            Lihat Team Board
        </Button>
    ), [divisiKode, navigate])


    const { data, loading: queryLoading } = useQuery(GET_COLLEAGUES_BY_DIVISI, {
        variables: { divisiKode, search },
        skip: !divisiKode,
    })

    useTeamHeader({ title: 'Anggota Divisi', onBack: handleBack, headerExtra })

    useEffect(() => {
        if (!queryLoading) {
            setMembers(data?.colleaguesByDivisi || [])
            setLoading(false)
            restoreScroll();
        }
    }, [data, queryLoading])



    return (
        < >
            <Input
                placeholder="Cari nama pegawai..."
                prefix={<SearchOutlined className="!text-slate-400" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-6 max-w-sm"
                size="large"
            />

            {loading ? (
                <div className="flex justify-center py-20"><Spin size="large" /></div>
            ) : (members.length === 0 ? (
                <div className="py-16">
                    <Empty description={<span className="!text-slate-500 dark:!text-slate-400">Tidak ada pegawai yang cocok.</span>} />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {members.map((m) => (
                        <div
                            key={m.kodeku}
                            onClick={() => navigate(`/teams/${divisiKode}/${m.kodeku}`, {
                                preventScrollReset: true
                            })}
                            className="group relative cursor-pointer !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-2xl p-5 hover:!border-blue-400 dark:hover:!border-blue-700 hover:shadow-md transition-all duration-150"
                        >
                            {m.statusLeader === 1 && (
                                <div className="absolute top-3 right-3 flex items-center gap-1 !bg-amber-50 dark:!bg-amber-950/40 !text-amber-600 dark:!text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    <CrownFilled /> King
                                </div>
                            )}

                            <Avatar
                                size={56}
                                src={m.avatarUrl || undefined}
                                icon={!m.avatarUrl && <UserOutlined />}
                                className="!bg-blue-100 dark:!bg-blue-900 !text-blue-600 dark:!text-blue-300 mb-3"
                            />

                            <div className="font-semibold text-base !text-slate-800 dark:!text-slate-100 truncate">
                                {m.nama}
                            </div>
                            <Text className="text-sm !text-slate-500 dark:!text-slate-400 truncate block">
                                {m.jabatan?.nama || 'Pegawai'}
                            </Text>
                        </div>
                    ))}
                </div>
            ))}
        </>
    )
}
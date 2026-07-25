import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    Empty,
    Input,
    Spin,
    Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';

import {
    ApartmentOutlined,
    CrownFilled,
    SearchOutlined,
    TeamOutlined,
} from '@ant-design/icons';
import { useQuery } from '@apollo/client';

import { getDivisionIcon } from '../constants/divisionIcons';
import { useTeamHeader } from '../layouts/TeamLayout';
import { GET_TEAMS_SUMMARY } from '../lib/queries';
import { DivisionSummary } from '../types/task';

const { Text } = Typography

export default function Teams() {

    const { data, loading: queryLoading, previousData } = useQuery(GET_TEAMS_SUMMARY, {
        fetchPolicy: "cache-and-network"
    })

    const navigate = useNavigate()
    const handleBack = useCallback(() => navigate('/', { preventScrollReset: true }), [navigate])
    useTeamHeader({ title: 'Semua Divisi', onBack: handleBack })
    const [divisions, setDivisions] = useState<DivisionSummary[]>(data?.teamsSummary ??
        previousData?.teamsSummary ??
        [])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    useEffect(() => {
        if (!queryLoading) {
            setDivisions(data?.teamsSummary || [])
            setLoading(false)
        }
    }, [data, queryLoading])

    const filtered = useMemo(
        () => divisions.filter((d) => d.nama.toLowerCase().includes(search.toLowerCase())),
        [divisions, search]
    )

    return (
        <>
            <Input
                placeholder="Cari nama divisi..."
                prefix={<SearchOutlined className="!text-slate-400" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-6 max-w-sm"
                size="large"
            />

            {loading ? (
                <div className="flex justify-center py-20"><Spin size="large" /></div>
            ) : filtered.length === 0 ? (
                <div className="py-16">
                    <Empty description={<span className="!text-slate-500 dark:!text-slate-400">Tidak ada divisi yang cocok.</span>} />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((d) => (
                        <div
                            key={d.kode}
                            onClick={() => navigate(`/teams/${d.kode}`)}
                            className="group cursor-pointer !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-2xl p-5 hover:!border-blue-400 dark:hover:!border-blue-700 hover:shadow-md transition-all duration-150"
                        >
                            {d.iconKey ? (
                                <div
                                    className="flex items-center justify-center w-12 h-12 rounded-xl mb-4 transition-transform group-hover:scale-105"
                                    style={{ backgroundColor: `${d.color}1a`, color: d.color }} // 1a = ~10% opacity di hex
                                >
                                    <span className="text-xl">{getDivisionIcon(d.iconKey)}</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center w-12 h-12 rounded-xl !bg-blue-50 dark:!bg-blue-950/40 mb-4 group-hover:!bg-blue-100 dark:group-hover:!bg-blue-900/50 transition-colors">
                                    <ApartmentOutlined className="text-xl !text-blue-600 dark:!text-blue-400" />
                                </div>
                            )}
                            <div className="font-semibold text-base !text-slate-800 dark:!text-slate-100 mb-1 truncate">
                                {d.nama}
                            </div>

                            {d.leaderName ? (
                                <div className="flex items-center gap-1.5 text-sm !text-slate-500 dark:!text-slate-400 mb-3">
                                    <CrownFilled className="!text-amber-500" />
                                    <span className="truncate">{d.leaderName}</span>
                                </div>
                            ) : (
                                <div className="text-sm italic !text-slate-400 dark:!text-slate-500 mb-3">Belum ada leader</div>
                            )}

                            <div className="flex items-center gap-1.5 pt-3 !border-t !border-slate-100 dark:!border-slate-800">
                                <TeamOutlined className="!text-slate-400 text-xs" />
                                <Text className="text-xs !text-slate-500 dark:!text-slate-400">
                                    {d.memberCount} anggota
                                </Text>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    )
}


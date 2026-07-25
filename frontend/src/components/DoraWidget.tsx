// frontend/src/components/DoraWidget.tsx — full file
import React, {
    useEffect,
    useRef,
    useState,
} from 'react';

import {
    Avatar,
    Button,
    Input,
    message,
} from 'antd';
import ReactMarkdown from 'react-markdown';

import {
    CheckOutlined,
    CloseOutlined,
    PlusOutlined,
    RobotOutlined,
    SendOutlined,
} from '@ant-design/icons';
import { useMutation } from '@apollo/client';

import {
    ASK_DORA,
    CREATE_PROJECT,
    CREATE_TASK,
    INVITE_DIVISION,
} from '../lib/queries';
import { downloadTeamReport } from '../lib/report';
import { DoraSuggestedAction } from '../types/dora';

const { TextArea } = Input

interface ChatEntry {
    role: 'user' | 'assistant'
    content: string
    action?: DoraSuggestedAction | null
    actionHandled?: boolean
}

export default function DoraWidget() {
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<ChatEntry[]>([
        { role: 'assistant', content: 'Hai, aku Dora — asisten Doran Todo. Aku bisa bantu kamu bikin task (satu atau banyak sekaligus), bikin project, cek status, atau jelasin fitur di aplikasi ini. Ada yang bisa dibantu?' },
    ])
    const [sessionId] = useState(() => crypto.randomUUID())
    const [downloading, setDownloading] = useState(false)
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [selectedDivisions, setSelectedDivisions] = useState<Record<number, number[]>>({})
    const scrollRef = useRef<HTMLDivElement>(null)

    const [askDoraMutation] = useMutation(ASK_DORA)
    const [createTaskMutation] = useMutation(CREATE_TASK, {
        update(cache, { data }) {
            const newTask = data.createTask
            cache.modify({
                fields: {
                    tasks(existing = { tasks: [], nextCursor: null, hasMore: false }) {
                        return { ...existing, tasks: [{ __ref: cache.identify(newTask) }, ...existing.tasks] }
                    },
                },
            })
        },
    })
    const [createProjectMutation] = useMutation(CREATE_PROJECT, {
        update(cache, { data }) {
            const newProject = data.createProject
            cache.modify({
                fields: {
                    projects(existing = []) {
                        return [{ __ref: cache.identify(newProject) }, ...existing]
                    },
                },
            })
        },
    })
    const [inviteDivisionMutation] = useMutation(INVITE_DIVISION)

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, [messages])

    const handleSend = async () => {
        const text = input.trim()
        if (!text) return
        setInput('')
        setMessages((prev) => [...prev, { role: 'user', content: text }])
        setSending(true)

        try {
            const resp = await askDoraMutation({
                variables: { message: text, sessionId },
            }).then((r) => r.data.askDora)

            setMessages((prev) => [...prev, { role: 'assistant', content: resp.reply, action: resp.suggestedAction }])
        } catch (err: any) {
            setMessages((prev) => [...prev, { role: 'assistant', content: 'Maaf, aku lagi gak bisa merespons. Coba lagi sebentar lagi ya.' }])
        } finally {
            setSending(false)
        }
    }

    // frontend/src/components/DoraWidget.tsx — only handleDownloadReport + the generate_report card changed
    const handleDownloadReport = async (action: DoraSuggestedAction) => {
        if (!action.startDate || !action.endDate) return
        setDownloading(true)
        try {
            await downloadTeamReport(action.startDate, action.endDate, sessionId, action.styleNotes)
            message.success('Laporan berhasil diunduh!')
        } catch (err: any) {
            message.error(err.message || 'Gagal membuat laporan')
        } finally {
            setDownloading(false)
        }
    }

    const handleConfirmAction = async (index: number, action: DoraSuggestedAction) => {
        try {
            await createTaskMutation({
                variables: {
                    input: {
                        title: action.title,
                        description: action.description || null,
                        ...(action.targetUserKode ? { targetUserKode: action.targetUserKode } : {}),
                        meta: [],
                    },
                },
            })
            message.success('Task berhasil dibuat!')
            setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, actionHandled: true } : m)))
        } catch (err: any) {
            message.error(err.message || 'Gagal membuat task. Cek lagi apakah kamu punya izin untuk assign ke orang ini.')
        }
    }

    const handleConfirmBatchAction = async (index: number, action: DoraSuggestedAction) => {
        const tasks = action.tasks || []
        let failed = 0
        for (const t of tasks) {
            try {
                await createTaskMutation({
                    variables: {
                        input: {
                            title: t.title,
                            description: t.description || null,
                            ...(t.targetUserKode ? { targetUserKode: t.targetUserKode } : {}),
                            meta: [],
                        },
                    },
                })
            } catch {
                failed++
            }
        }
        if (failed === 0) {
            message.success(`${tasks.length} task berhasil dibuat!`)
        } else {
            message.warning(`${tasks.length - failed} dari ${tasks.length} task berhasil dibuat.`)
        }
        setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, actionHandled: true } : m)))
    }

    const handleConfirmProjectAction = async (index: number, action: DoraSuggestedAction) => {
        try {
            const { data } = await createProjectMutation({
                variables: { name: action.title, description: action.description || null },
            })
            const projectId = data.createProject.id
            for (const divisiKode of action.divisions || []) {
                try {
                    await inviteDivisionMutation({ variables: { projectId, divisiKode } })
                } catch {
                    // divisi gagal diundang - user bisa undang manual dari halaman project
                }
            }
            message.success('Project berhasil dibuat!')
            setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, actionHandled: true } : m)))
        } catch (err: any) {
            message.error(err.message || 'Gagal membuat project. Pastikan kamu leader divisi.')
        }
    }

    const toggleDivisionCandidate = (index: number, kode: number) => {
        setSelectedDivisions((prev) => {
            const current = prev[index] || []
            const next = current.includes(kode) ? current.filter((k) => k !== kode) : [...current, kode]
            return { ...prev, [index]: next }
        })
    }

    const handleConfirmRecommendation = async (index: number, action: DoraSuggestedAction) => {
        try {
            const { data } = await createProjectMutation({
                variables: { name: action.title, description: action.description || null },
            })
            const projectId = data.createProject.id
            const chosen = selectedDivisions[index] || []
            for (const divisiKode of chosen) {
                try {
                    await inviteDivisionMutation({ variables: { projectId, divisiKode } })
                } catch {
                    // divisi gagal diundang - user bisa undang manual dari halaman project
                }
            }
            message.success('Project berhasil dibuat!')
            setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, actionHandled: true } : m)))
        } catch (err: any) {
            message.error(err.message || 'Gagal membuat project. Pastikan kamu leader divisi.')
        }
    }

    return (
        <>
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full !bg-blue-600 hover:!bg-blue-700 shadow-lg flex items-center justify-center text-white text-2xl transition-transform hover:scale-105"
                >
                    <RobotOutlined />
                </button>
            )}

            {open && (
                <div className="fixed bottom-6 right-6 z-[100] w-[360px] max-w-[90vw] h-[520px] max-h-[75vh] !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 !bg-blue-600 !text-white shrink-0">
                        <div className="flex items-center gap-2">
                            <Avatar icon={<RobotOutlined />} className="!bg-white/20" size="small" />
                            <div>
                                <div className="font-semibold text-sm leading-tight">Dora</div>
                                <div className="text-[10px] opacity-80 leading-tight">Doran Todo Assistant</div>
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} className="!text-white opacity-80 hover:opacity-100">
                            <CloseOutlined />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === 'user'
                                        ? '!bg-blue-600 !text-white'
                                        : '!bg-slate-100 dark:!bg-slate-800 !text-slate-800 dark:!text-slate-200'
                                        }`}
                                >
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                    </div>

                                    {m.action && m.action.type === 'create_task' && (
                                        <div className="mt-2 !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-700 rounded-lg p-2.5">
                                            <div className="text-xs font-semibold !text-slate-700 dark:!text-slate-200 mb-0.5">
                                                📋 Usulan Task: {m.action.title}
                                            </div>
                                            {m.action.description && (
                                                <div className="text-xs !text-slate-500 dark:!text-slate-400 mb-2">{m.action.description}</div>
                                            )}
                                            {m.actionHandled ? (
                                                <div className="text-xs !text-emerald-600 flex items-center gap-1">
                                                    <CheckOutlined /> Task sudah dibuat
                                                </div>
                                            ) : (
                                                <Button size="small" type="primary" onClick={() => handleConfirmAction(i, m.action!)}>
                                                    Buat Task Ini
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {m.action && m.action.type === 'create_task_batch' && (
                                        <div className="mt-2 !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-700 rounded-lg p-2.5">
                                            <div className="text-xs font-semibold !text-slate-700 dark:!text-slate-200 mb-1">
                                                📋 Usulan {m.action.tasks?.length || 0} Task
                                            </div>
                                            <ul className="text-xs !text-slate-500 dark:!text-slate-400 mb-2 pl-4 list-disc">
                                                {m.action.tasks?.map((t, idx) => (
                                                    <li key={idx}>{t.title}</li>
                                                ))}
                                            </ul>
                                            {m.actionHandled ? (
                                                <div className="text-xs !text-emerald-600 flex items-center gap-1">
                                                    <CheckOutlined /> Task sudah dibuat
                                                </div>
                                            ) : (
                                                <Button size="small" type="primary" onClick={() => handleConfirmBatchAction(i, m.action!)}>
                                                    Buat Semua Task
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {m.action && m.action.type === 'create_project' && (
                                        <div className="mt-2 !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-700 rounded-lg p-2.5">
                                            <div className="text-xs font-semibold !text-slate-700 dark:!text-slate-200 mb-0.5">
                                                🗂️ Usulan Project: {m.action.title}
                                            </div>
                                            {m.action.description && (
                                                <div className="text-xs !text-slate-500 dark:!text-slate-400 mb-1">{m.action.description}</div>
                                            )}
                                            {m.actionHandled ? (
                                                <div className="text-xs !text-emerald-600 flex items-center gap-1">
                                                    <CheckOutlined /> Project sudah dibuat
                                                </div>
                                            ) : (
                                                <Button size="small" type="primary" onClick={() => handleConfirmProjectAction(i, m.action!)}>
                                                    Buat Project Ini
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {m.action && m.action.type === 'recommend_divisions' && (
                                        <div className="mt-2 !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-700 rounded-lg p-2.5">
                                            <div className="text-xs font-semibold !text-slate-700 dark:!text-slate-200 mb-0.5">
                                                🗂️ Usulan Project: {m.action.title}
                                            </div>
                                            {m.action.description && (
                                                <div className="text-xs !text-slate-500 dark:!text-slate-400 mb-2">{m.action.description}</div>
                                            )}
                                            {m.actionHandled ? (
                                                <div className="text-xs !text-emerald-600 flex items-center gap-1">
                                                    <CheckOutlined /> Project sudah dibuat
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="text-[11px] font-semibold !text-slate-500 dark:!text-slate-400 uppercase mb-1.5">
                                                        Rekomendasi Divisi
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 mb-2.5">
                                                        {(m.action.divisionCandidates || []).map((c) => {
                                                            const selected = (selectedDivisions[i] || []).includes(c.kode)
                                                            return (
                                                                <div
                                                                    key={c.kode}
                                                                    className="flex items-center justify-between !bg-slate-50 dark:!bg-slate-950 !border !border-slate-100 dark:!border-slate-800 rounded-lg px-2.5 py-1.5"
                                                                >
                                                                    <span className="text-xs !text-slate-700 dark:!text-slate-300">{c.nama}</span>
                                                                    <Button
                                                                        size="small"
                                                                        type={selected ? 'primary' : 'default'}
                                                                        icon={selected ? <CheckOutlined /> : <PlusOutlined />}
                                                                        onClick={() => toggleDivisionCandidate(i, c.kode)}
                                                                    >
                                                                        {selected ? 'Ditambahkan' : 'Tambahkan'}
                                                                    </Button>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                    <Button
                                                        size="small"
                                                        type="primary"
                                                        block
                                                        onClick={() => handleConfirmRecommendation(i, m.action!)}
                                                    >
                                                        Buat Project{(selectedDivisions[i]?.length ?? 0) > 0 ? ` & Undang ${selectedDivisions[i].length} Divisi` : ''}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {m.action && m.action.type === 'generate_report' && (
                                        <div className="mt-2 !bg-white dark:!bg-slate-900 !border !border-slate-200 dark:!border-slate-700 rounded-lg p-2.5">
                                            <div className="text-xs font-semibold !text-slate-700 dark:!text-slate-200 mb-0.5">
                                                📊 Laporan Progres Tim
                                            </div>
                                            <div className="text-xs !text-slate-500 dark:!text-slate-400 mb-1">
                                                Periode: {m.action.startDate} s/d {m.action.endDate}
                                            </div>
                                            {m.action.styleNotes && (
                                                <div className="text-xs !text-slate-500 dark:!text-slate-400 mb-2">
                                                    Gaya desain: {m.action.styleNotes}
                                                </div>
                                            )}
                                            <Button size="small" type="primary" loading={downloading} onClick={() => handleDownloadReport(m.action!)}>
                                                Download PPTX
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {sending && (
                            <div className="flex justify-start">
                                <div className="!bg-slate-100 dark:!bg-slate-800 rounded-xl px-3 py-2 text-sm !text-slate-400">
                                    Dora sedang mengetik...
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-3 !border-t !border-slate-100 dark:!border-slate-800 flex gap-2 shrink-0">
                        <TextArea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onPressEnter={(e) => {
                                if (!e.shiftKey) {
                                    e.preventDefault()
                                    handleSend()
                                }
                            }}
                            placeholder="Tanya Dora seputar task kamu..."
                            autoSize={{ minRows: 1, maxRows: 3 }}
                            className="flex-1"
                        />
                        <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={sending} />
                    </div>
                </div>
            )}
        </>
    )
}
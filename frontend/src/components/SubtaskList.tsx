import React, {
  useEffect,
  useState,
} from 'react';

import {
  Button,
  Checkbox,
  Input,
  message,
  Progress,
  Typography,
} from 'antd';

import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useMutation } from '@apollo/client';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  CREATE_SUBTASK,
  DELETE_SUBTASK,
  REORDER_SUBTASKS,
  UPDATE_SUBTASK,
} from '../lib/queries';
import {
  Subtask,
  SubtaskStatus,
} from '../types/task';

const { Text } = Typography;

interface SubtaskListProps {
    taskId: string;
    subtasks: Subtask[];
    readOnly?: boolean;
}

interface SortableSubtaskItemProps {
    subtask: Subtask;
    readOnly?: boolean;
    onToggleStatus: (subtask: Subtask) => void;
    onUpdateDescription: (id: string, description: string) => void;
    onDelete: (id: string) => void;
}

const sortSubtasks = (list: Subtask[]): Subtask[] => {
    return [...(list || [])].sort((a, b) => {
        const aPending = (a.status === 'PENDING' || (a.status as any) === 'pending') ? 0 : 1;
        const bPending = (b.status === 'PENDING' || (b.status as any) === 'pending') ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return (a.id || '').localeCompare(b.id || '');
    });
};

function SortableSubtaskItem({
    subtask,
    readOnly,
    onToggleStatus,
    onUpdateDescription,
    onDelete,
}: SortableSubtaskItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editDesc, setEditDesc] = useState(subtask.description);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: subtask.id });

    useEffect(() => {
        setEditDesc(subtask.description);
    }, [subtask.description]);

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    const handleSaveEdit = () => {
        if (!editDesc.trim()) return;
        onUpdateDescription(subtask.id, editDesc.trim());
        setIsEditing(false);
    };

    const isCompleted = subtask.status === 'COMPLETED';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${isDragging
                ? 'bg-blue-50/50 border-blue-300 dark:bg-slate-800 dark:border-blue-700 z-10'
                : 'bg-white border-slate-200 dark:bg-slate-800/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
        >
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {!readOnly && (
                    <span
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
                    >
                        <HolderOutlined />
                    </span>
                )}

                <Checkbox
                    checked={isCompleted}
                    disabled={readOnly}
                    onChange={() => onToggleStatus(subtask)}
                />

                {isEditing ? (
                    <div className="flex items-center gap-1 flex-1">
                        <Input
                            size="small"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            onPressEnter={handleSaveEdit}
                            autoFocus
                            className="rounded"
                        />
                        <Button
                            type="text"
                            size="small"
                            icon={<CheckOutlined className="text-emerald-500" />}
                            onClick={handleSaveEdit}
                        />
                        <Button
                            type="text"
                            size="small"
                            icon={<CloseOutlined className="text-slate-400" />}
                            onClick={() => {
                                setIsEditing(false);
                                setEditDesc(subtask.description);
                            }}
                        />
                    </div>
                ) : (
                    <Text
                        className={`flex-1 text-sm truncate ${isCompleted
                            ? 'line-through !text-slate-400 dark:!text-slate-500'
                            : '!text-slate-700 dark:!text-slate-200'
                            }`}
                    >
                        {subtask.description}
                    </Text>
                )}
            </div>

            {!readOnly && !isEditing && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined className="text-slate-400 hover:text-blue-500 text-xs" />}
                        onClick={() => setIsEditing(true)}
                    />
                    <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined className="text-xs" />}
                        onClick={() => onDelete(subtask.id)}
                    />
                </div>
            )}
        </div>
    );
}

export default function SubtaskList({ taskId, subtasks = [], readOnly = false }: SubtaskListProps) {
    const [items, setItems] = useState<Subtask[]>(() => sortSubtasks(subtasks));
    const [newDesc, setNewDesc] = useState('');

    useEffect(() => {
        setItems(sortSubtasks(subtasks || []));
    }, [subtasks]);

    const [createSubtask] = useMutation(CREATE_SUBTASK, {
        update(cache, { data }) {
            if (!data?.createSubtask) return;
            const newSubtask = data.createSubtask;
            cache.modify({
                id: cache.identify({ __typename: 'Task', id: taskId }),
                fields: {
                    subtasks(existingSubtasks = [], { toReference }) {
                        const newRef = toReference(newSubtask);
                        if (!newRef) return existingSubtasks;
                        const existingRefs = Array.isArray(existingSubtasks) ? existingSubtasks : [];
                        if (existingRefs.some((ref: any) => ref.__ref === newRef.__ref)) {
                            return existingRefs;
                        }
                        return [...existingRefs, newRef];
                    },
                },
            });
        },
    });
    const [updateSubtask] = useMutation(UPDATE_SUBTASK);
    const [deleteSubtask] = useMutation(DELETE_SUBTASK, {
        update(cache, _res, { variables }) {
            if (!variables?.id) return;
            cache.modify({
                id: cache.identify({ __typename: 'Task', id: taskId }),
                fields: {
                    subtasks(existingSubtasks = [], { readField }) {
                        if (!Array.isArray(existingSubtasks)) return [];
                        return existingSubtasks.filter((ref: any) => readField('id', ref) !== variables.id);
                    },
                },
            });
        },
    });
    const [reorderSubtasks] = useMutation(REORDER_SUBTASKS, {
        update(cache, { data }) {
            if (!data?.reorderSubtasks) return;
            const reordered = data.reorderSubtasks;
            cache.modify({
                id: cache.identify({ __typename: 'Task', id: taskId }),
                fields: {
                    subtasks(_, { toReference }) {
                        return reordered.map((sub: Subtask) => toReference({ ...sub, __typename: 'Subtask' }));
                    },
                },
            });
        },
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const completedCount = items.filter((s) => s.status === 'COMPLETED').length;
    const percent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

    const handleAdd = async () => {
        if (!newDesc.trim()) return;
        const desc = newDesc.trim();
        setNewDesc('');
        try {
            const res = await createSubtask({
                variables: {
                    input: {
                        taskId,
                        description: desc,
                        status: 'PENDING',
                    },
                },
            });
            if (res.data?.createSubtask) {
                setItems((prev) => sortSubtasks([...prev, res.data.createSubtask]));
            }
        } catch (err: any) {
            message.error(err.message || 'Gagal membuat subtask');
        }
    };

    const handleToggleStatus = async (subtask: Subtask) => {
        const nextStatus: SubtaskStatus = subtask.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        const updatedItem = { ...subtask, status: nextStatus };
        const nextItems = items.map((i) => (i.id === subtask.id ? updatedItem : i));
        setItems(sortSubtasks(nextItems));

        try {
            await updateSubtask({
                variables: {
                    id: subtask.id,
                    input: {
                        status: nextStatus,
                    },
                },
            });
        } catch (err: any) {
            message.error(err.message || 'Gagal mengubah status subtask');
            setItems(sortSubtasks(items));
        }
    };

    const handleUpdateDescription = async (id: string, description: string) => {
        const nextItems = items.map((i) => (i.id === id ? { ...i, description } : i));
        setItems(sortSubtasks(nextItems));

        try {
            await updateSubtask({
                variables: {
                    id,
                    input: {
                        description,
                    },
                },
            });
        } catch (err: any) {
            message.error(err.message || 'Gagal mengubah deskripsi subtask');
            setItems(sortSubtasks(items));
        }
    };

    const handleDelete = async (id: string) => {
        const nextItems = items.filter((i) => i.id !== id);
        setItems(sortSubtasks(nextItems));

        try {
            await deleteSubtask({
                variables: { id },
            });
        } catch (err: any) {
            message.error(err.message || 'Gagal menghapus subtask');
            setItems(sortSubtasks(items));
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const newItems = arrayMove(items, oldIndex, newIndex);
            setItems(newItems);
            try {
                await reorderSubtasks({
                    variables: {
                        taskId,
                        orderedIds: newItems.map((i) => i.id),
                    },
                });
            } catch (err: any) {
                message.error(err.message || 'Gagal mengubah urutan subtask');
            }
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <Text className="text-xs font-semibold !text-slate-500 dark:!text-slate-400 uppercase tracking-wider">
                    Subtask ({completedCount}/{items.length})
                </Text>
                {items.length > 0 && (
                    <Text className="text-xs !text-slate-400 font-medium">{percent}% Selesai</Text>
                )}
            </div>

            {items.length > 0 && (
                <Progress
                    percent={percent}
                    showInfo={false}
                    size="small"
                    strokeColor={percent === 100 ? '#10b981' : '#3b82f6'}
                    className="!m-0"
                />
            )}

            {items.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-1.5">
                            {items.map((subtask) => (
                                <SortableSubtaskItem
                                    key={subtask.id}
                                    subtask={subtask}
                                    readOnly={readOnly}
                                    onToggleStatus={handleToggleStatus}
                                    onUpdateDescription={handleUpdateDescription}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {!readOnly && (
                <div className="flex items-center gap-2 pt-1">
                    <Input
                        placeholder="Tambah subtask baru..."
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        onPressEnter={handleAdd}
                        size="small"
                        className="rounded-lg"
                    />
                    <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                        disabled={!newDesc.trim()}
                        className="rounded-lg"
                    >
                        Tambah
                    </Button>
                </div>
            )}
        </div>
    );
}

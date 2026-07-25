import React from 'react';

import {
    Button,
    Input,
    Select,
    Typography,
} from 'antd';

import {
    DeleteOutlined,
    HolderOutlined,
    PlusOutlined,
} from '@ant-design/icons';
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

import { META_TYPE_OPTIONS } from '../constants/metaTypes';
import {
    MetaDraft,
    MetaType,
} from '../types/task';
import MetaFieldInput from './MetaFieldInput';

const { Text } = Typography

interface TaskMetaEditorProps {
    items: MetaDraft[]
    onChange: (items: MetaDraft[]) => void
}

let draftCounter = 0
function newDraftId() {
    draftCounter += 1
    return `draft-${Date.now()}-${draftCounter}`
}

function SortableMetaRow({
    item,
    onUpdate,
    onRemove,
}: {
    item: MetaDraft
    onUpdate: (patch: Partial<MetaDraft>) => void
    onRemove: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.draftId })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="!border !border-slate-200 dark:!border-slate-800 rounded-lg p-3 flex flex-col gap-2 !bg-white dark:!bg-slate-900"
        >
            <div className="flex items-center gap-2">
                <span {...attributes} {...listeners} className="cursor-grab !text-slate-400 hover:!text-slate-600 shrink-0">
                    <HolderOutlined />
                </span>
                <Input
                    placeholder="Nama info (mis. Deadline, Dokumen Pendukung)"
                    value={item.key}
                    onChange={(e) => onUpdate({ key: e.target.value })}
                    className="flex-1"
                />
                <Select
                    value={item.type}
                    options={META_TYPE_OPTIONS}
                    onChange={(val) => onUpdate({ type: val as MetaType, value: '' })}
                    className="w-32"
                />
                <Button danger size="small" icon={<DeleteOutlined />} onClick={onRemove} />
            </div>
            <MetaFieldInput type={item.type} value={item.value} onChange={(value) => onUpdate({ value })} />
        </div>
    )
}

export default function TaskMetaEditor({ items, onChange }: TaskMetaEditorProps) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
    const addItem = () => {
        onChange([...items, { draftId: newDraftId(), key: '', value: '', type: 'TEXT' as MetaType }])
    }

    const updateItem = (draftId: string, patch: Partial<MetaDraft>) => {
        onChange(items.map((it) => (it.draftId === draftId ? { ...it, ...patch } : it)))
    }

    const removeItem = (draftId: string) => {
        onChange(items.filter((it) => it.draftId !== draftId))
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = items.findIndex((it) => it.draftId === active.id)
        const newIndex = items.findIndex((it) => it.draftId === over.id)
        onChange(arrayMove(items, oldIndex, newIndex))
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <Text className="text-sm font-medium !text-slate-700 dark:!text-slate-300">Info Tambahan</Text>
                <Button size="small" icon={<PlusOutlined />} onClick={addItem}>
                    Tambah
                </Button>
            </div>

            {items.length === 0 && (
                <Text className="text-xs italic !text-slate-400 dark:!text-slate-500">
                    Belum ada info tambahan. Klik "Tambah" untuk melampirkan link, tanggal, warna, atau file. Seret ikon di kiri untuk mengatur urutan.
                </Text>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((it) => it.draftId)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-2">
                        {items.map((item) => (
                            <SortableMetaRow
                                key={item.draftId}
                                item={item}
                                onUpdate={(patch) => updateItem(item.draftId, patch)}
                                onRemove={() => removeItem(item.draftId)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}
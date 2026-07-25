import React, { useState } from 'react';

import {
  Avatar,
  Button,
  Divider,
  Input,
  message,
  Modal,
  Select,
  Switch,
  Tabs,
  Typography,
  Upload,
} from 'antd';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  BellOutlined,
  BgColorsOutlined,
  CameraOutlined,
  IdcardOutlined,
  LoadingOutlined,
  LockOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { useAuth } from '../contexts/AuthContext';
import { uploadAvatar } from '../lib/cloudinary';

const { Title, Text } = Typography

function ProfileTab() {
  const { me, refreshMe } = useAuth()
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      await uploadAvatar(file)
      await refreshMe()
      message.success('Avatar berhasil diperbarui')
    } catch (err: any) {
      message.error(err.message || 'Gagal mengunggah avatar')
    } finally {
      setUploading(false)
    }
    return false
  }

  return (
    <div>
      <Title level={5} className="!mb-4 !text-slate-800 dark:!text-slate-200">Profil</Title>

      <div className="flex items-center gap-6 mb-6">
        <div className="relative">
          <Avatar
            size={88}
            src={me?.avatarUrl || undefined}
            icon={!me?.avatarUrl && <UserOutlined />}
            className="!bg-blue-100 !text-blue-600"
          />
          <Upload beforeUpload={handleUpload} showUploadList={false} accept="image/*">
            <Button
              shape="circle"
              size="small"
              icon={uploading ? <LoadingOutlined /> : <CameraOutlined />}
              className="!absolute !bottom-0 !right-0 shadow-md"
              loading={uploading}
            />
          </Upload>
        </div>

        <div>
          <div className="font-semibold text-lg !text-slate-800 dark:!text-slate-100">
            {me?.pegawai?.nama || me?.username}
          </div>
          <Text className="text-sm !text-slate-500 dark:!text-slate-400">
            {me?.pegawai?.jabatan?.nama || 'Pegawai'} • {me?.pegawai?.divisi?.nama || 'Divisi'}
          </Text>
          <div className="mt-2">
            <Text className="text-xs !text-slate-400 dark:!text-slate-500">
              Klik ikon kamera untuk mengganti foto profil. Format JPG/PNG, maks 10MB.
            </Text>
          </div>
        </div>
      </div>

      <Divider className="!border-slate-100 dark:!border-slate-800" />

      <div className="flex flex-col gap-3 max-w-sm">
        <div>
          <Text className="text-xs font-medium !text-slate-500 dark:!text-slate-400 block mb-1">Username</Text>
          <Input value={me?.username} disabled />
        </div>
        <div>
          <Text className="text-xs font-medium !text-slate-500 dark:!text-slate-400 block mb-1">Nama Pegawai</Text>
          <Input value={me?.pegawai?.nama} disabled />
        </div>
      </div>
    </div>
  )
}

function AccountTab() {
  return (
    <div>
      <Title level={5} className="!mb-4 !text-slate-800 dark:!text-slate-200">Akun</Title>
      <div className="flex flex-col gap-3 max-w-sm">
        <div>
          <Text className="text-xs font-medium !text-slate-500 dark:!text-slate-400 block mb-1">Ubah Password</Text>
          <Input.Password placeholder="Password baru" disabled />
        </div>
        <div>
          <Text className="text-xs font-medium !text-slate-500 dark:!text-slate-400 block mb-1">Konfirmasi Password</Text>
          <Input.Password placeholder="Ulangi password baru" disabled />
        </div>
        <Button disabled className="w-fit mt-1">Simpan Perubahan</Button>
        <Text className="text-xs italic !text-slate-400 dark:!text-slate-500 mt-2">
          Fitur ini belum aktif — segera hadir.
        </Text>
      </div>
    </div>
  )
}

function NotificationTab() {
  const rows = [
    { label: 'Task baru ditugaskan ke saya', defaultChecked: true },
    { label: 'Komentar baru di task saya', defaultChecked: true },
    { label: 'Seseorang me-reaksi komentar saya', defaultChecked: false },
    { label: 'Ringkasan mingguan via email', defaultChecked: false },
  ]
  return (
    <div>
      <Title level={5} className="!mb-4 !text-slate-800 dark:!text-slate-200">Notifikasi</Title>
      <div className="flex flex-col gap-4 max-w-md">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <Text className="text-sm !text-slate-700 dark:!text-slate-300">{row.label}</Text>
            <Switch defaultChecked={row.defaultChecked} disabled />
          </div>
        ))}
        <Text className="text-xs italic !text-slate-400 dark:!text-slate-500 mt-2">
          Pengaturan notifikasi belum aktif — segera hadir.
        </Text>
      </div>
    </div>
  )
}

function AppearanceTab() {
  return (
    <div>
      <Title level={5} className="!mb-4 !text-slate-800 dark:!text-slate-200">Tampilan</Title>
      <div className="flex flex-col gap-4 max-w-sm">
        <div>
          <Text className="text-xs font-medium !text-slate-500 dark:!text-slate-400 block mb-1">Bahasa</Text>
          <Select defaultValue="id" disabled options={[{ value: 'id', label: 'Bahasa Indonesia' }, { value: 'en', label: 'English' }]} className="w-full" />
        </div>
        <div>
          <Text className="text-xs font-medium !text-slate-500 dark:!text-slate-400 block mb-1">Densitas Tampilan</Text>
          <Select defaultValue="comfortable" disabled options={[{ value: 'comfortable', label: 'Nyaman' }, { value: 'compact', label: 'Ringkas' }]} className="w-full" />
        </div>
        <Text className="text-xs italic !text-slate-400 dark:!text-slate-500 mt-2">
          Tema gelap/terang sudah bisa diatur lewat tombol di sidebar. Pengaturan lain di sini belum aktif.
        </Text>
      </div>
    </div>
  )
}

function SecurityTab() {
  return (
    <div>
      <Title level={5} className="!mb-4 !text-slate-800 dark:!text-slate-200">Keamanan</Title>
      <div className="flex flex-col gap-4 max-w-sm">
        <div className="flex items-center justify-between">
          <Text className="text-sm !text-slate-700 dark:!text-slate-300">Autentikasi dua faktor</Text>
          <Switch disabled />
        </div>
        <div className="flex items-center justify-between">
          <Text className="text-sm !text-slate-700 dark:!text-slate-300">Keluar dari semua perangkat</Text>
          <Button size="small" disabled>Keluar Semua</Button>
        </div>
        <Text className="text-xs italic !text-slate-400 dark:!text-slate-500 mt-2">
          Fitur keamanan lanjutan belum aktif — segera hadir.
        </Text>
      </div>
    </div>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { backgroundLocation?: Location } | null

  const handleClose = () => {
    if (state?.backgroundLocation) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <Modal
      title={
        <span className="font-bold tracking-tight !text-slate-800 dark:!text-slate-100">Pengaturan</span>
      }
      open={true}
      onCancel={handleClose}
      footer={null}
      width={780}
      destroyOnClose
      className="dark:!bg-slate-900"
    >
      <Tabs
        tabPosition="left"
        className="mt-2 settings-tabs"
        items={[
          {
            key: 'profile',
            label: (
              <span className="flex items-center gap-2">
                <IdcardOutlined /> Profil
              </span>
            ),
            children: <ProfileTab />,
          },
          {
            key: 'account',
            label: (
              <span className="flex items-center gap-2">
                <LockOutlined /> Akun
              </span>
            ),
            children: <AccountTab />,
          },
          {
            key: 'notifications',
            label: (
              <span className="flex items-center gap-2">
                <BellOutlined /> Notifikasi
              </span>
            ),
            children: <NotificationTab />,
          },
          {
            key: 'appearance',
            label: (
              <span className="flex items-center gap-2">
                <BgColorsOutlined /> Tampilan
              </span>
            ),
            children: <AppearanceTab />,
          },
          {
            key: 'security',
            label: (
              <span className="flex items-center gap-2">
                <LockOutlined /> Keamanan
              </span>
            ),
            children: <SecurityTab />,
          },
        ]}
      />
    </Modal>
  )
}
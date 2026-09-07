import React, { useEffect, useState } from 'react';

import {
  Alert,
  Button,
  Card,
  Collapse,
  Divider,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';

import {
  AppleOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GithubOutlined,
  KeyOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SendOutlined,
  ThunderboltOutlined,
  WindowsOutlined,
} from '@ant-design/icons';

import { getToken } from '../lib/auth';

const { Text, Title, Paragraph } = Typography;

interface WebhookToken {
  id: number;
  user_kode: string;
  divisi_kode: number;
  name: string;
  token: string;
  created_at: string;
  last_used_at: string | null;
}

interface GitIntegrationModalProps {
  open: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
}

export default function GitIntegrationModal({
  open,
  onClose,
  onTaskCreated,
}: GitIntegrationModalProps) {
  const jwtToken = getToken() || '';
  const serverUrl =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8080`
      : 'http://localhost:8080';
  const webhookUrl = `${serverUrl}/api/webhooks/git`;

  // Webhook tokens state
  const [tokens, setTokens] = useState<WebhookToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('');

  // Create token form state
  const [newTokenName, setNewTokenName] = useState('');
  const [newCustomToken, setNewCustomToken] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [visibleTokens, setVisibleTokens] = useState<Record<number, boolean>>({});

  // Test commit state
  const [testCommitMsg, setTestCommitMsg] = useState('feat(auth): implement custom webhook token support');
  const [testBranch, setTestBranch] = useState('main');
  const [testing, setTesting] = useState(false);
  const [selectedOS, setSelectedOS] = useState<'linux' | 'windows'>('linux');

  const fetchTokens = async () => {
    if (!open) return;
    setLoadingTokens(true);
    try {
      const res = await fetch(`${serverUrl}/api/webhook-tokens`, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      });
      const resData = await res.json();
      if (res.ok && resData.data) {
        setTokens(resData.data);
        if (resData.data.length > 0 && !selectedToken) {
          setSelectedToken(resData.data[0].token);
        }
      }
    } catch (err: any) {
      console.warn('Gagal memuat token webhook:', err.message);
    } finally {
      setLoadingTokens(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTokens();
    }
  }, [open]);

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      message.warning('Nama token wajib diisi');
      return;
    }

    setCreatingToken(true);
    try {
      const res = await fetch(`${serverUrl}/api/webhook-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({
          name: newTokenName.trim(),
          custom_token: newCustomToken.trim() || undefined,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.data) {
        message.success('Token webhook berhasil dibuat!');
        setNewTokenName('');
        setNewCustomToken('');
        setSelectedToken(resData.data.token);
        fetchTokens();
      } else {
        message.error(resData.message || 'Gagal membuat token');
      }
    } catch (err: any) {
      message.error('Gagal membuat token: ' + err.message);
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = async (id: number) => {
    try {
      const res = await fetch(`${serverUrl}/api/webhook-tokens?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      });
      const resData = await res.json();
      if (res.ok) {
        message.success('Token berhasil dihapus');
        if (tokens.find((t) => t.id === id)?.token === selectedToken) {
          setSelectedToken('');
        }
        fetchTokens();
      } else {
        message.error(resData.message || 'Gagal menghapus token');
      }
    } catch (err: any) {
      message.error('Error saat menghapus token: ' + err.message);
    }
  };

  const activeToken = selectedToken || (tokens.length > 0 ? tokens[0].token : 'MASUKKAN_TOKEN_WEBHOOK_ANDA');

  const postCommitScript = `#!/bin/sh
# .git/hooks/post-commit
# Otomatis mencatat commit ke Todo App (status langsung COMPLETED)
TODO_SERVER_URL="${serverUrl}"
TODO_API_TOKEN="${activeToken}"

COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
HASH=$(git rev-parse --short HEAD 2>/dev/null)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
REPO_NAME=$(basename "$REPO_ROOT" 2>/dev/null)
AUTHOR_NAME=$(git log -1 --pretty=%an 2>/dev/null)

if [ -z "$COMMIT_MSG" ]; then
  exit 0
fi

FIRST_LINE=$(echo "$COMMIT_MSG" | head -n 1)
echo ""
echo "[Todo App] Mengirim commit ke Todo Server ($TODO_SERVER_URL)..."
echo "[Todo App] Commit: $HASH ($BRANCH) - $FIRST_LINE"

if command -v jq >/dev/null 2>&1; then
  PAYLOAD=$(jq -n \\
    --arg msg "$COMMIT_MSG" \\
    --arg branch "$BRANCH" \\
    --arg hash "$HASH" \\
    --arg repo "$REPO_NAME" \\
    --arg name "$AUTHOR_NAME" \\
    '{commit_message: $msg, branch: $branch, commit_hash: $hash, repo: $repo, author_name: $name}')
else
  CLEAN_MSG=$(printf '%s' "$FIRST_LINE" | tr '"\\\\' '  ')
  PAYLOAD="{\\"commit_message\\":\\"$CLEAN_MSG\\",\\"branch\\":\\"$BRANCH\\",\\"commit_hash\\":\\"$HASH\\",\\"repo\\":\\"$REPO_NAME\\",\\"author_name\\":\\"$AUTHOR_NAME\\"}"
fi

RESPONSE=$(curl -s -w "\\nHTTP_STATUS:%{http_code}" --max-time 5 -X POST "$TODO_SERVER_URL/api/webhooks/git" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TODO_API_TOKEN" \\
  -H "X-Git-Token: $TODO_API_TOKEN" \\
  -d "$PAYLOAD" 2>&1)

CURL_EXIT=$?
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

if [ $CURL_EXIT -ne 0 ]; then
  echo "[Todo App] Gagal terhubung ke server ($TODO_SERVER_URL): curl error $CURL_EXIT"
elif [ "$HTTP_STATUS" = "200" ]; then
  echo "[Todo App] Berhasil dicatat ke Todo App!"
  if command -v jq >/dev/null 2>&1; then
    TASK_INFO=$(echo "$BODY" | jq -r '.tasks[0] | "Task #\\(.id): \\(.title) [\\(.status)]"' 2>/dev/null)
    if [ -n "$TASK_INFO" ] && [ "$TASK_INFO" != "null" ]; then
      echo "[Todo App] $TASK_INFO"
    else
      echo "[Todo App] Response: $BODY"
    fi
  else
    echo "[Todo App] Response: $BODY"
  fi
else
  echo "[Todo App] Gagal mencatat task (HTTP $HTTP_STATUS): $BODY"
fi
echo ""
`;

  const oneLinerSetup = `GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
if [ -z "$GIT_DIR" ]; then
  echo "[Todo App] Error: Folder ini bukan repositori Git! Silakan jalankan perintah ini di dalam folder proyek Git Anda."
else
  mkdir -p "$GIT_DIR/hooks"
  cat << 'EOF' > "$GIT_DIR/hooks/post-commit"
${postCommitScript}EOF
  chmod +x "$GIT_DIR/hooks/post-commit"
  echo "[Todo App] Sukses! Hook post-commit berhasil dipasang di $GIT_DIR/hooks/post-commit"
fi
`;

  const oneLinerPowerShell = `$g = git rev-parse --git-dir 2>$null; if (-not $g) { Write-Host "[Todo App] Error: Folder ini bukan repositori Git!" -ForegroundColor Red } else { $h = Join-Path $g "hooks"; if (-not (Test-Path $h)) { New-Item -ItemType Directory -Path $h -Force | Out-Null }; $f = Join-Path $h "post-commit"; $c = @'
${postCommitScript}
'@; [System.IO.File]::WriteAllText($f, $c.Replace("\`r\`n","\`n"), (New-Object System.Text.UTF8Encoding $false)); Write-Host "[Todo App] Sukses! Hook post-commit berhasil dipasang di $f" -ForegroundColor Green }`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} berhasil disalin ke clipboard!`);
  };

  const handleTestCommit = async () => {
    if (!testCommitMsg.trim()) {
      message.warning('Pesan commit tes tidak boleh kosong');
      return;
    }

    setTesting(true);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
          'X-Git-Token': activeToken,
        },
        body: JSON.stringify({
          commit_message: testCommitMsg.trim(),
          branch: testBranch.trim() || 'main',
          commit_hash: Math.random().toString(36).substring(2, 9),
          repo: 'local-workspace',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        message.success('Simulasi git commit berhasil dicatat dan otomatis berstatus COMPLETED!');
        fetchTokens();
        if (onTaskCreated) {
          onTaskCreated();
        }
      } else {
        message.error(`Gagal: ${data.message || 'Token tidak valid'}`);
      }
    } catch (err: any) {
      message.error(`Koneksi gagal: ${err.message || 'Tidak dapat menghubungi server'}`);
    } finally {
      setTesting(false);
    }
  };

  const tokenColumns = [
    {
      title: <span className="text-base font-semibold">Nama Token</span>,
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: WebhookToken) => (
        <div className="py-1">
          <div className="font-semibold text-base text-gray-800 dark:text-gray-200">{text}</div>
          <Text type="secondary" className="text-sm">
            Dibuat: {new Date(record.created_at).toLocaleDateString('id-ID')}
          </Text>
        </div>
      ),
    },
    {
      title: <span className="text-base font-semibold">Token Webhook</span>,
      dataIndex: 'token',
      key: 'token',
      render: (token: string, record: WebhookToken) => {
        const isVisible = visibleTokens[record.id];
        return (
          <div className="flex items-center space-x-2 py-1">
            <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded">
              {isVisible ? token : `${token.substring(0, 8)}••••••••`}
            </code>
            <Button
              type="text"
              icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() =>
                setVisibleTokens((prev) => ({ ...prev, [record.id]: !prev[record.id] }))
              }
            />
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(token, 'Token')}
            />
          </div>
        );
      },
    },
    {
      title: <span className="text-base font-semibold">Terakhir Digunakan</span>,
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      render: (val: string | null) =>
        val ? (
          <Tag color="green" className="text-sm px-2.5 py-1">
            {new Date(val).toLocaleString('id-ID')}
          </Tag>
        ) : (
          <Text type="secondary" className="text-sm">
            Belum pernah
          </Text>
        ),
    },
    {
      title: <span className="text-base font-semibold">Aksi</span>,
      key: 'action',
      render: (_: any, record: WebhookToken) => (
        <Space size="middle">
          <Button
            type={selectedToken === record.token ? 'primary' : 'default'}
            onClick={() => {
              setSelectedToken(record.token);
              message.info(`Token "${record.name}" dipilih untuk script`);
            }}
          >
            {selectedToken === record.token ? 'Aktif' : 'Pilih'}
          </Button>
          <Popconfirm
            title="Hapus token webhook ini?"
            onConfirm={() => handleDeleteToken(record.id)}
            okText="Hapus"
            cancelText="Batal"
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="flex items-center space-x-3 py-1">
          <CodeOutlined className="text-violet-600 text-2xl" />
          <span className="font-bold text-xl">Integrasi Git & Webhook Token</span>
          <Tag color="purple" className="text-sm px-2.5 py-0.5">Divisi Programmer</Tag>
        </div>
      }
      width={980}
      footer={
        <div className="flex justify-end pt-2">
          <Button size="large" onClick={onClose}>Tutup</Button>
        </div>
      }
      destroyOnClose
    >
      <div className="space-y-5 my-2">
        <Alert
          type="info"
          showIcon
          description={
            <div className="space-y-2 text-base py-1 leading-relaxed">
              <div>
                <strong>Git Hook Lokal Otomatis:</strong> Setiap commit git yang Anda lakukan di laptop akan{' '}
                <strong>langsung tercatat sebagai task COMPLETED</strong> di Todo App.
              </div>
              <div className="text-gray-600 dark:text-gray-300">
                <strong>Dukungan Multi-Pegawai:</strong> Hook ini terpasang di folder <code>.git/hooks</code> lokal laptop masing-masing. Meskipun 1 repositori dikerjakan oleh 5 atau lebih programmer, task tidak akan tertukar karena setiap programmer menggunakan token miliknya sendiri. Tidak butuh konfigurasi email sama sekali!
              </div>
            </div>
          }
        />

        <Tabs
          defaultActiveKey="tutorial"
          items={[
            {
              key: 'tutorial',
              label: (
                <span className="text-base font-semibold">
                  <ThunderboltOutlined /> Tutorial Pasang di Git Lokal
                </span>
              ),
              children: (
                <div className="space-y-6 pt-2">
                  {/* Step 1: Pilih / Buat Token */}
                  <div className="p-4 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl space-y-3 text-base">
                    <div className="font-bold text-lg text-blue-900 dark:text-blue-300 flex items-center justify-between">
                      <span>Langkah 1: Pilih Token Identitas Anda</span>
                      {tokens.length === 0 && (
                        <Button
                          type="primary"
                          loading={creatingToken}
                          onClick={handleCreateToken}
                        >
                          + Buat Token Otomatis
                        </Button>
                      )}
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Token ini digunakan oleh script hook di laptop Anda untuk mengidentifikasi bahwa commit tersebut adalah milik Anda.
                    </div>
                    <div className="flex items-center space-x-3 pt-1">
                      <Text strong className="text-base">
                        Token aktif untuk script:
                      </Text>
                      {tokens.length > 0 ? (
                        <Select
                          size="large"
                          style={{ minWidth: 300 }}
                          value={activeToken}
                          onChange={(val) => setSelectedToken(val)}
                          options={tokens.map((t) => ({
                            label: `${t.name} (${t.token.substring(0, 8)}...)`,
                            value: t.token,
                          }))}
                          placeholder="Pilih token webhook"
                        />
                      ) : (
                        <Text type="danger" className="text-base">
                          Belum ada token. Klik tombol di atas untuk membuat token pertama Anda.
                        </Text>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Pilih OS & Tutorial Instalasi */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-lg text-gray-800 dark:text-gray-200">
                        Langkah 2: Pilih Sistem Operasi & Metode Pemasangan
                      </div>
                      <Segmented
                        size="large"
                        value={selectedOS}
                        onChange={(val) => setSelectedOS(val as 'linux' | 'windows')}
                        options={[
                          { label: 'Linux / macOS', value: 'linux', icon: <AppleOutlined /> },
                          { label: 'Windows', value: 'windows', icon: <WindowsOutlined /> },
                        ]}
                      />
                    </div>

                    {selectedOS === 'linux' ? (
                      /* TUTORIAL LINUX / MACOS */
                      <div className="space-y-4">
                        {/* Metode Otomatis Linux */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3 text-base">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-lg text-emerald-700 dark:text-emerald-400">
                              Metode A: 1-Baris Otomatis (Rekomendasi untuk Linux / macOS)
                            </span>
                            <Tag color="green" className="text-sm px-2.5 py-0.5">Paling Cepat</Tag>
                          </div>
                          <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                            Buka terminal di folder repositori proyek Anda, lalu copy dan paste perintah berikut:
                          </div>
                          <div className="relative pt-1">
                            <Input.TextArea
                              rows={6}
                              readOnly
                              value={oneLinerSetup}
                              className="font-mono text-sm bg-gray-950 text-emerald-400 p-4 rounded-xl border-0"
                            />
                            <Button
                              type="primary"
                              icon={<CopyOutlined />}
                              onClick={() => copyToClipboard(oneLinerSetup, 'Perintah instalasi 1-baris Linux')}
                              className="absolute top-4 right-3 shadow-md"
                            >
                              Salin Perintah
                            </Button>
                          </div>
                          <div className="text-sm text-gray-500">
                            Perintah di atas secara otomatis mencari folder <code>.git</code>, membuat folder <code>hooks</code> jika belum ada, membuat file <code>post-commit</code>, dan menyetel izin eksekusi <code>chmod +x</code>.
                          </div>
                        </div>

                        {/* Metode Manual Linux */}
                        <Collapse
                          size="middle"
                          items={[
                            {
                              key: 'manual-linux',
                              label: <span className="text-base font-semibold text-gray-800 dark:text-gray-200">Metode B: Manual Langkah demi Langkah (Linux / macOS)</span>,
                              children: (
                                <div className="space-y-3 text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                                  <div>
                                    <strong>1. Buka terminal di folder proyek Anda:</strong>
                                    <div className="bg-gray-950 text-gray-200 p-3 rounded-lg font-mono text-sm mt-1.5">
                                      cd /path/ke/folder-proyek-anda
                                    </div>
                                  </div>
                                  <div>
                                    <strong>2. Buat folder <code>.git/hooks</code> jika belum ada:</strong>
                                    <div className="bg-gray-950 text-gray-200 p-3 rounded-lg font-mono text-sm mt-1.5">
                                      mkdir -p .git/hooks
                                    </div>
                                  </div>
                                  <div>
                                    <strong>3. Buat dan buka file <code>.git/hooks/post-commit</code> (tanpa ekstensi):</strong>
                                    <div className="bg-gray-950 text-gray-200 p-3 rounded-lg font-mono text-sm mt-1.5">
                                      nano .git/hooks/post-commit
                                      <span className="text-gray-400 block"># atau buka dengan VS Code: code .git/hooks/post-commit</span>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <strong>4. Paste isi script hook berikut ke dalam file:</strong>
                                      <Button
                                        icon={<CopyOutlined />}
                                        onClick={() => copyToClipboard(postCommitScript, 'Isi script post-commit')}
                                      >
                                        Salin Isi Script
                                      </Button>
                                    </div>
                                    <Input.TextArea
                                      rows={5}
                                      readOnly
                                      value={postCommitScript}
                                      className="font-mono text-sm bg-gray-950 text-gray-200 p-3 rounded-lg"
                                    />
                                  </div>
                                  <div>
                                    <strong>5. Berikan izin eksekusi file agar Git dapat menjalankannya:</strong>
                                    <div className="bg-gray-950 text-gray-200 p-3 rounded-lg font-mono text-sm mt-1.5">
                                      chmod +x .git/hooks/post-commit
                                    </div>
                                  </div>
                                </div>
                              ),
                            },
                          ]}
                        />
                      </div>
                    ) : (
                      /* TUTORIAL WINDOWS */
                      <div className="space-y-4">
                        {/* Pilihan 1: Git Bash di Windows */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3 text-base">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-lg text-emerald-700 dark:text-emerald-400">
                              Pilihan 1: Menggunakan Git Bash (Paling Mudah di Windows)
                            </span>
                            <Tag color="green" className="text-sm px-2.5 py-0.5">Sangat Disarankan</Tag>
                          </div>
                          <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                            Jika Anda menggunakan <strong>Git for Windows</strong>, klik kanan di folder proyek Anda lalu pilih <strong>&quot;Open Git Bash here&quot;</strong>, kemudian jalankan perintah di bawah:
                          </div>
                          <div className="relative pt-1">
                            <Input.TextArea
                              rows={6}
                              readOnly
                              value={oneLinerSetup}
                              className="font-mono text-sm bg-gray-950 text-emerald-400 p-4 rounded-xl border-0"
                            />
                            <Button
                              type="primary"
                              icon={<CopyOutlined />}
                              onClick={() => copyToClipboard(oneLinerSetup, 'Perintah Git Bash')}
                              className="absolute top-4 right-3 shadow-md"
                            >
                              Salin Perintah
                            </Button>
                          </div>
                          <div className="text-sm text-gray-500">
                            Perintah ini otomatis membuat folder <code>.git/hooks</code> dan file <code>post-commit</code> secara instan di Windows.
                          </div>
                        </div>

                        {/* Pilihan 2: PowerShell di Windows */}
                        <Collapse
                          size="middle"
                          defaultActiveKey={[]}
                          items={[
                            {
                              key: 'powershell-win',
                              label: <span className="text-base font-semibold text-gray-800 dark:text-gray-200">Pilihan 2: Menggunakan Windows PowerShell</span>,
                              children: (
                                <div className="space-y-3 text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                                  <div>
                                    Buka <strong>PowerShell</strong> di folder proyek Anda, lalu jalankan perintah 1-baris berikut:
                                  </div>
                                  <div className="relative pt-1">
                                    <Input.TextArea
                                      rows={5}
                                      readOnly
                                      value={oneLinerPowerShell}
                                      className="font-mono text-sm bg-gray-950 text-sky-400 p-3 rounded-lg"
                                    />
                                    <Button
                                      icon={<CopyOutlined />}
                                      onClick={() => copyToClipboard(oneLinerPowerShell, 'Perintah PowerShell')}
                                      className="absolute top-3 right-3 shadow-md"
                                    >
                                      Salin PowerShell
                                    </Button>
                                  </div>
                                </div>
                              ),
                            },
                            {
                              key: 'manual-win',
                              label: <span className="text-base font-semibold text-gray-800 dark:text-gray-200">Pilihan 3: Manual via File Explorer & Notepad di Windows</span>,
                              children: (
                                <div className="space-y-3 text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                                  <ol className="list-decimal list-inside space-y-2">
                                    <li>Buka folder proyek Anda di <strong>File Explorer</strong> Windows.</li>
                                    <li>
                                      <strong>Munculkan folder tersembunyi:</strong> Di menu toolbar atas File Explorer, klik tab <strong>View</strong> &rarr; centang kotak <strong>Hidden items</strong> (agar folder <code>.git</code> terlihat).
                                    </li>
                                    <li>Masuk ke dalam folder <strong><code>.git</code></strong>.</li>
                                    <li>
                                      Jika belum ada folder bernama <strong><code>hooks</code></strong>, klik kanan di area kosong &rarr; pilih <strong>New &rarr; Folder</strong> &rarr; beri nama <code>hooks</code>.
                                    </li>
                                    <li>Masuk ke dalam folder <strong><code>.git\hooks</code></strong>.</li>
                                    <li>
                                      Klik kanan di area kosong &rarr; pilih <strong>New &rarr; Text Document</strong>.
                                      <br />
                                      <span className="text-rose-600 font-semibold ml-5 inline-block">
                                        PENTING: Beri nama file <code>post-commit</code> (hapus ekstensi <code>.txt</code> di belakangnya, jangan sampai menjadi <code>post-commit.txt</code>).
                                      </span>
                                    </li>
                                    <li>Buka file <code>post-commit</code> tersebut dengan <strong>Notepad</strong> atau <strong>VS Code</strong>.</li>
                                    <li>
                                      Paste isi script di bawah, lalu simpan (<strong>Ctrl + S</strong>):
                                      <div className="flex justify-end my-2">
                                        <Button
                                          icon={<CopyOutlined />}
                                          onClick={() => copyToClipboard(postCommitScript, 'Isi script post-commit')}
                                        >
                                          Salin Isi Script Hook
                                        </Button>
                                      </div>
                                      <Input.TextArea
                                        rows={5}
                                        readOnly
                                        value={postCommitScript}
                                        className="font-mono text-sm bg-gray-950 text-gray-200 p-3 rounded-lg"
                                      />
                                    </li>
                                  </ol>
                                </div>
                              ),
                            },
                          ]}
                        />
                      </div>
                    )}
                  </div>

                  {/* Step 3: Coba Jalankan Commit */}
                  <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl text-base space-y-3">
                    <div className="font-bold text-lg text-emerald-800 dark:text-emerald-300">
                      Langkah 3: Selesai! Coba Commit Seperti Biasa
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Sekarang coba lakukan commit di terminal atau Git client Anda (VS Code, GitKraken, TortoiseGit, dll.):
                    </div>
                    <div className="bg-gray-950 text-gray-200 p-4 rounded-xl font-mono text-sm space-y-1">
                      <div className="text-gray-400">$ git commit -m "feat: perbaiki validasi form checkout"</div>
                      <div className="text-emerald-400">[Todo App] Mengirim commit ke Todo Server...</div>
                      <div className="text-emerald-400">[Todo App] Berhasil dicatat ke Todo App!</div>
                      <div className="text-emerald-300 font-bold">[Todo App] Task #28: feat: perbaiki validasi form checkout [COMPLETED]</div>
                    </div>
                    <div className="text-gray-600 dark:text-gray-300 text-sm">
                      Task otomatis muncul seketika di dashboard Todo App Anda tanpa perlu refresh browser.
                    </div>
                  </div>

                  {/* FAQ & Skenario Tim */}
                  <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-base space-y-3">
                    <div className="font-bold text-lg text-amber-800 dark:text-amber-300">
                      Pertanyaan Umum & Catatan Tim (Multi-Pegawai):
                    </div>
                    <ul className="list-disc list-inside space-y-2.5 text-gray-700 dark:text-gray-300 leading-relaxed">
                      <li>
                        <strong>Bagaimana jika ada 5 pegawai mengerjakan repo yang sama?</strong>
                        <br />
                        <span className="text-gray-600 dark:text-gray-400 ml-5 inline-block">
                          Masing-masing pegawai login ke akunnya di aplikasi ini, buka menu ini, dan jalankan perintah dengan token miliknya di laptopnya masing-masing. Karena folder <code>.git/hooks/</code> tidak ikut ter-push ke GitHub, konfigurasi tiap orang terisolasi 100% dan task masing-masing tidak akan tertukar.
                        </span>
                      </li>
                      <li>
                        <strong>Apakah perlu email pegawai?</strong>
                        <br />
                        <span className="text-gray-600 dark:text-gray-400 ml-5 inline-block">
                          Tidak perlu sama sekali. Identitas pegawai langsung terikat pada token webhook yang disematkan di laptop Anda.
                        </span>
                      </li>
                      <li>
                        <strong>Apakah aman jika server todo sedang offline?</strong>
                        <br />
                        <span className="text-gray-600 dark:text-gray-400 ml-5 inline-block">
                          Aman. Script hook diberi batas waktu (timeout 5 detik) dan berjalan setelah commit berhasil dibuat, sehingga git commit Anda tidak akan pernah terganggu atau gagal.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              ),
            },
            {
              key: 'tokens',
              label: (
                <span className="text-base font-semibold">
                  <KeyOutlined /> Kelola Token Webhook ({tokens.length})
                </span>
              ),
              children: (
                <div className="space-y-5 pt-2">
                  {/* Form Buat Token Baru */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="font-bold text-base text-gray-800 dark:text-gray-200 flex items-center justify-between">
                      <span>Buat Token Webhook Baru</span>
                      <Text type="secondary" className="text-sm">
                        Anda bisa menentukan nama perangkat atau token kustom
                      </Text>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Text className="text-base font-medium text-gray-600 block mb-1">Nama Perangkat / Proyek:</Text>
                        <Input
                          placeholder="Contoh: Laptop Kantor, MacBook, PC Rumah"
                          value={newTokenName}
                          onChange={(e) => setNewTokenName(e.target.value)}
                          size="large"
                        />
                      </div>
                      <div>
                        <Text className="text-base font-medium text-gray-600 block mb-1">Token Kustom (Opsional):</Text>
                        <Input
                          placeholder="Kosongkan untuk generate acak (min 4 karakter)"
                          value={newCustomToken}
                          onChange={(e) => setNewCustomToken(e.target.value)}
                          size="large"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        type="primary"
                        size="large"
                        icon={<PlusOutlined />}
                        loading={creatingToken}
                        onClick={handleCreateToken}
                      >
                        Buat Token
                      </Button>
                    </div>
                  </div>

                  {/* Tabel Daftar Token */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Text strong className="text-base text-gray-700 dark:text-gray-200">
                        Daftar Token Webhook Anda:
                      </Text>
                      <Button
                        icon={<ReloadOutlined spin={loadingTokens} />}
                        onClick={fetchTokens}
                      >
                        Segarkan
                      </Button>
                    </div>

                    <Table
                      dataSource={tokens}
                      columns={tokenColumns}
                      rowKey="id"
                      pagination={false}
                      loading={loadingTokens}
                      locale={{
                        emptyText: (
                          <div className="py-6 text-center text-base">
                            <Empty description="Belum ada token. Buat token pertama Anda di formulir atas." />
                          </div>
                        ),
                      }}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'test',
              label: (
                <span className="text-base font-semibold">
                  <SendOutlined /> Tes Simulasi
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <Text className="text-base text-gray-600 dark:text-gray-300 block">
                    Kirim commit simulasi untuk memastikan token webhook dan endpoint bekerja dengan baik:
                  </Text>

                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-base space-y-1.5">
                    <div className="text-gray-600 font-medium">Token yang akan digunakan:</div>
                    <code className="text-violet-600 font-mono font-bold text-base break-all">
                      {activeToken}
                    </code>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Text className="text-base font-medium text-gray-600 block mb-1">Pesan Commit:</Text>
                      <Input
                        size="large"
                        value={testCommitMsg}
                        onChange={(e) => setTestCommitMsg(e.target.value)}
                        placeholder="Contoh: feat(auth): implement quick token refresh"
                      />
                    </div>
                    <div>
                      <Text className="text-base font-medium text-gray-600 block mb-1">Branch:</Text>
                      <Input
                        size="large"
                        value={testBranch}
                        onChange={(e) => setTestBranch(e.target.value)}
                        placeholder="Contoh: main"
                      />
                    </div>
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    icon={<SendOutlined />}
                    loading={testing}
                    onClick={handleTestCommit}
                    className="w-full mt-2"
                  >
                    Kirim Simulasi Commit Sekarang
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
}

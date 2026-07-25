import React, { useState } from 'react';

import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';

import {
  LockOutlined,
  UserOutlined,
} from '@ant-design/icons';

import ThemeSelector from '../components/ThemeSelector';
import { useAuth } from '../contexts/AuthContext';
import GuestLayout from '../layouts/GuestLayout';

const { Title, Text } = Typography

export default function Login() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const onFinish = async (values) => {
    setError('')
    setLoading(true)
    try {
      await login(values.username, values.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <GuestLayout>
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <div className="absolute top-6 right-6">
          <ThemeSelector size="small" />
        </div>

        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Title level={2} className="!mb-1 font-bold tracking-tight">
              Doran Todo
            </Title>
            <Text className="text-slate-500 dark:text-slate-400">
              Masuk dengan akun masteruser Anda
            </Text>
          </div>

          <Card className="shadow-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <Form
              name="login_form"
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
            >
              {error && (
                <Form.Item>
                  <Alert
                    message={error}
                    type="error"
                    showIcon
                    closable
                    onClose={() => setError('')}
                  />
                </Form.Item>
              )}

              <Form.Item
                label="Username"
                name="username"
                rules={[{ required: true, message: 'Username tidak boleh kosong!' }]}
              >
                <Input
                  prefix={<UserOutlined className="text-slate-400" />}
                  placeholder="usernameku"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Password tidak boleh kosong!' }]}
              >
                <Input.Password
                  prefix={<LockOutlined className="text-slate-400" />}
                  placeholder="••••••••"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item>

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  size="large"
                  className="rounded-lg font-medium"
                >
                  Masuk
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </GuestLayout>
  )
}

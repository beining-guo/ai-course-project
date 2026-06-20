import { useEffect, useState } from "react";
import { Alert, Button, Form, Input, Segmented, Typography, message } from "antd";
import {
  IdcardOutlined,
  LockOutlined,
  LoginOutlined,
  ReadOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../api/auth.js";

const { Title } = Typography;

const PORT_OPTIONS = [
  { label: "学生端", value: "student", icon: <ReadOutlined /> },
  { label: "教师端", value: "teacher", icon: <TeamOutlined /> },
];

const LOGIN_COPY = {
  student: {
    title: "学生端登录",
    accountLabel: "学号",
  },
  teacher: {
    title: "教师端登录",
    accountLabel: "教师账号",
  },
};

function getRedirectPath(location) {
  const from = location.state?.from?.pathname;
  if (from && from !== "/login") return from;
  return "/knowledge/overview";
}

export default function Login({ onLogin }) {
  const [form] = Form.useForm();
  const [role, setRole] = useState("student");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const copy = LOGIN_COPY[role];

  useEffect(() => {
    setError("");
    form.resetFields();
    if (role === "teacher") {
      form.setFieldsValue({ username: "wlc", password: "wlc" });
    }
  }, [form, role]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    setError("");
    try {
      const user = await login({ role, ...values });
      onLogin(user);
      message.success(`${user.name || user.account}，登录成功`);
      navigate(getRedirectPath(location), { replace: true });
    } catch (requestError) {
      const messageText = requestError.response?.data?.message || "登录失败，请检查账号和密码";
      setError(messageText);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="人工智能原理课程系统登录">
        <div className="login-panel">
          <div className="login-panel-head">
            <span className="login-panel-icon">{role === "student" ? <IdcardOutlined /> : <UserOutlined />}</span>
            <div>
              <span className="login-panel-kicker">Intelligent Login System</span>
              <Title level={2}>{copy.title}</Title>
            </div>
          </div>

          <Segmented
            block
            className="login-role-switch"
            onChange={setRole}
            options={PORT_OPTIONS}
            value={role}
          />

          {error ? <Alert message={error} showIcon type="error" /> : null}

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
            size="large"
          >
            <Form.Item
              label={copy.accountLabel}
              name="username"
              rules={[{ required: true, message: `请输入${copy.accountLabel}` }]}
            >
              <Input
                autoComplete="username"
                maxLength={32}
                prefix={role === "student" ? <IdcardOutlined /> : <UserOutlined />}
              />
            </Form.Item>

            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password
                autoComplete="current-password"
                maxLength={40}
                prefix={<LockOutlined />}
              />
            </Form.Item>

            <Button block htmlType="submit" icon={<LoginOutlined />} loading={submitting} type="primary">
              进入{role === "student" ? "学生端" : "教师端"}
            </Button>
          </Form>
        </div>
      </section>
    </main>
  );
}

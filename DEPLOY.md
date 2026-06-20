# Vercel deployment

这个项目是 Vite React 前端 + Flask 后端。已经按单个 Vercel 项目做了适配：

- `frontend` 会构建成静态页面。
- `api/index.py` 会把 `Backend/app.py` 暴露成 Vercel Python Function。
- 浏览器访问同一个域名下的 `/api/...` 时会进入 Flask 后端。

## 本地检查

```bash
cd frontend
npm install
npm run build
```

```bash
cd ..
python -m compileall Backend api
```

## 部署步骤

1. 把整个 `课设` 文件夹上传到 GitHub 仓库。
2. 打开 Vercel，点击 `Add New` -> `Project`。
3. 选择刚上传的 GitHub 仓库。
4. Root Directory 保持仓库根目录，也就是包含 `frontend`、`Backend`、`vercel.json` 的这一层。
5. Framework Preset 可以保持自动识别；如果需要手动设置，选 `Other`。
6. Build Command 会读取 `vercel.json`：`cd frontend && npm ci && npm run build`。
7. Output Directory 会读取 `vercel.json`：`frontend/dist`。
8. 点击 `Deploy`。

部署完成后，Vercel 会给你一个 `https://xxx.vercel.app` 链接，别人打开这个链接就能看。

## 注意

后端现在用的是内存变量保存编辑后的知识库/图数据。部署到 Vercel 后，这些改动不会作为数据库长期保存，函数冷启动或重新部署后可能恢复初始数据。作为课设展示没问题；如果要多人长期维护数据，需要再接数据库。

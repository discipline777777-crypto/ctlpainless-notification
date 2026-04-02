# 无痛发文 - 崇川区通知文档处理系统

自动识别会议通知中的参会部门和单位，一键生成微信搜索关键词，轻松拉群。

## 功能特点

- 📄 支持 Word、PDF、TXT、OFD 格式文档导入
- 🏢 自动识别崇川区 90+ 部门/街道
- 👤 支持区领导秘书姓名识别
- 📱 一键生成微信搜索关键词
- 🔍 智能分类匹配（各街道、各开发区等）

## 微信联系人配置

在微信通讯录中，为每个部门/街道创建联系人，昵称格式：
- 单位：`城东街道收文`、`崇川开发区收文`、`崇川国投收文`
- 秘书：`吴佳华收文`、`李建波收文`、...

---

## 一键部署到 GitHub Pages

### 步骤 1: 上传代码到 GitHub

**方式 A: GitHub 网页上传（最简单)**
1. 下载本项目压缩包并解压
2. 访问 https://github.com/new 创建新仓库，命名为 `ctlpainless-notification`
3. 点击 "uploading an existing file"，拖入所有文件并提交

**方式 B: Git 命令行**
```bash
git clone https://github.com/你的用户名/ctlpainless-notification.git
cd ctlpainless-notification
# 解压项目文件到当前目录，覆盖原有内容
git add .
git commit -m "feat: 无痛发文系统"
git push
```

### 步骤 2: 启用 GitHub Pages

1. 进入仓库 **Settings** → **Pages**
2. **Source** 选择 **GitHub Actions**
3. 点击 **Save**

### 步骤 3: 等待自动部署

- GitHub Actions 会自动运行（约 1-2 分钟）
- 完成后访问: `https://你的用户名.github.io/ctlpainless-notification/`

---

## 本地开发

```bash
pnpm install
pnpm dev
```

## 技术栈

- React 18 + TypeScript
- TailwindCSS
- Vite
- mammoth.js（Word文档解析）
- pdfjs-dist（PDF文档解析）

## 版本历史

- v5.4 - 修复 GitHub Pages 部署白屏问题
- v5.3 - 新增区领导秘书识别
- v5.2 - 按最新收文名单核对
- v5.1 - 新增微信搜索关键词批量生成
- v5.0 - 分类关键词+精确匹配

---

**崇川区专用版**

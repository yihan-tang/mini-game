# 38-0-0 完美赛季挑战

H5休闲小游戏 - 随机抽队 / 11轮选秀 / 模拟38轮联赛 / 挑战38胜0平0负

## 本地运行

```bash
# 方式1: Python
python -m http.server 8080

# 方式2: Node.js
npx http-server . -p 8080 -c-1
```

浏览器打开 `http://localhost:8080`

## 线上访问

部署到GitHub Pages后访问: `https://<你的用户名>.github.io/<仓库名>/`

## 一键部署GitHub Pages

Windows PowerShell执行:

```powershell
# 1. 初始化Git仓库
git init
git add .
git commit -m "init: 38-0-0 H5 game"

# 2. 创建GitHub仓库并推送（替换<用户名>和<仓库名>）
gh repo create <仓库名> --public --source=. --push

# 3. 启用GitHub Pages（从main分支部署）
gh api repos/{owner}/<仓库名>/pages -X POST -f source.branch=main -f source.path=/

# 等待1-2分钟部署完成，访问线上地址
```

## 游戏玩法

1. 选择模式（英超联赛 / 国家队杯赛）
2. 随机抽取一支历史赛季球队
3. 11轮选秀组建阵容（门将x1 + 后卫x4 + 中场x4 + 前锋x2）
4. 一键模拟38轮联赛
5. 目标: 达成38胜0平0负完美赛季

## 技术栈

- 纯原生HTML + Tailwind CSS + 原生JS
- CDN引入依赖，无打包工具
- LocalStorage持久化存档
- html2canvas截图分享

# xiaozhi-webui

## 项目简介

xiaozhi-webui 是一个使用 Python + Vue3 实现的小智语音 Web 端，旨在通过代码学习和在没有硬件条件下体验 AI 小智的对话功能。

本仓库使用 Vue3 对 [xiaozhi-web-client](https://github.com/TOM88812/xiaozhi-web-client) 进行重构，并在此基础上优化和拓展。

小智美美滴头像取自 [小红书 @涂丫丫](http://xhslink.com/a/ZWjAcoOzvzq9)

## 功能特点

- **文字聊天**：像微信好友一样聊天
- **语音聊天**：和小智语音进行聊天
- **打断机制**：与小智语音通话时可以顺畅打断
- **自动配置**：自动获取 MAC 地址、更新 OTA 版本，避免繁杂的配置流程
- **反馈动效**：（语音对话时）用户的讲话波形 + 小智的回答涟漪动画
- **组件化设计**：更好的代码组织和维护性
- **状态管理优化**：使用 Pinia 进行状态管理
- **TypeScript 支持**：提供更好的类型安全和开发体验

## 项目展示

<div style="display: flex; justify-content: space-around; margin-bottom: 20px;">
    <img src="./images/聊天.jpg" alt="聊天" style="width: 45%;">
    <img src="./images/聊天3.jpg" alt="聊天3" style="width: 45%;">
</div>

<div style="display: flex; justify-content: space-around;">
    <img src="./images/设置面板.jpg" alt="设置面板" style="width: 45%;">
    <img src="./images/语音通话.jpg" alt="语音通话" style="width: 45%;">
</div>

## 环境要求

- Python 3.12.0
- Windows

## 快速开始

### 前端

1. 进入项目目录

```bash
cd frontend/xiaozhi-webui
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

```bash
cp .env.example .env
```

4. 启动项目

```bash
npm run dev
```

### 后端

1. 进入项目目录

```bash
cd backend
```

2. 安装依赖

```bash
pip install -r requirements.txt
```

3. 启动项目

```bash
python main.py
```

### 浏览页面

在自己电脑的浏览器中输入 `localhost:5173` 即可访问

<img src="./images/页面展示.jpg" alt="页面展示" style="width: 100%;">

## 状态流转图

```
                          reconnect
                        +-----------+
                        |           |
                        v           |
    Text message  +------------+    |     +-------------------+            +-------------------+
    +-----------> | CONNECTING | ---+---> |                   | ---------> |                   |
    |             +------------+          |     Websocket     |            |      Xiaozhi      |
    |             +------------+          |       Proxy       |            |       Server      |
    +------------ |  SPEAKING  | <------- |                   | <--------- |                   |
    Speak complet +------------+          +-------------------+            +-------------------+

```

## 项目结构

```
├── backend                             # 后端代码
│   ├── app                             # 应用程序内的代码逻辑
│   |   ├── constant                    # 常量
│   |   ├── libs                        # 工具库
│   |   ├── proxy                       # websocket 代理
│   |   ├── router                      # 路由
│   │   └── config.py                   # 配置文件
│   ├── main.py                         # 程序入口
│   └── requirements.txt                # 依赖库列表
├── frontend/xiaozhi-webui              # 前端代码
│   └── src                             
│       ├── assets                      # 静态资源
│       ├── components                  # 组件目录
│       │   ├── Header                  # 头部组件
│       │   ├── Setting                 # 设置面板组件
│       │   ├── VoiceCall               # 语音通话组件
│       │   ├── InputField              # 输入框组件
│       │   └── ChatContainer           # 聊天容器组件
│       ├── services                 # 组合式函数
│       │   ├── useWebSocket            # WebSocket 相关逻辑
│       │   ├── useVoiceState           # 语音状态管理
│       │   └── useVoiceAnimation       # 语音动画效果
│       ├── stores                      # 状态管理
│       ├── types                       # 类型定义
│       ├── utils                       # 工具函数
│       ├── App.vue                     # 根组件
│       └── main.ts 
├── .gitignore                          # Git 忽略文件
├── LICENSE                             # 许可证文件
└── README.md                           # 项目说明文件
```

## 技术栈

### 前端
- Vue 3
- TypeScript
- Pinia
- WebSocket
- Web Audio API
- AudioWorklet

### 后端
- Python 3.12.0
- FastAPI
- WebSocket

## 贡献

欢迎提交 Issues 和 Pull Requests！

## 感谢以下开源/分享人员-排名不分前后

[Huang-junsen](https://github.com/Huang-junsen)

[TOM88812](https://github.com/TOM88812)

[小红书 @涂丫丫](http://xhslink.com/a/ZWjAcoOzvzq9)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yang-zhihang/xiaozhi-webui&type=Date)](https://www.star-history.com/#yang-zhihang/xiaozhi-webui&Date)
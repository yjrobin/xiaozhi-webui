# xiaozhi-webui

> 本项目供学习交流使用，如果有问题欢迎联系 zamyang@qq.com

## 项目简介

声明：「小智」项目起源于 [虾哥](https://github.com/78/xiaozhi-esp32) 之手。

本项目 xiaozhi-webui 是一个使用 Python + Vue3 实现的小智语音 Web 端，旨在通过代码学习和在没有硬件条件下体验 AI 小智的对话功能。

本仓库使用 Vue3 基于 [xiaozhi-web-client](https://github.com/TOM88812/xiaozhi-web-client) 进行重构，并进行了一定的优化和拓展。

小智美美滴头像取自 [小红书 @涂丫丫](http://xhslink.com/a/ZWjAcoOzvzq9)

## 演示

<div style="display: flex; justify-content: space-around; margin-bottom: 20px;">
    <img src="./images/聊天.jpg" alt="聊天" style="width: 45%;">
    <img src="./images/聊天3.jpg" alt="聊天3" style="width: 45%;">
</div>

<div style="display: flex; justify-content: space-around;">
    <img src="./images/设置面板.jpg" alt="设置面板" style="width: 45%;">
    <img src="./images/语音通话.jpg" alt="语音通话" style="width: 45%;">
</div>

## 功能特点

- [x] 文字聊天：像微信好友一样聊天
- [x] 语音聊天：和小智进行语音对话，支持打断
- [x] 自动配置：自动获取 MAC 地址、更新 OTA 版本，避免繁杂的配置流程
- [x] 反馈动效：（语音对话时）用户的说话波形 + 小智回答时的头像缩放动画
- [x] 移动适配：支持移动端配置服务器地址

## 系统要求
- Python 3.9+
- NodeJS 18+
- 支持的操作系统：Windows 10+、macOS 10.15+、Linux

## 快速开始

### 前端

1. 进入项目目录

```bash
cd frontend
```

2. 安装依赖

```bash
npm install
```

3. 启动项目

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

## 项目实现框图

```
                      reconnect
                    +-----------+
                    |           |
                    v           |
Text message  +------------+    |     +-------------------+            +-------------------+
+-----------> | CONNECTING | ---+---> |                   | ---------> |                   |
|             +------------+          |     Websocket     |            |      Xiaozhi      |
|             +------------+          |       Proxy       |            |       Server      |
+------------ |  AI_SPEAK  | <------- |                   | <--------- |                   |
Speak complet +------------+          +-------------------+            +-------------------+
```

## 主要逻辑框图

本项目的小智语音通话部分主要使用 "状态驱动" 的设计模式，以下是主要逻辑框图：
```
state change process
+------------------+        +--------------------------+        +------------------+
|  oldState.onExit | -----> | current_state = newState | -----> | newState.onEnter |
+------------------+        +--------------------------+        +------------------+
```
```
user speak process                      +--------------------------------+             
                                        |          circulation           |             
                                        v                                |             
+--------------------+        +--------------------+        +------------------------+ 
| getUserMediaStream | -----> | detect audio level | -----> | handleUserAudioLevel() | 
+--------------------+        +--------------------+        +------------------------+ 
```
```
ai speak process
+----------------------------------------------------------+
|                    audioQueue.empty() ?                  |
+----------------------------------------------------------+
           | no                           | yes         ^   
           v                              v             |   
+---------------------------+     +--------------+      |   
| audio = audioQueue.pop()  |     | state = idle |      |   
+---------------------------+     +--------------+      |   
       |                                                |   
       v                                                |   
+------------+                                      +------+
| play audio | -----------------------------------> | done |
+------------+                                      +------+
```

## 项目结构

```
├── backend
│   ├── app
│   |   ├── constant                    # 常量
│   |   ├── libs                        # 工具
│   |   ├── proxy                       # websocket 代理
│   |   ├── router                      # 路由
│   │   └── config.py                   # 配置
│   ├── main.py                         # 入口
│   └── requirements.txt                # 包依赖
├── frontend
│   └── src
│       ├── assets                      # 静态资源
│       ├── components                  # 组件
│       ├── services                    # 模块化服务
│       ├── stores                      # 全局状态管理
│       ├── types                       # 类型定义
│       ├── utils                       # 工具
│       ├── App.vue                     # 入口
│       └── main.ts 
├── .gitignore
├── LICENSE
└── README.md
```

## 技术栈

**前端**
- 框架： Vue3 + TS + Pinia
- Web API: WebSocket、Web Audio API、AudioWorklet

**后端**
- Python 3.12.0 + FastAPI
- WebSocket

## 贡献

欢迎提交问题报告和代码贡献。请确保遵循以下规范：

1. Python 代码风格符合 PEP8 规范
2. Vue 代码按单一指责进行模块化管理
3. 更新相关文档

## 感谢以下开源/分享人员（排名不分前后）

[虾哥](https://github.com/78)
[Huang-junsen](https://github.com/huangjunsen0406)
[TOM88812](https://github.com/TOM88812)
[小红书 @涂丫丫](http://xhslink.com/a/ZWjAcoOzvzq9)

## Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=yang-zhihang/xiaozhi-webui&type=Date)](https://www.star-history.com/#yang-zhihang/xiaozhi-webui&Date)
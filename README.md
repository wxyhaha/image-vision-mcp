# image-vision-mcp

一个轻量的 **stdio MCP server**,给你的 AI 编程助手(Codex、Claude Code 等)加上**看图能力**。

它只暴露一个工具 `describe_image`:接收本地文件路径、HTTP(S) 链接或 base64 data URI,发给任意 **OpenAI 兼容**的 `/v1/chat/completions` 多模态端点,返回一段详细的文字描述,供调用方模型使用。

无需原生二进制、无需 Python —— 整个服务只有一个 Node.js 文件和唯一依赖 `@modelcontextprotocol/sdk`。

---

## 功能特性

- `describe_image` 工具,后端为 OpenAI 兼容的视觉模型
- 支持 **本地文件路径**、**http(s) 链接**、**base64 data URI** 三种输入
- 内置 20 MB 图片体积上限保护
- 全部参数通过环境变量配置(模型、端点、鉴权 token)
- 兼容任何 MCP 客户端:Codex、Claude Code 等

---

## 运行环境要求

- [Node.js](https://nodejs.org/) `>= 18`(需要内置全局 `fetch`)
- 一个 OpenAI 兼容的多模态端点。可以是:
  - 本地代理,例如 [CC Switch](https://github.com/farion1231/cc-switch),运行在 `127.0.0.1:15721`
  - 云厂商(OpenAI 等)
  - 自建网关

---

## 安装

```bash
git clone https://github.com/wxyhaha/image-vision-mcp.git
cd image-vision-mcp
npm install
```

> 无需全局安装 —— MCP 客户端通过 `node server.js` 启动本服务。

---

## 配置说明

全部通过环境变量配置:

| 变量名               | 默认值                        | 说明                                                                 |
| -------------------- | ----------------------------- | --------------------------------------------------------------------- |
| `VISION_PROXY_BASE`  | `http://127.0.0.1:15721`      | OpenAI 兼容端点的根地址(本服务会自动拼接 `/v1/chat/completions`)。   |
| `VISION_MODEL`       | `mimo-v2.5`                   | 要调用的多模态模型名称。                                              |
| `VISION_PROXY_TOKEN` | *(空)*                        | 作为 `Authorization: Bearer <token>` 发送的鉴权 token,为空时回退到 `"none"`。 |

---

## 在 Codex 中使用

把下面这段加到 `~/.codex/config.toml`(Windows 下为 `%USERPROFILE%\.codex\config.toml`):

```toml
[mcp_servers.image_vision]
args = ['<本仓库的绝对路径>/server.js']
command = 'node'
startup_timeout_sec = 15

[mcp_servers.image_vision.env]
VISION_MODEL = "mimo-v2.5"
VISION_PROXY_BASE = "http://127.0.0.1:15721"
# 可选: VISION_PROXY_TOKEN = "sk-..."
```

然后重启 Codex,给它发一张图片,模型会自动调用 `describe_image`。

### 直连端点(不走本地代理)

```toml
[mcp_servers.image_vision.env]
VISION_MODEL = "gpt-4o"
VISION_PROXY_BASE = "https://api.openai.com/v1"
VISION_PROXY_TOKEN = "sk-your-key-here"
```

---

## 在 Claude Code 中使用

添加一个指向本仓库的 MCP server:

```bash
claude mcp add image-vision-mcp -- node /本仓库的绝对路径/image-vision-mcp/server.js
```

然后设置环境变量(在你的 shell 或 Claude Code 配置里):

```bash
export VISION_PROXY_BASE="http://127.0.0.1:15721"
export VISION_MODEL="mimo-v2.5"
export VISION_PROXY_TOKEN="sk-..."   # 可选
```

---

## 验证安装是否成功

```bash
npm run check   # 对 server.js 做语法检查
npm start        # 应正常启动并在 stdio 上等待,按 Ctrl+C 退出
```

完整链路冒烟测试:通过你的 MCP 客户端发一张图,看是否返回文字描述即可。

---

## 工作原理

1. MCP 客户端收到模型给出的图片引用。
2. 调用本服务的 `describe_image`,传入 `image_path`(和可选的 `question`)。
3. 本服务读取文件(或拉取 URL),编码为 base64 data URI,以 `VISION_MODEL` 指定的模型 POST 到 `${VISION_PROXY_BASE}/v1/chat/completions`。
4. 返回的文字描述作为工具输出交还给调用方模型。

---

## 国内推送/克隆注意事项

若本机直连 `github.com:443` 报 OpenSSL `SSL_ERROR_SYSCALL` 等错误,通常是网络问题。给 git 配上代理即可:

```powershell
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
```

取消代理:

```powershell
git config --global --unset http.proxy
git config --global --unset https.proxy
```

---

## 许可协议

MIT

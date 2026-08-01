// Koneksi ke MCP Orkay (stdio). Di-spawn sekali saat Brain start & dijaga tetap hidup.
// Menyediakan listTools() (untuk dikonversi ke tools LLM) & callTool().
import 'dotenv/config'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, isAbsolute } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function resolveEntry() {
  const raw = process.env.MCP_ENTRY || '../mcp/src/index.js'
  return isAbsolute(raw) ? raw : resolve(__dirname, '..', raw)
}

class McpOrkay {
  constructor() {
    this.client = null
    this.transport = null
    this.tools = []
    this._connecting = null
  }

  async connect() {
    if (this.client) return this.client
    if (this._connecting) return this._connecting
    this._connecting = this._doConnect()
    try {
      return await this._connecting
    } finally {
      this._connecting = null
    }
  }

  async _doConnect() {
    const entry = resolveEntry()
    // Teruskan env yang dibutuhkan proses MCP (URL & PIN Orkay).
    this.transport = new StdioClientTransport({
      command: process.execPath, // node yang sama
      args: [entry],
      env: {
        ...process.env,
        ORKAY_API_URL: process.env.ORKAY_API_URL || 'http://localhost:3001',
        ORKAY_PIN: process.env.ORKAY_PIN || '123456',
      },
      stderr: 'inherit', // log MCP tampil di console Brain
    })

    // Kalau proses MCP mati, reset supaya bisa di-connect ulang otomatis.
    this.transport.onclose = () => {
      console.error('[brain] koneksi MCP tertutup — akan reconnect saat panggilan berikutnya.')
      this.client = null
      this.transport = null
    }

    const client = new Client({ name: 'orkay-brain', version: '0.1.0' })
    await client.connect(this.transport)
    this.client = client

    const { tools } = await client.listTools()
    this.tools = tools
    console.error(`[brain] MCP Orkay tersambung. ${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`)
    return client
  }

  async listTools() {
    await this.connect()
    return this.tools
  }

  async callTool(name, args) {
    const client = await this.connect()
    const res = await client.callTool({ name, arguments: args || {} })
    const text = (res.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
    return { text, isError: !!res.isError }
  }

  async close() {
    try {
      await this.client?.close()
    } catch { /* noop */ }
    this.client = null
    this.transport = null
  }
}

export const mcp = new McpOrkay()

// LLM layer via 9Router (OpenAI-compatible). Menjalankan agent loop tool-calling:
// LLM memilih tool MCP -> Brain eksekusi -> hasil di-feed balik -> ulang s/d teks final.
import 'dotenv/config'
import OpenAI from 'openai'
import { mcp } from './mcp-client.js'
import { buildSystemPrompt } from './prompt.js'

const MODEL = process.env.LLM_MODEL || 'cc/claude-opus-4-8'
const MAX_ITERATIONS = Number(process.env.LLM_MAX_ITER) || 5
// Kontrol biaya token: batasi output per panggilan (default 1024).
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS) || 1024

const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.LLM_API_KEY || 'missing-key',
  // 9Router di belakang Cloudflare memblokir User-Agent yang mengandung "OpenAI".
  // Override jadi UA netral agar tidak kena 403.
  defaultHeaders: { 'User-Agent': 'orkay-brain/1.0' },
  // Timeout & retry ringan (opsi standar SDK openai v7).
  timeout: Number(process.env.LLM_TIMEOUT_MS) || 30000,
  maxRetries: Number(process.env.LLM_MAX_RETRIES) || 2,
})

// Konversi daftar tool MCP -> format "tools" OpenAI (function calling).
function toOpenAITools(mcpTools) {
  return mcpTools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description || '',
      parameters: t.inputSchema || { type: 'object', properties: {} },
    },
  }))
}

/**
 * Proses satu giliran percakapan.
 * @param {string} userText - pesan user
 * @param {Array} history - riwayat [{role, content}] sebelumnya (tanpa system)
 * @returns {Promise<{reply: string, messages: Array}>} balasan + messages terbaru (untuk disimpan)
 */
export async function runAgent(userText, history = []) {
  const mcpTools = await mcp.listTools()
  const tools = toOpenAITools(mcpTools)

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history,
    { role: 'user', content: userText },
  ]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
    })

    const msg = res.choices?.[0]?.message
    if (!msg) throw new Error('Respons LLM kosong.')
    messages.push(msg)

    const calls = msg.tool_calls || []
    if (calls.length === 0) {
      // Tidak ada tool call -> ini jawaban final.
      return { reply: (msg.content || '').trim(), messages }
    }

    // Eksekusi semua tool call, feed hasilnya balik.
    for (const call of calls) {
      const name = call.function?.name
      let args = {}
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {}
      } catch {
        args = {}
      }
      let resultText
      try {
        const out = await mcp.callTool(name, args)
        resultText = out.text || '(tidak ada output)'
      } catch (err) {
        resultText = `ERROR menjalankan ${name}: ${err.message}`
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: resultText,
      })
    }
  }

  // Batas iterasi tercapai — minta LLM merangkum tanpa tool.
  const finalRes = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      ...messages,
      { role: 'user', content: 'Rangkum hasilnya buat saya dalam 1-2 kalimat, tanpa memanggil tool lagi.' },
    ],
    temperature: 0.2,
    max_tokens: MAX_TOKENS,
  })
  const finalMsg = finalRes.choices?.[0]?.message
  messages.push(finalMsg)
  return { reply: (finalMsg?.content || 'Selesai.').trim(), messages }
}

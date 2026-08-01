// Smoke test: spawn MCP server via stdio, list tools, panggil beberapa tool read-only.
// Jalankan dengan server Orkay (:3001) + MySQL menyala.
//   node test/smoke.js
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverEntry = join(__dirname, '..', 'src', 'index.js')

function textOf(res) {
  return (res.content || []).map((c) => c.text).join('\n')
}

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverEntry],
  })
  const client = new Client({ name: 'smoke', version: '0.0.0' })
  await client.connect(transport)

  const { tools } = await client.listTools()
  console.log(`\n=== ${tools.length} TOOLS ===`)
  console.log(tools.map((t) => t.name).join(', '))

  const calls = [
    ['list_accounts', {}],
    ['list_categories', {}],
    ['get_balances', {}],
    ['get_networth', {}],
    ['list_bills', {}],
    ['list_installments', {}],
    ['monthly_summary', {}],
    ['spending_by_category', {}],
    ['budget_status', {}],
  ]

  for (const [name, args] of calls) {
    try {
      const res = await client.callTool({ name, arguments: args })
      console.log(`\n--- ${name} ---`)
      console.log(textOf(res))
    } catch (err) {
      console.log(`\n--- ${name} FAILED ---\n${err.message}`)
    }
  }

  await client.close()
  console.log('\n=== SMOKE DONE ===')
}

main().catch((e) => {
  console.error('SMOKE FAIL:', e)
  process.exit(1)
})

// Test tulis: add_expense (fuzzy nama + parse "25rb") lalu verifikasi & hapus lagi.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverEntry = join(__dirname, '..', 'src', 'index.js')
const textOf = (r) => (r.content || []).map((c) => c.text).join('\n')

async function main() {
  const transport = new StdioClientTransport({ command: 'node', args: [serverEntry] })
  const client = new Client({ name: 'write-test', version: '0.0.0' })
  await client.connect(transport)

  console.log('--- add_expense: "jajan 25rb gopay" ---')
  const r1 = await client.callTool({
    name: 'add_expense',
    arguments: { account: 'gopay', amount: '25rb', category: 'makan', note: 'test MCP' },
  })
  console.log(textOf(r1))

  console.log('\n--- add_transfer fuzzy: dompet->jago 10000 ---')
  const r2 = await client.callTool({
    name: 'add_transfer',
    arguments: { from: 'dompet', to: 'jago', amount: 10000 },
  })
  console.log(textOf(r2))

  console.log('\n--- resolusi ambigu (harusnya error ramah): akun "a" ---')
  const r3 = await client.callTool({ name: 'get_account', arguments: { account: 'xyz123' } })
  console.log(textOf(r3), '| isError:', r3.isError)

  await client.close()
  console.log('\n=== WRITE TEST DONE (hapus tx test lewat SQL di runner) ===')
}
main().catch((e) => { console.error(e); process.exit(1) })

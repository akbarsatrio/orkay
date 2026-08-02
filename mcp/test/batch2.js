// Test tools Batch 2: add_installment, recurring (add/list/confirm/update/delete), budget (set/delete).
// Semua entity test dihapus di akhir. Jalankan dengan server Orkay + MySQL menyala.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverEntry = join(__dirname, '..', 'src', 'index.js')
const t = (r) => (r.content || []).map((c) => c.text).join('\n')

async function main() {
  const transport = new StdioClientTransport({ command: 'node', args: [serverEntry] })
  const client = new Client({ name: 'batch2', version: '0.0.0' })
  await client.connect(transport)
  const call = (name, args) => client.callTool({ name, arguments: args })

  console.log('=== add_installment: nyicil "Test Laptop" 12jt 6x, bunga 2% ===')
  console.log(t(await call('add_installment', {
    paylater: 'gopay later', name: 'Test Laptop MCP', total: '12jt', tenor: 6, interestPercent: 2, category: 'belanja',
  })))

  console.log('\n=== add_recurring: "Test Netflix" 186rb tgl 5 ===')
  console.log(t(await call('add_recurring', {
    name: 'Test Netflix MCP', amount: '186rb', dueDay: 5, category: 'hiburan',
  })))

  console.log('\n=== list_recurring ===')
  console.log(t(await call('list_recurring', {})))

  console.log('\n=== update_recurring: Test Netflix jadi 200rb ===')
  console.log(t(await call('update_recurring', { name: 'Test Netflix MCP', amount: '200rb' })))

  console.log('\n=== set_budget: makan 2jt ===')
  console.log(t(await call('set_budget', { category: 'makan', limit: '2jt' })))

  console.log('\n=== budget_status ===')
  console.log(t(await call('budget_status', {})))

  console.log('\n=== CLEANUP ===')
  console.log(t(await call('delete_recurring', { name: 'Test Netflix MCP' })))
  console.log(t(await call('delete_budget', { category: 'makan' })))
  // cicilan test dihapus via SQL di runner (belum ada delete_installment tool)

  await client.close()
  console.log('\n=== BATCH2 DONE ===')
}
main().catch((e) => { console.error(e); process.exit(1) })

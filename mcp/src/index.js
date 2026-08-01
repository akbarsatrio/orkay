#!/usr/bin/env node
// Orkay MCP Server (stdio).
// Meng-expose tool keuangan Orkay agar bisa dipakai AI (mis. lewat Brain/WhatsApp).
import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { registerTransactionTools } from './tools/transactions.js'
import { registerAccountTools } from './tools/accounts.js'
import { registerBillTools } from './tools/bills.js'
import { registerReportTools } from './tools/reports.js'
import { registerMasterTools } from './tools/master.js'

const server = new McpServer({
  name: 'orkay',
  version: '0.1.0',
})

registerTransactionTools(server)
registerAccountTools(server)
registerBillTools(server)
registerReportTools(server)
registerMasterTools(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Jangan log ke stdout (dipakai protokol). Gunakan stderr untuk info.
  console.error('[orkay-mcp] siap. Tools: transaksi, saldo, tagihan, cicilan, laporan, master.')
}

main().catch((err) => {
  console.error('[orkay-mcp] fatal:', err)
  process.exit(1)
})

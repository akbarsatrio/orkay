import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import * as newUi from '../components/ui/index.jsx'
import * as legacyUi from '../legacy/components/ui/index.jsx'
import { useUiVersion } from './UiVersionContext.jsx'

const ConfirmContext = createContext(null)

// Dialog konfirmasi bersama untuk aksi hapus.
// confirm({ title, message, detail?, confirmLabel?, onConfirm }). onConfirm dijalankan dari dialog:
// dialog tetap terbuka selama proses, dan menampilkan pesan error kalau gagal (tidak ditutup diam-diam).
export function ConfirmProvider({ children }) {
  const { ui } = useUiVersion()
  // Tampilan lama tetap memakai komponen lamanya sendiri (hapus cabang ini saat tampilan lama dihapus).
  const { Button, Modal } = ui === 'legacy' ? legacyUi : newUi
  const [req, setReq] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const returnFocus = useRef(null)

  const confirm = useCallback((options) => {
    returnFocus.current = document.activeElement
    setError('')
    setBusy(false)
    setReq(options)
  }, [])

  const finish = () => {
    setReq(null)
    const el = returnFocus.current
    if (el?.isConnected) el.focus()
  }

  const close = useCallback(() => {
    if (busy) return
    finish()
  }, [busy])

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      await req.onConfirm()
      setBusy(false)
      finish()
    } catch (err) {
      setBusy(false)
      setError(err?.message || 'Gagal menghapus. Coba lagi.')
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!req}
        onClose={close}
        title={req?.title}
        size="sm"
        footer={
          <>
            {/* Fokus awal di "Batal": Enter tidak langsung menghapus. */}
            <Button variant="secondary" size="lg" className="sm:h-9 sm:px-4" onClick={close} disabled={busy} autoFocus>
              Batal
            </Button>
            <Button variant="danger" size="lg" className="sm:h-9 sm:px-4" onClick={run} disabled={busy}>
              <Trash2 size={16} />
              {busy ? 'Menghapus…' : req?.confirmLabel || 'Hapus'}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-fg">{req?.message}</p>
          {req?.detail && <p className="text-xs text-muted leading-relaxed">{req.detail}</p>}
          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-negative/[0.06] border border-negative/25">
              <AlertTriangle size={16} className="text-negative shrink-0 mt-0.5" />
              <p className="text-xs text-negative">{error}</p>
            </div>
          )}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

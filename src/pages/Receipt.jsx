import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Printer, ArrowLeft, Loader2, AlertCircle, MapPin, User, Phone, CheckCircle2 } from 'lucide-react'
import BackButton from '../components/BackButton.jsx'
import QRCode from '../components/QRCode.jsx'
import Logo from '../components/Logo.jsx'
import { fetchShipment } from '../lib/api.js'
import { formatPrice } from '../lib/pricing.js'
import { trackUrl } from '../lib/links.js'
import { buildReceipt, formatReceiptDate, formatReceiptDateTime } from '../lib/receipt.js'

// Printable receipt for a single shipment. On screen it sits inside the normal
// app chrome; the @media print rules in index.css strip the header/footer and
// anything marked .no-print, so window.print() yields a clean sheet.
export default function Receipt() {
  const { tracking } = useParams()
  const [shipment, setShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const s = await fetchShipment(tracking)
        if (cancelled) return
        if (!s) setError('No shipment found for that tracking number.')
        else setShipment(s)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load this receipt.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tracking])

  const receipt = buildReceipt(shipment)

  if (loading) {
    return (
      <div className="bg-hero-grad min-h-[70vh]">
        <div className="container-x flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-brand-500" />
        </div>
      </div>
    )
  }

  if (error || !receipt) {
    return (
      <div className="bg-hero-grad min-h-[70vh]">
        <BackButton className="ml-4 mt-4" />
        <div className="container-x py-16">
          <div className="mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertCircle size={16} className="shrink-0" /> {error || 'Receipt unavailable.'}
          </div>
          <div className="mt-6 text-center">
            <Link to="/dashboard" className="btn-secondary">
              <ArrowLeft size={16} /> Back to your shipments
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-hero-grad min-h-[70vh]">
      <BackButton className="ml-4 mt-4 no-print" />

      <div className="container-x py-10 sm:py-14">
        {/* Screen-only actions */}
        <div className="no-print mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Receipt</h1>
            <p className="text-sm text-ink-muted">
              {receipt.receiptNumber} · {formatReceiptDate(receipt.issuedAt)}
            </p>
          </div>
          <div className="flex gap-3">
            <Link to={`/track?number=${encodeURIComponent(receipt.trackingNumber)}`} className="btn-secondary">
              Track parcel
            </Link>
            <button type="button" onClick={() => window.print()} className="btn-primary">
              <Printer size={16} /> Print / Save PDF
            </button>
          </div>
        </div>

        {/* The sheet */}
        <div className="print-sheet mx-auto max-w-3xl">
          <div className="card overflow-hidden p-8 sm:p-10">
            {/* Letterhead */}
            <div className="print-keep flex flex-wrap items-start justify-between gap-6 border-b border-ink/10 pb-6">
              <div>
                <Logo />
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-ink-muted">
                  DropOff Logistics · Send anything, anywhere in the world.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold uppercase tracking-wide text-ink-muted">Receipt</div>
                <div className="text-lg font-extrabold text-ink">{receipt.receiptNumber}</div>
                <div className="mt-1 text-xs text-ink-muted">
                  Issued {formatReceiptDate(receipt.issuedAt)}
                </div>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
                  <CheckCircle2 size={12} /> Paid
                </span>
              </div>
            </div>

            {/* Shipment summary + QR */}
            <div className="print-keep mt-6 flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wide text-ink-muted">Tracking number</div>
                <div className="text-xl font-extrabold tracking-wide text-ink">{receipt.trackingNumber}</div>
                <div className="pt-2 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{shipment.from?.name}</span>
                  {' → '}
                  <span className="font-semibold text-ink">{shipment.to?.name}</span>
                </div>
                <div className="text-sm text-ink-muted">
                  {receipt.serviceName} · {shipment.weightKg} kg · {shipment.parcelType}
                  {' · '}~{shipment.etaDays} business day{shipment.etaDays > 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <QRCode
                  value={trackUrl(receipt.trackingNumber)}
                  size={104}
                  title={`Scan to track ${receipt.trackingNumber}`}
                />
                <span className="text-[10px] font-medium text-ink-muted">Scan to track</span>
              </div>
            </div>

            {/* Sender / recipient */}
            <div className="print-keep mt-8 grid gap-6 border-t border-ink/10 pt-6 sm:grid-cols-2">
              <Party title="Sender" contact={shipment.sender} place={shipment.from?.name} />
              <Party title="Recipient" contact={shipment.recipient} place={shipment.to?.name} />
            </div>

            {/* Charges */}
            <div className="print-keep mt-8 border-t border-ink/10 pt-6">
              <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">Charges</div>

              {receipt.reconciled ? (
                <table className="w-full text-sm">
                  <tbody>
                    {receipt.lines.map((line) => (
                      <tr key={line.key} className="border-b border-ink/5 last:border-0">
                        <td className="py-2 text-ink-soft">{line.label}</td>
                        <td className="py-2 text-right font-medium text-ink">
                          {formatPrice(line.amount, receipt.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                // Rates changed since booking, so the recomputed lines wouldn't
                // sum to what was actually charged. Show the total only.
                <p className="text-sm text-ink-muted">
                  Itemised breakdown unavailable for this shipment (rates have changed since it was
                  booked). The total below is the amount charged at booking.
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t-2 border-ink/20 pt-4">
                <span className="text-base font-bold text-ink">Total paid</span>
                <span className="text-2xl font-extrabold text-ink">{receipt.formattedTotal}</span>
              </div>
              <p className="mt-1 text-right text-xs text-ink-muted">
                All amounts in {receipt.currency}
              </p>
            </div>

            {/* Footer note */}
            <div className="print-keep mt-8 border-t border-ink/10 pt-5 text-xs leading-relaxed text-ink-muted">
              <p>
                Booked {formatReceiptDateTime(receipt.issuedAt)}. Current status:{' '}
                <span className="font-semibold text-ink-soft">{shipment.delivered ? 'Delivered' : shipment.status}</span>.
              </p>
              <p className="mt-1">
                Prices are demo estimates. Keep this receipt for your records — track your parcel any
                time at the link encoded above.
              </p>
              {/* Paper-only: the URL isn't clickable in print, so spell it out. */}
              <p className="print-only mt-2">{trackUrl(receipt.trackingNumber)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Sender/recipient block on the receipt. Falls back to the route place name
// when a legacy shipment has no stored contact details.
function Party({ title, contact, place }) {
  const has = contact?.name
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
        <User size={13} /> {title}
      </div>
      {has ? (
        <div className="space-y-1 text-sm">
          <div className="font-semibold text-ink">{contact.name}</div>
          {contact.address && (
            <div className="flex items-start gap-1.5 text-ink-soft">
              <MapPin size={13} className="mt-0.5 shrink-0 text-ink-muted" />
              <span>{contact.address}{contact.city ? `, ${contact.city}` : ''}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-1.5 text-ink-soft">
              <Phone size={13} className="shrink-0 text-ink-muted" /> {contact.phone}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-ink-muted">{place || 'Not provided'}</div>
      )}
    </div>
  )
}

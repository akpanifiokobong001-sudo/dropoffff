// Single source of truth for DropOff's public contact details.
// Update these here and every surface (footer, About, floating button) follows.

export const CONTACT_EMAIL = 'dropoffdeliveryservice@aol.com'

// WhatsApp number for reaching a company representative.
// `DISPLAY` is human-readable; `E164` is digits-only for wa.me links.
export const WHATSAPP_DISPLAY = '+1 (835) 264 5977'
export const WHATSAPP_E164 = '18352645977'

// Pre-filled greeting that opens with the chat (URL-encoded by buildWhatsAppLink).
export const WHATSAPP_DEFAULT_MESSAGE = 'Hi DropOff, I have a question about'

export function buildWhatsAppLink(message = WHATSAPP_DEFAULT_MESSAGE) {
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${WHATSAPP_E164}${text}`
}

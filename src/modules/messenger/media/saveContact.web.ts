import type { ContactDetails } from '../lib/vcard'

export type SaveContactResult = 'saved' | 'cancelled' | 'denied'

/** Browsers have no address book: like the reference card, "Save contact" downloads the .vcf (the OS offers to import it). */
export async function saveContact(c: ContactDetails, downloadUrl: string | null): Promise<SaveContactResult> {
  if (!downloadUrl || typeof document === 'undefined') return 'cancelled'
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `${c.name.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Contact'}.vcf`
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  return 'saved'
}

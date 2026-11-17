import { Contact, requestPermissionsAsync, type CreateContactRecord } from 'expo-contacts'
import type { ContactDetails } from '../lib/vcard'

export type SaveContactResult = 'saved' | 'cancelled' | 'denied'

/** expo-contacts labels; a number without a vCard TYPE is saved as mobile (WhatsApp does the same). */
const label = (value?: string) => (value ?? 'Mobile').toLowerCase()

export function contactRecord(c: ContactDetails): CreateContactRecord {
  return {
    givenName: c.name.slice(0, 80),
    phones: c.phones.map(p => ({ number: p.number, label: label(p.label) })),
    emails: c.emails.map(address => ({ address, label: 'other' })),
  }
}

/**
 * The phone's own "Create contact" form, filled in from the card, so the person reviews it and picks the account
 * (Android Intent.ACTION_INSERT / iOS CNContactViewController: no contacts permission needed). If the form cannot open,
 * JM asks for the contacts permission and adds the contact itself.
 */
export async function saveContact(c: ContactDetails, _downloadUrl: string | null): Promise<SaveContactResult> {
  const record = contactRecord(c)
  try {
    return (await Contact.presentCreateForm(record)) ? 'saved' : 'cancelled'
  } catch {
    const permission = await requestPermissionsAsync()
    if (!permission.granted) return 'denied'
    await Contact.create(record)
    return 'saved'
  }
}

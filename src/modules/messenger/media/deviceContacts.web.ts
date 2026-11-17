import { buildVCard, type PhoneContact } from './contactModel'
import type { PickedFile } from './model'
import { vcardName, type DeviceContact } from './selection'

/** Browsers have no address book list: the reference shows "type the details" (and Chrome's one-off picker). */
export const deviceContactsSupported = false
export type ContactsAccess = 'granted' | 'undetermined' | 'denied' | 'blocked'
export const contactsAccess = async (): Promise<ContactsAccess> => 'blocked'
export const requestContactsAccess = async (): Promise<ContactsAccess> => 'blocked'
export const loadDeviceContacts = async (): Promise<DeviceContact[]> => []

export async function vcardFile(contact: PhoneContact): Promise<PickedFile> {
  const file = new File([buildVCard(contact)], vcardName(contact), { type: 'text/vcard' })
  const uri = URL.createObjectURL(file)
  return { name: file.name, uri, file, mime: file.type, size: file.size, dispose: () => URL.revokeObjectURL(uri) }
}

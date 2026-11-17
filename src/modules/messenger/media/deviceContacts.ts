import { Contact, ContactField, ContactsSortOrder, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts'
import { File, Paths } from 'expo-file-system'
import { randomUUID } from 'expo-crypto'
import { buildVCard, type PhoneContact } from './contactModel'
import type { PickedFile } from './model'
import { cleanContact, vcardName, type DeviceContact } from './selection'

/** The phone's address book (Android/iOS). The browser build types the details instead (reference). */
export const deviceContactsSupported = true
export type ContactsAccess = 'granted' | 'undetermined' | 'denied' | 'blocked'

const access = (response: { granted: boolean; canAskAgain: boolean; status: string }): ContactsAccess =>
  response.granted ? 'granted' : response.status === 'undetermined' ? 'undetermined' : response.canAskAgain ? 'denied' : 'blocked'
export const contactsAccess = async () => access(await getPermissionsAsync())
export const requestContactsAccess = async () => access(await requestPermissionsAsync())

const FIELDS = [ContactField.FULL_NAME, ContactField.PHONES, ContactField.EMAILS] as const
/** Every contact with a name and a phone or email, sorted as the phone sorts them. Read once per page opening. */
export async function loadDeviceContacts(): Promise<DeviceContact[]> {
  const rows = await Contact.getAllDetails(FIELDS, { sortOrder: ContactsSortOrder.UserDefault, limit: 5000 })
  const out: DeviceContact[] = []
  for (const row of rows) {
    const contact = cleanContact({ id: row.id, name: row.fullName ?? '', phones: (row.phones ?? []).map(p => p.number ?? ''), emails: (row.emails ?? []).map(e => e.address ?? '') })
    if (contact) out.push(contact)
  }
  return out
}

/** A contact as the reference sends it: a small .vcf file through the normal, scanned upload. */
export async function vcardFile(contact: PhoneContact): Promise<PickedFile> {
  const file = new File(Paths.cache, 'jivo-contact-' + randomUUID() + '.vcf'); file.create()
  try { file.write(buildVCard(contact)); return { name: vcardName(contact), uri: file.uri, mime: 'text/vcard', size: file.size, dispose: () => { if (file.exists) file.delete() } } }
  catch (e) { if (file.exists) file.delete(); throw e }
}

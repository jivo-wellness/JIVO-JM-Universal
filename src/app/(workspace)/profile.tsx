import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Workspace } from '../../components/Workspace'
import { ProfilePanel } from '../../components/ProfilePanel'
import { Icon } from '../../components/Icon'
import { useColors } from '../../ui'
import { useIdentity } from '../../core/auth/identity'
const options = [['access', 'Access'], ['security', 'Two-step verification'], ['password', 'Password'], ['devices', 'Signed-in devices'], ['privacy', 'Privacy'], ['background', 'Chat background']]
export default function Screen() {
 const [open, setOpen] = useState(false); const router = useRouter(); const c = useColors(); const { canChangePassword } = useIdentity()
 return <Workspace headerActions={<Pressable accessibilityRole="button" accessibilityLabel="Profile options" onPress={() => setOpen(true)} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}><Icon name="moreVertical" size={22} color={c.text} /></Pressable>}><ProfilePanel />
 {open && <Modal transparent onRequestClose={() => setOpen(false)} animationType="fade"><Pressable accessibilityRole="button" accessibilityLabel="Close profile options" onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} /><View style={{ position: 'absolute', top: 80, right: 12, width: 272, maxWidth: '90%', backgroundColor: c.panel, borderColor: c.border, borderWidth: 1, borderRadius: 16, padding: 8 }}>{options.filter(([key]) => key !== 'password' || canChangePassword).map(([section, title]) => <Pressable key={section} accessibilityRole="button" onPress={() => { setOpen(false); router.push({ pathname: '/profile-settings', params: { section, title } }) }} style={({ pressed }) => ({ padding: 14, borderRadius: 12, backgroundColor: pressed ? c.neutral : 'transparent' })}><Text style={{ color: c.text, fontSize: 15 }}>{title}</Text></Pressable>)}</View></Modal>}
 </Workspace>
}

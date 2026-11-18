import { useRouter, type Href } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Workspace } from '../components/Workspace'
import { useSession } from '../core/auth/Session'
import { homeTiles } from '../shared/homeTiles'
import { Icon, type IconName } from '../components/Icon'
import { useColors } from '../ui'
const icons: Record<string, IconName> = { Messenger: 'messagesSquare', Passwords: 'key', 'Profile & security': 'shieldCheck', People: 'users', 'Permission groups': 'shieldCheck', Security: 'lockKeyhole', Alerts: 'megaphone', 'Team vaults': 'vault', 'Emergency access': 'lifeBuoy', Oversight: 'eye' }
export default function Home() {
  const { me } = useSession(); const c = useColors(); const router = useRouter()
  const tiles = homeTiles(me?.capabilities ?? [])
  return <Workspace><ScrollView contentContainerStyle={{ flexGrow: 1, paddingVertical: 12, width: '100%', maxWidth: 960, alignSelf: 'center' }}>
    {tiles.map(tile => <Pressable key={tile.title} onPress={() => router.navigate(tile.href as Href)} accessibilityRole="link" accessibilityLabel={tile.title} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.neutral : 'transparent' })}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.successSoft }}><Icon name={icons[tile.title] ?? 'home'} size={22} color={c.brand} /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 24 }}>{tile.title}</Text><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginTop: 3 }}>{tile.description}</Text></View>
        <Icon name="chevronRight" size={18} color={c.muted} />
      </Pressable>)}
  </ScrollView></Workspace>
}

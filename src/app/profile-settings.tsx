import { useLocalSearchParams, useRouter } from 'expo-router'
import { View, Pressable, Text } from 'react-native'
import { Workspace } from '../components/Workspace'
import { ProfilePanel } from '../components/ProfilePanel'
import { Icon } from '../components/Icon'
import { useColors } from '../ui'
export default function ProfileSettings() {
 const { section, title } = useLocalSearchParams<{ section: string; title: string }>(); const router = useRouter(); const c = useColors()
 return <Workspace><View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 }}><Pressable accessibilityRole="button" accessibilityLabel="Back to Profile" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={c.text} /></Pressable><Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{title || 'Profile settings'}</Text></View><ProfilePanel section={section} /></Workspace>
}

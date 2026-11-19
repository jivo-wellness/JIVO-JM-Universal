import { Redirect, useLocalSearchParams } from 'expo-router'
import { Workspace } from '../../components/Workspace'
import { AdminPanel } from '../../components/AdminPanel'
// Reference /admin/users, /admin/groups, /admin/security in one route (?tab=), one section at a time.
// Software tools are managed on the Tools screen (ADMIN_TOOLS_MANAGE); the old /admin?tab=tools link opens it.
export default function Screen() { const p = useLocalSearchParams<{ tab?: string; user?: string }>(); if (p.tab === 'tools') return <Redirect href="/tools" />; return <Workspace><AdminPanel key={[p.tab,p.user].join(':')} initialTab={typeof p.tab === 'string' ? p.tab : undefined} initialUser={typeof p.user === 'string' ? p.user : undefined} /></Workspace> }

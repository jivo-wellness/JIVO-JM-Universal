import { Slot } from 'expo-router'
import { PageTransition } from '../../components/PageTransition'
import { WorkspaceShell } from '../../components/Workspace'

/** Navigation replaces only the outlet; header, footer and rail keep their identity/state. */
export default function WorkspaceLayout() {
  return <WorkspaceShell><PageTransition><Slot /></PageTransition></WorkspaceShell>
}

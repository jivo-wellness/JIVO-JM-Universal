import { Fragment, type ReactNode } from 'react'
import { useSession } from '../../core/auth/Session'
import { EmptyState } from '../../ui'
export function TicketGate({ children }: { children: ReactNode }) {
  const { me } = useSession()
  if (!me?.capabilities.includes('JM_ACCESS')) return <EmptyState title="JM access is required" />
  return <Fragment key={me.id}>{children}</Fragment>
}

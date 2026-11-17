import { api } from '../../core/api/client'
export interface SoftwareTool { id: string; name: string; description: string; web_url: string; app_url: string; position: number; is_active: boolean }
export type ToolInput = Omit<SoftwareTool, 'id'>
/** `manage` (ADMIN_TOOLS_MANAGE only) reads every tool, hidden ones included; everyone else reads the visible directory. */
export const listTools = async (manage = false) => (await api.get<SoftwareTool[]>(manage ? '/admin/tools/' : '/tools/')).data
export const saveTool = async (id: string | null, data: Partial<ToolInput>) => id ? api.patch(`/admin/tools/${id}/`, data) : api.post('/admin/tools/', data)
/** Hides the tool (the server keeps its record); showing it again is `saveTool(id, { is_active: true })`. */
export const hideTool = async (id: string) => api.delete(`/admin/tools/${id}/`)
/** Sets every tool's position from the given order in one server transaction (all or nothing). */
export const reorderTools = async (ids: string[]) => api.post('/admin/tools/reorder/', { ids })

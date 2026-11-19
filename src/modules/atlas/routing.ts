/** Only the server flag identifies Atlas. A person's name or email is not sufficient. */
export function isAtlasConversation(value: { kind?: string; is_atlas?: boolean } | null | undefined): boolean {
  return value?.kind === 'direct' && value.is_atlas === true
}

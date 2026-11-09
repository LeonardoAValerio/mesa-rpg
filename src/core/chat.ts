export const MAX_CHAT = 500

/** CHAT-02: a chat message has 1 to 500 characters, not counting surrounding spaces. */
export function validChat(text: string): boolean {
  const t = text.trim()
  return t.length >= 1 && t.length <= MAX_CHAT
}

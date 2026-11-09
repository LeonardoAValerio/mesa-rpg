export const MAX_CHAT = 500

/** CHAT-02: a chat message has 1 to 500 characters, not counting surrounding spaces. */
export function validChat(text: string): boolean {
  const chars = [...text.trim()].length // characters, not UTF-16 units
  return chars >= 1 && chars <= MAX_CHAT
}

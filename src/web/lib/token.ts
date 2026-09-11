const STORAGE_KEY = 'shazam.token'

/**
 * The CLI prints a URL carrying `?t=<token>`. We stash it and strip it from the
 * address bar so the secret does not sit in history or get pasted into a chat.
 */
export function readToken(): string | null {
  try {
    const url = new URL(window.location.href)
    const fromUrl = url.searchParams.get('t')
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl)
      url.searchParams.delete('t')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
      return fromUrl
    }
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token.trim())
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY)
}

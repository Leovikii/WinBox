import { marked } from 'marked'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

// ponytail: cover common release-note aliases; use a maintained mapping if broader GitHub emoji compatibility is needed.
const releaseEmoji: Record<string, string> = {
  memo: '📝', pencil: '📝', rocket: '🚀', bug: '🐛', warning: '⚠️',
  sparkles: '✨', tada: '🎉', white_check_mark: '✅', fire: '🔥',
}

export function renderChangelog(value: string) {
  const renderer = new marked.Renderer()
  renderer.html = ({ text }) => escapeHtml(text)
  renderer.link = function ({ href, tokens }) {
    const label = this.parser.parseInline(tokens)
    return /^https?:\/\//i.test(href) ? `<a href="${escapeHtml(href)}">${label}</a>` : label
  }
  renderer.image = ({ text }) => escapeHtml(text)
  return marked.parse(value, { renderer, walkTokens(token) {
    if (token.type === 'text') {
      token.text = token.text.replace(/:([a-z_]+):/g, (original: string, name: string) => Object.hasOwn(releaseEmoji, name) ? releaseEmoji[name] : original)
    }
  } }) as string
}

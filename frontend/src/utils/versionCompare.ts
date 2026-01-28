export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^[vV]/, '').trim()
  const clean2 = v2.replace(/^[vV]/, '').trim()

  const parts1 = clean1.split('.').map(p => parseInt(p) || 0)
  const parts2 = clean2.split('.').map(p => parseInt(p) || 0)

  const maxLength = Math.max(parts1.length, parts2.length)

  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0
    const num2 = parts2[i] || 0

    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }

  return 0
}

export function isNewerVersion(remote: string, local: string): boolean {
  return compareVersions(remote, local) > 0
}

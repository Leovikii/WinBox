export const cleanLog = (text: string) =>
  text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')

// Keep both queued batches and displayed history bounded, including a single huge line.
export function appendLog(previous: string, addition: string) {
  const next = previous + addition
  if (next.length <= 600000) return next
  const sliceIndex = next.indexOf('\n', next.length - 500000)
  return sliceIndex === -1 ? next.slice(-500000) : next.slice(sliceIndex + 1)
}

function sanitizeFilename(filename: string) {
  return [...filename]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code > 31 && code !== 127
    })
    .join('')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim()
}

function decodeHeaderFilename(value: string) {
  const normalized = value.replace(/^UTF-8''/i, '')

  try {
    return decodeURIComponent(normalized)
  } catch {
    return normalized
  }
}

export function getDownloadFilename(
  contentDisposition: string | undefined,
  fallbackFilename: string,
) {
  if (!contentDisposition) {
    return fallbackFilename
  }

  const encodedMatch = contentDisposition.match(/filename\*\s*=\s*([^;]+)/i)
  const quotedMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i)
  const plainMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i)
  const headerFilename = encodedMatch?.[1]
    ? decodeHeaderFilename(encodedMatch[1].trim())
    : (quotedMatch?.[1] ?? plainMatch?.[1]?.trim())
  const safeFilename = headerFilename ? sanitizeFilename(headerFilename) : ''

  return safeFilename || fallbackFilename
}

export function downloadFile(
  blob: Blob,
  contentDisposition: string | undefined,
  fallbackFilename: string,
) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = getDownloadFilename(contentDisposition, fallbackFilename)
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

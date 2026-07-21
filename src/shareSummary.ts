import type { TripResult } from './domain'
import { formatCurrency } from './domain'

const CARD_WIDTH = 1080
const PADDING = 72
const ROW_HEIGHT = 104

type SummaryImageInput = {
  result: TripResult
  currency: string
  unassignedLegNames: string[]
  pageUrl: string
}

export function createShareMessage(pageUrl: string): string {
  return `Created with Petrol Share (${pageUrl})`
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.fill()
}

function write(context: CanvasRenderingContext2D, text: string, x: number, y: number, options: {
  color?: string
  font?: string
  align?: CanvasTextAlign
} = {}) {
  context.fillStyle = options.color ?? '#ffffff'
  context.font = options.font ?? '700 34px Inter, system-ui, sans-serif'
  context.textAlign = options.align ?? 'left'
  context.fillText(text, x, y)
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [metadata, encoded] = dataUrl.split(',')
  const mimeType = metadata.match(/^data:([^;]+);base64$/)?.[1]
  if (!mimeType || !encoded) throw new Error('Your browser could not create the summary image.')
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new File([bytes], filename, { type: mimeType })
}

export function createSummaryImage({ result, currency, unassignedLegNames, pageUrl }: SummaryImageInput): File {
  const hasWarning = unassignedLegNames.length > 0
  const contentRows = hasWarning ? Math.max(1, unassignedLegNames.length) : Math.max(1, result.people.length)
  const cardHeight = 650 + contentRows * ROW_HEIGHT
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = cardHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not create the summary image.')

  context.fillStyle = '#173f34'
  context.fillRect(0, 0, CARD_WIDTH, cardHeight)

  write(context, 'YOUR SPLIT', PADDING, 80, { color: '#83d0ad', font: '800 24px Inter, system-ui, sans-serif' })
  write(context, 'Journey summary', PADDING, 137, { font: '500 52px Georgia, serif' })
  write(context, 'Petrol Share', CARD_WIDTH - PADDING, 112, { color: '#83d0ad', font: '800 27px Inter, system-ui, sans-serif', align: 'right' })

  context.fillStyle = 'rgba(255,255,255,.12)'
  context.fillRect(PADDING, 176, CARD_WIDTH - PADDING * 2, 2)
  write(context, 'TOTAL DISTANCE', PADDING, 230, { color: '#a9c1b8', font: '700 22px Inter, system-ui, sans-serif' })
  write(context, `${result.totalDistanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`, PADDING, 280)
  write(context, 'FUEL USED', CARD_WIDTH / 2 + 20, 230, { color: '#a9c1b8', font: '700 22px Inter, system-ui, sans-serif' })
  write(context, `${result.totalLitres.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`, CARD_WIDTH / 2 + 20, 280)
  write(context, 'TOTAL FUEL COST', PADDING, 350, { color: '#a9c1b8', font: '700 22px Inter, system-ui, sans-serif' })
  write(context, formatCurrency(result.totalCost, currency), PADDING, 420, { color: '#88dfb5', font: '500 58px Georgia, serif' })

  if (hasWarning) {
    context.fillStyle = 'rgba(235,171,51,.15)'
    roundedRect(context, PADDING, 470, CARD_WIDTH - PADDING * 2, cardHeight - 600, 18)
    write(context, 'Some legs have no riders', PADDING + 30, 522, { color: '#fff0c8', font: '800 27px Inter, system-ui, sans-serif' })
    unassignedLegNames.forEach((name, index) => {
      write(context, `•  ${name}`, PADDING + 30, 582 + index * ROW_HEIGHT, { color: '#ffe4a3', font: '600 27px Inter, system-ui, sans-serif' })
    })
  } else {
    context.fillStyle = 'rgba(255,255,255,.12)'
    context.fillRect(0, 470, CARD_WIDTH, 2)
    result.people.forEach((person, index) => {
      const rowY = 470 + index * ROW_HEIGHT
      context.fillStyle = '#86d9b1'
      context.beginPath()
      context.arc(PADDING + 30, rowY + 53, 30, 0, Math.PI * 2)
      context.fill()
      write(context, person.personName.charAt(0).toUpperCase(), PADDING + 30, rowY + 64, { color: '#173f34', font: '800 30px Inter, system-ui, sans-serif', align: 'center' })
      write(context, person.personName, PADDING + 82, rowY + 48, { font: '700 29px Inter, system-ui, sans-serif' })
      write(context, `${person.distanceKm.toLocaleString()} km · ${person.legIds.length} ${person.legIds.length === 1 ? 'leg' : 'legs'}`, PADDING + 82, rowY + 79, { color: '#9fb8af', font: '500 21px Inter, system-ui, sans-serif' })
      write(context, formatCurrency(person.displayCost, currency), CARD_WIDTH - PADDING, rowY + 64, { color: '#95e2bb', font: '800 31px Inter, system-ui, sans-serif', align: 'right' })
    })
  }

  context.fillStyle = 'rgba(255,255,255,.12)'
  context.fillRect(PADDING, cardHeight - 72, CARD_WIDTH - PADDING * 2, 2)
  write(context, createShareMessage(pageUrl), CARD_WIDTH / 2, cardHeight - 30, {
    color: '#9fb8af',
    font: '600 20px Inter, system-ui, sans-serif',
    align: 'center',
  })

  return dataUrlToFile(canvas.toDataURL('image/png'), 'petrol-share-summary.png')
}

export type ShareSummaryResult = {
  method: 'shared' | 'downloaded'
  messageCopied: boolean
}

async function downloadSummary(image: File, message: string): Promise<ShareSummaryResult> {
  const imageUrl = URL.createObjectURL(image)
  const link = document.createElement('a')
  link.href = imageUrl
  link.download = image.name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1_000)

  let messageCopied = false
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(message)
      messageCopied = true
    } catch {
      // The image download remains a useful fallback when clipboard permission is denied.
    }
  }
  return { method: 'downloaded', messageCopied }
}

export async function shareSummary(image: File, pageUrl: string): Promise<ShareSummaryResult> {
  const message = createShareMessage(pageUrl)
  const payload: ShareData = { text: message, files: [image] }
  if (!navigator.share || (navigator.canShare && !navigator.canShare({ files: [image] }))) {
    return downloadSummary(image, message)
  }
  await navigator.share(payload)
  return { method: 'shared', messageCopied: false }
}

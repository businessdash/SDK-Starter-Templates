import type { FormSchema, FormSubmissionData } from '@businessdash/sdk/forms'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useState } from 'react'
import type { ColorValue } from 'react-native'
import { SvgXml } from 'react-native-svg'

import type { BdFilePicker, BdFormClient, BdIconRenderer } from '@/bd-forms'

import { BD_HOST } from './client'
import demoForm from './demo-form.json'

/**
 * The pieces `<BdForm>` leaves to the app: picking files, drawing icons, and
 * (for the sample form) a client that submits nowhere.
 */

// ─── Files ───────────────────────────────────────────────────────────────────

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
}

/** The author's allowed types as MIME types the document picker filters by. */
function pickerTypes(allowed: string[]): string[] {
  const out = new Set<string>()
  for (const raw of allowed) {
    const t = raw.trim().toLowerCase()
    const mime = t.startsWith('.') ? MIME_BY_EXT[t] : t
    if (mime) out.add(mime)
  }
  return out.size > 0 ? [...out] : ['*/*']
}

/** Documents through the system file picker, photos through the photo library. */
export const pickFiles: BdFilePicker = async ({ kind, multiple, allowedTypes }) => {
  if (kind === 'images') {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: multiple,
      quality: 0.9,
    })
    if (res.canceled) return []
    return res.assets.map((a, i) => ({
      uri: a.uri,
      name: a.fileName ?? `Photo ${i + 1}.jpg`,
      mimeType: a.mimeType ?? undefined,
      size: a.fileSize ?? undefined,
    }))
  }
  const res = await DocumentPicker.getDocumentAsync({
    type: pickerTypes(allowedTypes),
    multiple,
    copyToCacheDirectory: true,
  })
  if (res.canceled) return []
  return res.assets.map((a) => ({
    uri: a.uri,
    name: a.name,
    mimeType: a.mimeType ?? undefined,
    size: a.size ?? undefined,
  }))
}

// ─── Icons ───────────────────────────────────────────────────────────────────

const svgCache = new Map<string, Promise<string | null>>()

function loadIcon(name: string): Promise<string | null> {
  let p = svgCache.get(name)
  if (!p) {
    p = fetch(`${BD_HOST}/api/icons/${encodeURIComponent(name)}.svg`)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .then((svg) => {
        // A failed fetch isn't remembered, so the next render tries again.
        if (svg == null) svgCache.delete(name)
        return svg
      })
    svgCache.set(name, p)
  }
  return p
}

/** A Lucide icon from BD's icon set, drawn with react-native-svg. */
function LucideIcon({ name, size, color }: { name: string; size: number; color: ColorValue }) {
  const [xml, setXml] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void loadIcon(name).then((x) => live && setXml(x))
    return () => {
      live = false
    }
  }, [name])
  if (!xml) return null
  return <SvgXml xml={xml} width={size} height={size} color={color} />
}

export const renderIcon: BdIconRenderer = (name, size, color) => (
  <LucideIcon name={name} size={size} color={color} />
)

// ─── The sample form ─────────────────────────────────────────────────────────

/** The built-in sample: every kind of field, nothing sent anywhere. */
export const demoSchema = demoForm as unknown as FormSchema

/**
 * A client for the sample form: "uploads" stay on the device and the
 * submission is logged instead of sent, so the form can be tried end to end.
 */
export const demoClient: BdFormClient = {
  forms: {
    schema: async () => demoSchema,
    submit: async (_slug: string, data: FormSubmissionData) => {
      console.log('Sample submission:', JSON.stringify(data, null, 2))
      return { ok: true as const, status: 200, submissionId: `demo-${Date.now()}`, dryRun: true }
    },
    uploadFile: async (
      _slug: string,
      _fieldId: string,
      file: File | Blob,
      opts?: { filename?: string },
    ) => {
      const name = opts?.filename ?? 'upload.bin'
      return {
        storageId: `demo/${name}`,
        url: `https://example.com/uploads/${encodeURIComponent(name)}`,
        name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }
    },
  },
}

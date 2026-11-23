import type {
  AutocompleteConfig,
  BdFormsClient,
  CollectionOptionsState,
  FieldError,
  FormController,
  FormCoreField,
  PendingFileValue,
} from '@businessdash/sdk/forms'
import { createContext, useContext } from 'react'

/** A file the app's picker returned. */
export interface BdPickedFile {
  /** A `file://` or `content://` URI `fetch` can read. */
  uri: string
  name: string
  mimeType?: string | undefined
  size?: number | undefined
}

/**
 * Opens the app's document or photo picker. Return `[]` when the visitor
 * cancels. Wire it to `expo-document-picker` / `expo-image-picker` (see the
 * starter's `FormScreen`), or any picker that gives back readable URIs.
 */
export type BdFilePicker = (request: {
  kind: 'files' | 'images'
  multiple: boolean
  /** The author's allowed types: MIME types, `image/*`, or `.pdf`-style extensions. Empty = any. */
  allowedTypes: string[]
}) => Promise<BdPickedFile[]>

/** The Stripe intent BD mints for a card field (`forms.paymentIntent`). */
export interface BdPaymentIntent {
  mode: 'card_on_file' | 'deposit'
  clientSecret: string
  intentId: string
  publishableKey: string
  connectedAccountId: string
}

/**
 * Collects the card for a `credit_card` field: confirm `intent` with Stripe
 * (on `intent.connectedAccountId`) and resolve with the intent id, or throw
 * to show the message on the field.
 */
export type BdPaymentHandler = (intent: BdPaymentIntent, field: FormCoreField) => Promise<string>

/** A client that can also mint card intents (the SDK's `BdClient` can). */
export type BdFormClient = BdFormsClient & {
  forms: BdFormsClient['forms'] & {
    paymentIntent?: (slug: string, fieldId: string) => Promise<BdPaymentIntent>
  }
}

/** A picked file waiting to upload on submit, plus what the renderer shows for it. */
export type BdPendingFile = PendingFileValue & {
  uri?: string
  mimeType?: string
}

/** What controls reach beyond their own value. */
export interface BdFormRuntime {
  controller: FormController
  slug: string | undefined
  client: BdFormClient | undefined
  collectionOptions: Record<string, CollectionOptionsState>
  autocomplete: AutocompleteConfig
  pickFiles: BdFilePicker | undefined
  collectPayment: BdPaymentHandler | undefined
  /** Where `/api/icons` lives. */
  host: string
}

export const BdFormRuntimeContext = createContext<BdFormRuntime | null>(null)

export function useBdFormRuntime(): BdFormRuntime {
  const ctx = useContext(BdFormRuntimeContext)
  if (!ctx) throw new Error('BdForm controls must render inside <BdForm>.')
  return ctx
}

/** One field, its value, and how to change it. */
export interface BdFieldContext {
  field: FormCoreField
  value: unknown
  error: FieldError | undefined
  set: (value: unknown) => void
}

/**
 * Replace how a field type renders. Return `undefined` to fall back to the
 * built-in control.
 */
export type BdFieldRenderers = Partial<Record<string, (ctx: BdFieldContext) => React.ReactNode>>

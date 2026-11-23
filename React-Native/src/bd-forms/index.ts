/**
 * BusinessDash forms for React Native: native views, no webview.
 *
 * ```tsx
 * <BdForm form="general-inquiry" client={bd} pickFiles={pickFiles} renderIcon={renderIcon} />
 * ```
 *
 * Copy this folder into any React Native app. It needs `@businessdash/sdk`
 * (0.9.93+) and `react-native-safe-area-context`; nothing else.
 */

export { BD_DEFAULT_HOST, BdForm, type BdFormProps } from './BdForm'
export {
  BdButton,
  BdOptionPicker,
  BdText,
  BdTextField,
} from './primitives'
export type {
  BdFieldContext,
  BdFieldRenderers,
  BdFilePicker,
  BdFormClient,
  BdPaymentHandler,
  BdPaymentIntent,
  BdPickedFile,
} from './runtime'
export {
  type BdFormColors,
  type BdFormStrings,
  type BdFormStyle,
  type BdIconRenderer,
  defaultStrings,
} from './theme'

import { createContext, useContext } from 'react'
import { type ColorValue, Platform, PlatformColor, type TextStyle } from 'react-native'

/**
 * How a form looks. Every field is optional: leave it out and the form
 * follows the OS: iOS system colors and shapes on iPhone, Material 3 (with
 * the wallpaper's dynamic color on Android 12+) on Android, light or dark
 * with the device.
 */
export interface BdFormStyle {
  /** "ios" or "material" shapes. Defaults to the platform's own. */
  variant?: 'ios' | 'material'
  /** Overrides for any color. */
  colors?: Partial<BdFormColors>
  /** Corner radius of cards, choice rows and sheets. */
  cornerRadius?: number
  /** Space between fields. */
  spacing?: number
  /** Padding around the form when it scrolls itself. */
  contentPadding?: number
  /** Show the form's own title and description. */
  showsTitle?: boolean
  showsDescription?: boolean
  /** Show the step progress the author configured. */
  showsProgress?: boolean
  /** Appended to required labels. */
  requiredMarker?: string
  /** Step transitions (also off when the OS asks to reduce motion). */
  animated?: boolean
  /** Font family for all text, if not the system font. */
  fontFamily?: string
}

export interface BdFormColors {
  /** Buttons, selections, focus. */
  tint: ColorValue
  /** Text and icons on `tint`. */
  onTint: ColorValue
  /** Selected cards and chips. */
  tintSoft: ColorValue
  text: ColorValue
  textSecondary: ColorValue
  placeholder: ColorValue
  /** Behind the form when it scrolls itself. */
  background: ColorValue
  /** Inside text fields (iOS) and behind sheets. */
  field: ColorValue
  /** Text field outlines (Material) and card borders. */
  border: ColorValue
  /** Hairlines between rows. */
  separator: ColorValue
  /** Quiet surfaces: chips, file rows, calculation results. */
  surface: ColorValue
  error: ColorValue
  success: ColorValue
  star: ColorValue
  /** Dims what's behind a sheet. */
  scrim: ColorValue
}

/** Every string the form shows. Override any of them to translate. */
export const defaultStrings = {
  next: 'Next',
  back: 'Back',
  submit: 'Submit',
  sending: 'Sending…',
  successTitle: 'Thank you',
  successMessage: 'Thanks — your response was received.',
  submitAnother: 'Submit another response',
  errorNotice: 'Please complete the highlighted field(s).',
  loading: 'Loading form…',
  loadFailed: "This form couldn't be loaded.",
  retry: 'Try again',
  stepOf: 'Step %1 of %2',
  select: 'Select…',
  search: 'Search',
  noResults: 'No matches',
  useCustom: 'Use “%1”',
  done: 'Done',
  clear: 'Clear',
  cancel: 'Cancel',
  addAnother: 'Add another',
  entry: 'Entry',
  removeEntry: 'Remove entry',
  fillOneSide: 'Fill at least one side',
  fillOneSideError: 'Fill in at least one side to continue.',
  or: 'OR',
  yesNo: 'Yes / No',
  addDate: 'Add date',
  addTime: 'Add time',
  start: 'Start',
  end: 'End',
  date: 'Date',
  time: 'Time',
  selectTime: 'Select time',
  month: 'Month',
  year: 'Year',
  namePrefix: 'Title',
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  nameSuffix: 'Suffix',
  nicknames: 'Nicknames',
  nicknamesPlaceholder: 'Johnny, JM — separate with commas',
  addressLine1: 'Street address',
  addressLine2: 'Apt, suite, unit (optional)',
  city: 'City',
  state: 'State',
  selectState: 'Select state',
  zip: 'Zip',
  customColor: 'Custom color',
  hexColor: 'Hex color',
  chooseFiles: 'Choose files',
  choosePhotos: 'Choose photos',
  uploadsOnSubmit: 'Uploads on submit',
  upload: 'Upload',
  pasteURL: 'Paste URL',
  removeFile: 'Remove',
  filePickingUnavailable: "File picking isn't set up in this app.",
  addTag: 'Add a tag',
  removeTag: 'Remove %1',
  asap: 'As soon as possible',
  preferredDays: 'Preferred days',
  preferredTimes: 'Preferred times',
  schedulingNotes: 'Anything we should know about timing?',
  loadingTimes: 'Loading available times…',
  noOpenTimes: 'No open times in the next few weeks.',
  timesUnavailable: "Times couldn't be loaded.",
  loadingOptions: 'Loading options…',
  noRecords: 'No records to choose from yet.',
  calculatedOnSubmit: 'Calculated on submit.',
  cardOnFile: 'Card on file',
  deposit: 'Deposit',
  addCard: 'Add card',
  cardSaved: 'Card saved',
  cardUnavailable: "Card entry isn't set up in this app.",
  cardFailed: "The card couldn't be saved.",
  searchIcons: 'Search icons…',
  view: 'View',
  hour: 'hr',
  hours: 'hrs',
  ratingOf: '%1 of %2',
  increase: 'Increase',
  decrease: 'Decrease',
  couponApplied: 'Coupon %1 will be applied to this submission.',
  exitTitle: 'Leave this form?',
  exitMessage: "Your answers haven't been sent.",
  exitLeave: 'Leave',
  exitStay: 'Keep editing',
  bold: 'Bold',
  italic: 'Italic',
  strikethrough: 'Strikethrough',
  bulletList: 'Bulleted list',
  numberedList: 'Numbered list',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  dayNames: {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
  } as Record<string, string>,
  timeWindowNames: {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    morning_8_10: '8–10 AM',
    morning_10_12: '10 AM–12 PM',
    afternoon_12_2: '12–2 PM',
    afternoon_2_4: '2–4 PM',
    evening_4_6: '4–6 PM',
    evening_6_8: '6–8 PM',
  } as Record<string, string>,
  happinessNames: ['Very unhappy', 'Unhappy', 'Neutral', 'Happy', 'Very happy'],
}

export type BdFormStrings = typeof defaultStrings

/** Fill `%1`, `%2`… in a string. */
export function fmt(s: string, ...args: Array<string | number>): string {
  return s.replace(/%(\d)/g, (m, n) => {
    const v = args[Number(n) - 1]
    return v === undefined ? m : String(v)
  })
}

/** Everything a control needs to draw itself, resolved once per render. */
export interface BdResolvedTheme {
  variant: 'ios' | 'material'
  colors: BdFormColors
  cornerRadius: number
  /** Text field corner radius. */
  fieldRadius: number
  /** Text field height. */
  fieldHeight: number
  spacing: number
  contentPadding: number
  showsTitle: boolean
  showsDescription: boolean
  showsProgress: boolean
  requiredMarker: string
  animated: boolean
  font: TextStyle
  dark: boolean
}

function androidDynamic(dark: boolean): BdFormColors | null {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 31) return null
  const c = (name: string) => PlatformColor(`@android:color/${name}`)
  return dark
    ? {
        tint: c('system_accent1_200'),
        onTint: c('system_accent1_800'),
        tintSoft: c('system_accent2_700'),
        text: c('system_neutral1_100'),
        textSecondary: c('system_neutral2_200'),
        placeholder: c('system_neutral2_400'),
        background: c('system_neutral1_900'),
        field: c('system_neutral1_900'),
        border: c('system_neutral2_400'),
        separator: c('system_neutral2_700'),
        surface: c('system_neutral2_800'),
        error: '#F2B8B5',
        success: '#81C995',
        star: '#FFB300',
        scrim: 'rgba(0,0,0,0.5)',
      }
    : {
        tint: c('system_accent1_600'),
        onTint: '#FFFFFF',
        tintSoft: c('system_accent2_100'),
        text: c('system_neutral1_900'),
        textSecondary: c('system_neutral2_700'),
        placeholder: c('system_neutral2_500'),
        background: c('system_neutral1_10'),
        field: c('system_neutral1_10'),
        border: c('system_neutral2_500'),
        separator: c('system_neutral2_200'),
        surface: c('system_neutral2_50'),
        error: '#B3261E',
        success: '#1E8E3E',
        star: '#FFB300',
        scrim: 'rgba(0,0,0,0.32)',
      }
}

function materialBaseline(dark: boolean): BdFormColors {
  return dark
    ? {
        tint: '#D0BCFF',
        onTint: '#381E72',
        tintSoft: '#4A4458',
        text: '#E6E0E9',
        textSecondary: '#CAC4D0',
        placeholder: '#938F99',
        background: '#141218',
        field: '#141218',
        border: '#938F99',
        separator: '#49454F',
        surface: '#2B2930',
        error: '#F2B8B5',
        success: '#81C995',
        star: '#FFB300',
        scrim: 'rgba(0,0,0,0.5)',
      }
    : {
        tint: '#6750A4',
        onTint: '#FFFFFF',
        tintSoft: '#E8DEF8',
        text: '#1D1B20',
        textSecondary: '#49454F',
        placeholder: '#79747E',
        background: '#FEF7FF',
        field: '#FEF7FF',
        border: '#79747E',
        separator: '#CAC4D0',
        surface: '#F3EDF7',
        error: '#B3261E',
        success: '#1E8E3E',
        star: '#FFB300',
        scrim: 'rgba(0,0,0,0.32)',
      }
}

function iosColors(dark: boolean): BdFormColors {
  if (Platform.OS === 'ios') {
    const c = (name: string) => PlatformColor(name)
    return {
      tint: c('systemBlue'),
      onTint: '#FFFFFF',
      tintSoft: dark ? 'rgba(10,132,255,0.22)' : 'rgba(0,122,255,0.10)',
      text: c('label'),
      textSecondary: c('secondaryLabel'),
      placeholder: c('placeholderText'),
      background: c('systemBackground'),
      field: c('secondarySystemBackground'),
      border: c('separator'),
      separator: c('separator'),
      surface: c('secondarySystemBackground'),
      error: c('systemRed'),
      success: c('systemGreen'),
      star: c('systemYellow'),
      scrim: 'rgba(0,0,0,0.35)',
    }
  }
  // The iOS look on another platform: the same colors as hex.
  return dark
    ? {
        tint: '#0A84FF',
        onTint: '#FFFFFF',
        tintSoft: 'rgba(10,132,255,0.22)',
        text: '#FFFFFF',
        textSecondary: 'rgba(235,235,245,0.6)',
        placeholder: 'rgba(235,235,245,0.3)',
        background: '#000000',
        field: '#1C1C1E',
        border: 'rgba(84,84,88,0.65)',
        separator: 'rgba(84,84,88,0.65)',
        surface: '#1C1C1E',
        error: '#FF453A',
        success: '#30D158',
        star: '#FFD60A',
        scrim: 'rgba(0,0,0,0.35)',
      }
    : {
        tint: '#007AFF',
        onTint: '#FFFFFF',
        tintSoft: 'rgba(0,122,255,0.10)',
        text: '#000000',
        textSecondary: 'rgba(60,60,67,0.6)',
        placeholder: 'rgba(60,60,67,0.3)',
        background: '#FFFFFF',
        field: '#F2F2F7',
        border: 'rgba(60,60,67,0.29)',
        separator: 'rgba(60,60,67,0.29)',
        surface: '#F2F2F7',
        error: '#FF3B30',
        success: '#34C759',
        star: '#FFCC00',
        scrim: 'rgba(0,0,0,0.35)',
      }
}

export function resolveTheme(style: BdFormStyle | undefined, dark: boolean): BdResolvedTheme {
  const variant = style?.variant ?? (Platform.OS === 'ios' ? 'ios' : 'material')
  const base =
    variant === 'ios' ? iosColors(dark) : (androidDynamic(dark) ?? materialBaseline(dark))
  const ios = variant === 'ios'
  return {
    variant,
    colors: { ...base, ...style?.colors },
    cornerRadius: style?.cornerRadius ?? (ios ? 10 : 12),
    fieldRadius: ios ? 10 : 4,
    fieldHeight: ios ? 44 : 56,
    spacing: style?.spacing ?? (ios ? 22 : 24),
    contentPadding: style?.contentPadding ?? 16,
    showsTitle: style?.showsTitle ?? true,
    showsDescription: style?.showsDescription ?? true,
    showsProgress: style?.showsProgress ?? true,
    requiredMarker: style?.requiredMarker ?? ' *',
    animated: style?.animated ?? true,
    font: style?.fontFamily ? { fontFamily: style.fontFamily } : {},
    dark,
  }
}

/** Draws a Lucide icon by name. See `BdFormProps.renderIcon`. */
export type BdIconRenderer = (name: string, size: number, color: ColorValue) => React.ReactNode

export interface BdFormContextValue {
  theme: BdResolvedTheme
  strings: BdFormStrings
  renderIcon?: BdIconRenderer | undefined
}

export const BdFormContext = createContext<BdFormContextValue | null>(null)

export function useBdForm(): BdFormContextValue {
  const ctx = useContext(BdFormContext)
  if (!ctx) throw new Error('BdForm controls must render inside <BdForm>.')
  return ctx
}

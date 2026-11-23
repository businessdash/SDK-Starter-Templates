import { useMemo } from 'react'
import { Alert } from 'react-native'

import { BdForm, type BdFormClient } from '@/bd-forms'
import { getBd } from '@/bd/client'
import { demoClient, demoSchema, pickFiles, renderIcon } from '@/bd/forms'

const liveForm = process.env.EXPO_PUBLIC_BD_FORM

/**
 * A BusinessDash form in native views.
 *
 * With `EXPO_PUBLIC_BD_FORM` set (and the app configured), this is that Live
 * form: validation, conditions, steps, uploads and submit all run against BD.
 * Without it, it's a built-in sample with every kind of field that submits
 * nowhere, so the tab works on a fresh clone.
 */
export default function FormScreen() {
  const bd = getBd()
  const live = !!liveForm && !!bd
  const client = useMemo<BdFormClient>(
    () => (live ? (bd as unknown as BdFormClient) : demoClient),
    [live, bd],
  )
  return (
    <BdForm
      form={live ? liveForm : demoSchema.slug}
      schema={live ? undefined : demoSchema}
      client={client}
      pickFiles={pickFiles}
      renderIcon={renderIcon}
      onSubmitted={(result) => {
        if (!live) {
          Alert.alert('Sample submitted', 'Nothing was sent — the payload is in the Metro log.')
        } else if (result.submissionId) {
          console.log('Submitted', result.submissionId)
        }
      }}
    />
  )
}

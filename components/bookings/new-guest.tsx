"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import {
  FormSheet,
  FormSheetField,
  FormSheetSelect,
  type FormErrors,
} from "@/components/motion/form-sheet"
import { useBookingActions } from "@/lib/booking-actions"
import { useDataset, useTenant } from "@/lib/data"
import { useLocale } from "@/lib/i18n/provider"
import { NATIONALITIES } from "@/lib/mock/pools"
import { isEmail, isPhone, samePhone } from "@/lib/validate"
import type { Guest } from "@/lib/types"

/**
 * Registers a guest who isn't on file yet. Refuses a phone number or email
 * that already belongs to someone, so the desk picks the existing guest
 * instead of creating a duplicate.
 */
export function NewGuestSheet({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: (guest: Guest) => void
}) {
  const data = useDataset()
  const tenant = useTenant()
  const actions = useBookingActions()
  const { t, locale } = useLocale()

  const nationalities = React.useMemo(
    () =>
      Object.fromEntries(
        NATIONALITIES.map((nationality) => [
          nationality.en,
          nationality[locale],
        ])
      ),
    [locale]
  )
  // The property's own country is the likeliest.
  const home = NATIONALITIES.some((n) => n.en === tenant.country.en)
    ? tenant.country.en
    : undefined

  const submit = (values: Record<string, string>) => {
    const errors: FormErrors = {}
    if (!isPhone(values.phone)) {
      errors.phone = t("share.phoneInvalid")
    } else {
      const owner = data.guests.find((g) => samePhone(g.phone, values.phone))
      if (owner) {
        errors.phone = t("bookings.guestForm.phoneTaken", {
          name: owner.name[locale],
        })
      }
    }
    if (values.email) {
      if (!isEmail(values.email)) {
        errors.email = t("share.emailInvalid")
      } else {
        const owner = data.guests.find(
          (g) => g.email.toLowerCase() === values.email.toLowerCase()
        )
        if (owner) {
          errors.email = t("bookings.guestForm.emailTaken", {
            name: owner.name[locale],
          })
        }
      }
    }
    if (Object.keys(errors).length > 0) return errors

    const nationality =
      NATIONALITIES.find((n) => n.en === values.nationality) ?? NATIONALITIES[0]
    onAdded(
      actions.addGuest({
        name: values.name,
        phone: values.phone,
        email: values.email,
        nationality,
      })
    )
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("bookings.guestForm.title")}
      description={t("bookings.guestForm.hint")}
      submitLabel={t("bookings.addGuest")}
      onSubmit={submit}
    >
      <FormSheetField name="name" label={t("common.name")} required>
        {(field) => <Input {...field} autoComplete="off" />}
      </FormSheetField>
      <FormSheetField name="phone" label={t("common.phone")} required>
        {(field) => <Input {...field} type="tel" autoComplete="off" />}
      </FormSheetField>
      <FormSheetField name="email" label={t("common.email")}>
        {(field) => <Input {...field} type="email" autoComplete="off" />}
      </FormSheetField>
      <FormSheetField
        name="nationality"
        label={t("reports.columns.nationality")}
        required
      >
        {(field, controls) => (
          <FormSheetSelect
            field={field}
            controls={controls}
            items={nationalities}
            defaultValue={home}
          />
        )}
      </FormSheetField>
    </FormSheet>
  )
}

"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FormSheet,
  FormSheetField,
  FormSheetSelect,
  type FormErrors,
  type FormValues,
} from "@/components/motion/form-sheet"
import { useDataEdits, useDataset } from "@/lib/data"
import { useLocale } from "@/lib/i18n/provider"
import { INTEGRATION_CATALOG } from "@/lib/mock/catalog"
import { USER_ROLES } from "@/lib/roles"
import { isEmail } from "@/lib/validate"
import type { AppUser, UserRole } from "@/lib/types"

/* ------------------------------------------------------------------ *
 * Users → Invite user
 * ------------------------------------------------------------------ */

export function InviteUserButton() {
  const data = useDataset()
  const edits = useDataEdits()
  const { t, locale } = useLocale()
  const [open, setOpen] = React.useState(false)

  const submit = (values: FormValues): FormErrors | void => {
    if (!isEmail(values.email)) return { email: t("share.emailInvalid") }
    const existing = data.users.find(
      (user) => user.email.toLowerCase() === values.email.toLowerCase()
    )
    if (existing) {
      return {
        email:
          existing.status === "invited"
            ? t("admin.forms.alreadyInvited")
            : t("forms.emailTaken", { name: existing.name[locale] }),
      }
    }

    const id = edits.newId("user")
    // Until they sign in and fill in a name, the address stands in for one.
    const name = values.name || values.email
    const user: AppUser = {
      id,
      name: { en: name, bn: name },
      email: values.email,
      avatarSeed: `${values.email}-${id}`,
      role: values.role as UserRole,
      status: "invited",
    }
    edits.add("users", user)
    toast.success(t("admin.forms.invited", { email: values.email }))
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        {t("admin.invite")}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={t("admin.forms.inviteTitle")}
        description={t("admin.forms.inviteHint")}
        submitLabel={t("admin.forms.sendInvite")}
        onSubmit={submit}
      >
        <FormSheetField name="email" label={t("common.email")} required>
          {(field) => (
            <Input
              {...field}
              type="email"
              autoComplete="off"
              placeholder="name@example.com"
            />
          )}
        </FormSheetField>
        <FormSheetField name="role" label={t("staff.role")} required>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={Object.fromEntries(
                USER_ROLES.map((role) => [role.id, role.name[locale]])
              )}
              defaultValue="readonly"
            />
          )}
        </FormSheetField>
        <FormSheetField
          name="name"
          label={t("common.name")}
          description={t("admin.forms.nameHint")}
        >
          {(field) => <Input {...field} autoComplete="off" />}
        </FormSheetField>
      </FormSheet>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Integrations → + Add
 * ------------------------------------------------------------------ */

export function AddIntegrationButton() {
  const data = useDataset()
  const edits = useDataEdits()
  const { t, locale } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<string>()

  const changeOpen = (next: boolean) => {
    if (!next) setPicked(undefined)
    setOpen(next)
  }

  const available = INTEGRATION_CATALOG.filter(
    (entry) => !data.integrations.some((added) => added.id === entry.id)
  )
  const chosen = available.find((entry) => entry.id === picked)

  const submit = (values: FormValues) => {
    const entry = available.find((item) => item.id === values.connector)
    if (!entry) return
    edits.add("integrations", { ...entry, connected: false })
    toast.success(t("admin.forms.integrationAdded", { name: entry.name }))
  }

  return (
    <>
      <Button
        size="sm"
        disabled={available.length === 0}
        title={available.length === 0 ? t("admin.forms.allAdded") : undefined}
        onClick={() => setOpen(true)}
      >
        <Plus />
        {t("common.add")}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={changeOpen}
        title={t("admin.forms.integrationTitle")}
        description={t("admin.forms.integrationHint")}
        submitLabel={t("common.add")}
        onSubmit={submit}
      >
        <FormSheetField
          name="connector"
          label={t("admin.forms.connector")}
          required
          description={
            chosen
              ? `${chosen.category[locale]} · ${chosen.detail[locale]}`
              : undefined
          }
        >
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={Object.fromEntries(
                available.map((entry) => [
                  entry.id,
                  `${entry.name} · ${entry.category[locale]}`,
                ])
              )}
              onChange={setPicked}
            />
          )}
        </FormSheetField>
      </FormSheet>
    </>
  )
}

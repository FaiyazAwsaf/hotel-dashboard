"use client"

import * as React from "react"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  FormSheet,
  FormSheetField,
  FormSheetSelect,
} from "@/components/motion/form-sheet"
import { useDataset } from "@/lib/data"
import { useLocale } from "@/lib/i18n/provider"
import { canCheckOut, useVmsActions } from "@/lib/vms-actions"

/**
 * The gate desk's "Check out": pick an on-site visitor by badge and record
 * their exit. Rows in the visitor log have their own Check out button, and a
 * selection can be checked out together from the selection bar.
 */
export function CheckOutButton() {
  const data = useDataset()
  const actions = useVmsActions()
  const { t, locale } = useLocale()
  const [open, setOpen] = React.useState(false)

  const onSite = React.useMemo(
    () =>
      data.visitors
        .filter(canCheckOut)
        .sort((a, b) => a.badge.localeCompare(b.badge)),
    [data.visitors]
  )
  const options = React.useMemo(
    () =>
      Object.fromEntries(
        onSite.map((visitor) => [
          visitor.id,
          `${visitor.badge} · ${visitor.name[locale]}`,
        ])
      ),
    [onSite, locale]
  )

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={onSite.length === 0}
        title={onSite.length === 0 ? t("vms.nobodyOnSite") : undefined}
        onClick={() => setOpen(true)}
      >
        <LogOut />
        {t("frontDesk.checkOut")}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={t("vms.checkOutTitle")}
        description={t("vms.checkOutHint")}
        submitLabel={t("frontDesk.checkOut")}
        onSubmit={(values) => {
          const visitor = onSite.find((entry) => entry.id === values.visitor)
          if (visitor) actions.checkOut([visitor])
        }}
      >
        <FormSheetField name="visitor" label={t("vms.visitor")} required>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={options}
            />
          )}
        </FormSheetField>
      </FormSheet>
    </>
  )
}

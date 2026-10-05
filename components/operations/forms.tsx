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
import { useDataEdits, useDataset, useMoney } from "@/lib/data"
import { demoNow, demoToday, isoDay } from "@/lib/demo-time"
import { useLocale } from "@/lib/i18n/provider"
import { slugEmail } from "@/lib/mock/generate"
import { MAINTENANCE_AREAS, STAFF_ROLES } from "@/lib/mock/pools"
import { nextSerial } from "@/lib/numbering"
import { isEmail, isPhone, parseNumber } from "@/lib/validate"
import type {
  ShiftId,
  StaffDepartment,
  StaffMember,
  TaskPriority,
  WorkOrder,
} from "@/lib/types"

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"]
const DEPARTMENTS: StaffDepartment[] = [
  "frontOffice",
  "housekeeping",
  "fnb",
  "engineering",
  "security",
  "sales",
  "finance",
  "hr",
]
const SHIFTS: ShiftId[] = ["morning", "evening", "night"]

/** No specific room: the work order is for the area as a whole. */
const NO_ROOM = "none"

/* ------------------------------------------------------------------ *
 * Maintenance → + Work order
 * ------------------------------------------------------------------ */

export function NewWorkOrderButton() {
  const data = useDataset()
  const edits = useDataEdits()
  const { t, locale } = useLocale()
  const [open, setOpen] = React.useState(false)

  const rooms = React.useMemo(
    () => ({
      [NO_ROOM]: t("rooms.forms.noRoom"),
      ...Object.fromEntries(
        data.rooms
          .slice()
          .sort((a, b) =>
            a.number.localeCompare(b.number, undefined, { numeric: true })
          )
          .map((room) => [
            room.id,
            `${room.number} · ${t(`rooms.types.${room.typeId}` as never)}`,
          ])
      ),
    }),
    [data.rooms, t]
  )
  const reporters = React.useMemo(
    () =>
      Object.fromEntries(
        data.staff
          .slice()
          .sort((a, b) => a.name[locale].localeCompare(b.name[locale]))
          .map((member) => [
            member.id,
            `${member.name[locale]} · ${t(`staff.departments.${member.department}` as never)}`,
          ])
      ),
    [data.staff, locale, t]
  )

  const submit = (values: FormValues) => {
    const order: WorkOrder = {
      id: edits.newId("wo"),
      number: nextSerial(
        data.workOrders.map((o) => o.number),
        "WO-",
        { step: 5 }
      ),
      roomId: values.room === NO_ROOM ? undefined : values.room,
      area:
        MAINTENANCE_AREAS.find((area) => area.en === values.area) ??
        MAINTENANCE_AREAS[0],
      // Typed text reads the same in both languages.
      issue: { en: values.issue, bn: values.issue },
      priority: values.priority as TaskPriority,
      state: "unassigned",
      reportedBy: values.reporter,
      reportedAt: new Date(demoNow()).toISOString(),
    }
    edits.add("workOrders", order)
    toast.success(
      t("rooms.forms.workOrderAdded", {
        number: order.number,
        issue: values.issue,
      })
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        {t("rooms.workOrder")}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={t("rooms.forms.workOrderTitle")}
        description={t("rooms.forms.workOrderHint")}
        submitLabel={t("rooms.forms.addWorkOrder")}
        onSubmit={submit}
      >
        <FormSheetField name="issue" label={t("rooms.forms.issue")} required>
          {(field) => (
            <Input
              {...field}
              autoComplete="off"
              placeholder={t("rooms.forms.issuePlaceholder")}
            />
          )}
        </FormSheetField>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField name="area" label={t("rooms.forms.area")} required>
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={Object.fromEntries(
                  MAINTENANCE_AREAS.map((area) => [area.en, area[locale]])
                )}
                defaultValue={MAINTENANCE_AREAS[0].en}
              />
            )}
          </FormSheetField>
          <FormSheetField name="room" label={t("common.room")}>
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={rooms}
                defaultValue={NO_ROOM}
              />
            )}
          </FormSheetField>
        </div>
        <FormSheetField name="priority" label={t("rooms.priority")} required>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={Object.fromEntries(
                PRIORITIES.map((priority) => [
                  priority,
                  t(`common.${priority}` as never),
                ])
              )}
              defaultValue="medium"
            />
          )}
        </FormSheetField>
        <FormSheetField name="reporter" label={t("rooms.reportedBy")} required>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={reporters}
            />
          )}
        </FormSheetField>
      </FormSheet>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Staff directory → + New
 * ------------------------------------------------------------------ */

export function NewStaffButton() {
  const data = useDataset()
  const edits = useDataEdits()
  const money = useMoney()
  const { t, locale } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [department, setDepartment] =
    React.useState<StaffDepartment>("frontOffice")

  const changeOpen = (next: boolean) => {
    if (!next) setDepartment("frontOffice")
    setOpen(next)
  }

  const roles = STAFF_ROLES[department] ?? []

  const submit = (values: FormValues): FormErrors | void => {
    const errors: FormErrors = {}
    const salary = parseNumber(values.salary)
    if (!isPhone(values.phone)) errors.phone = t("share.phoneInvalid")
    if (values.email && !isEmail(values.email)) {
      errors.email = t("share.emailInvalid")
    }
    const email = values.email || slugEmail(values.name, "auberge.app")
    if (
      email &&
      data.staff.some((m) => m.email.toLowerCase() === email.toLowerCase())
    ) {
      errors.email = t("forms.emailInUse")
    }
    if (salary === null || salary <= 0) {
      errors.salary = t("forms.positiveNumber")
    }
    if (Object.keys(errors).length > 0 || salary === null) return errors

    const id = edits.newId("staff")
    const member: StaffMember = {
      id,
      name: { en: values.name, bn: values.name },
      role: roles.find((role) => role.en === values.role) ?? roles[0],
      department,
      shift: values.shift as ShiftId,
      phone: values.phone,
      // A name in Bengali script has no Latin letters to build an address from.
      email: email.startsWith("@") ? `${id}@auberge.app` : email,
      joinedAt: isoDay(demoToday()),
      salary: Math.round(salary),
      avatarSeed: `${values.name}-${id}`,
      // Not rated until their first review.
      rating: 0,
    }
    edits.add("staff", member)
    toast.success(
      t("staff.forms.added", {
        name: member.name[locale],
        department: t(`staff.departments.${department}` as never),
      })
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        {t("common.new")}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={changeOpen}
        title={t("staff.forms.title")}
        description={t("staff.forms.hint")}
        submitLabel={t("staff.forms.add")}
        onSubmit={submit}
      >
        <FormSheetField name="name" label={t("common.name")} required>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormSheetField>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField
            name="department"
            label={t("staff.department")}
            required
          >
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={Object.fromEntries(
                  DEPARTMENTS.map((entry) => [
                    entry,
                    t(`staff.departments.${entry}` as never),
                  ])
                )}
                defaultValue="frontOffice"
                onChange={(value) => setDepartment(value as StaffDepartment)}
              />
            )}
          </FormSheetField>
          <FormSheetField
            // Each department has its own roles.
            key={department}
            name="role"
            label={t("staff.role")}
            required
          >
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={Object.fromEntries(
                  roles.map((role) => [role.en, role[locale]])
                )}
              />
            )}
          </FormSheetField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField name="shift" label={t("staff.shift")} required>
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={Object.fromEntries(
                  SHIFTS.map((shift) => [
                    shift,
                    t(`staff.shifts.${shift}` as never),
                  ])
                )}
                defaultValue="morning"
              />
            )}
          </FormSheetField>
          <FormSheetField
            name="salary"
            label={`${t("staff.forms.salary")} (${money.symbol})`}
            required
          >
            {(field) => (
              <Input {...field} inputMode="decimal" autoComplete="off" />
            )}
          </FormSheetField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField name="phone" label={t("common.phone")} required>
            {(field) => <Input {...field} type="tel" autoComplete="off" />}
          </FormSheetField>
          <FormSheetField
            name="email"
            label={t("common.email")}
            description={t("staff.forms.emailHint")}
          >
            {(field) => <Input {...field} type="email" autoComplete="off" />}
          </FormSheetField>
        </div>
      </FormSheet>
    </>
  )
}

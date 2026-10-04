"use client"

import * as React from "react"
import { Printer, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  FormSheet,
  FormSheetField,
  FormSheetSelect,
} from "@/components/motion/form-sheet"
import { GatePassCard, usePrintPasses } from "@/components/vms/gate-pass"
import { useDataset } from "@/lib/data"
import { useLocale } from "@/lib/i18n/provider"
import { isPhone } from "@/lib/validate"
import { CLEARANCE_LABEL, CLEARANCE_ORDER, GATE_IDS } from "@/lib/vms"
import { useVmsActions, type NewPass } from "@/lib/vms-actions"
import type {
  ClearanceLevel,
  VehicleType,
  Visitor,
  VisitorPurpose,
} from "@/lib/types"

const PURPOSES: VisitorPurpose[] = [
  "meeting",
  "delivery",
  "contractor",
  "interview",
  "event",
  "personal",
]
const ID_TYPES: Visitor["idType"][] = [
  "nid",
  "passport",
  "driving",
  "employeeId",
]
const STAY_HOURS = [1, 2, 3, 4, 6, 8]
const VEHICLE_TYPES: VehicleType[] = [
  "car",
  "suv",
  "van",
  "motorcycle",
  "bus",
  "truck",
]

/**
 * "Issue pass": registers a visitor at the gate, then shows the new pass
 * ready to print. Used on the overview, the visitor log and the gate passes.
 */
export function IssuePassButton() {
  const { t } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [issued, setIssued] = React.useState<Visitor | null>(null)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus />
        {t("visitors.issuePass")}
      </Button>
      <IssuePassSheet open={open} onOpenChange={setOpen} onIssued={setIssued} />
      <IssuedPassDialog visitor={issued} onClose={() => setIssued(null)} />
    </>
  )
}

function IssuePassSheet({
  open,
  onOpenChange,
  onIssued,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onIssued: (visitor: Visitor) => void
}) {
  const data = useDataset()
  const actions = useVmsActions()
  const { t, tk, locale, num } = useLocale()
  const [clearance, setClearance] = React.useState<ClearanceLevel>("standard")

  // The form itself remounts blank on every open; reset what lives outside it.
  const changeOpen = (next: boolean) => {
    if (!next) setClearance("standard")
    onOpenChange(next)
  }

  const hosts = React.useMemo(
    () =>
      Object.fromEntries(
        [...data.staff]
          .sort((a, b) => a.name[locale].localeCompare(b.name[locale]))
          .map((member) => [
            member.id,
            `${member.name[locale]} · ${t(`staff.departments.${member.department}` as never)}`,
          ])
      ),
    [data.staff, locale, t]
  )
  const escorts = React.useMemo(
    () =>
      Object.fromEntries(
        data.staff
          .filter((member) => member.department === "security")
          .map((member) => [member.id, member.name[locale]])
      ),
    [data.staff, locale]
  )

  const labels = <T extends string>(values: readonly T[], key: string) =>
    Object.fromEntries(values.map((value) => [value, tk(`${key}.${value}`)]))

  const submit = (values: Record<string, string>) => {
    if (values.phone && !isPhone(values.phone)) {
      return { phone: t("vms.pass.phoneInvalid") }
    }
    const pass: NewPass = {
      name: values.name,
      company: values.company,
      phone: values.phone,
      purpose: values.purpose as VisitorPurpose,
      hostStaffId: values.host,
      clearance: values.clearance as ClearanceLevel,
      escortStaffId: values.escort || undefined,
      idType: values.idType as Visitor["idType"],
      idNumber: values.idNumber,
      gate: values.gate as NewPass["gate"],
      stayHours: Number(values.stay),
      plate: values.plate || undefined,
      vehicleType: (values.vehicleType as VehicleType) || undefined,
    }
    onIssued(actions.issuePass(pass))
  }

  const showEscort = clearance === "restricted" || clearance === "cip"

  return (
    <FormSheet
      open={open}
      onOpenChange={changeOpen}
      title={t("vms.pass.title")}
      description={t("vms.pass.hint")}
      submitLabel={t("visitors.issuePass")}
      onSubmit={submit}
    >
      <FormSheetField name="name" label={t("common.name")} required>
        {(field) => <Input {...field} autoComplete="off" />}
      </FormSheetField>
      <div className="grid grid-cols-2 gap-3">
        <FormSheetField name="company" label={t("vms.pass.company")}>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormSheetField>
        <FormSheetField name="phone" label={t("common.phone")}>
          {(field) => <Input {...field} type="tel" autoComplete="off" />}
        </FormSheetField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormSheetField name="purpose" label={t("visitors.purpose")} required>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={labels(PURPOSES, "visitors.purposes")}
              defaultValue="meeting"
            />
          )}
        </FormSheetField>
        <FormSheetField name="gate" label={t("vms.gate")} required>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={labels(GATE_IDS, "vms.gates")}
              defaultValue="mainLobby"
            />
          )}
        </FormSheetField>
      </div>
      <FormSheetField name="host" label={t("visitors.visiting")} required>
        {(field, controls) => (
          <FormSheetSelect field={field} controls={controls} items={hosts} />
        )}
      </FormSheetField>
      <FormSheetField
        name="clearance"
        label={t("vms.clearance.title")}
        required
      >
        {(field, controls) => (
          <FormSheetSelect
            field={field}
            controls={controls}
            items={Object.fromEntries(
              CLEARANCE_ORDER.map((level) => [level, t(CLEARANCE_LABEL[level])])
            )}
            defaultValue="standard"
            onChange={(value) => setClearance(value as ClearanceLevel)}
          />
        )}
      </FormSheetField>
      {showEscort ? (
        <FormSheetField
          key={clearance}
          name="escort"
          label={t("visitors.escort")}
          required={clearance === "restricted"}
          description={
            clearance === "restricted"
              ? t("vms.pass.escortHint")
              : t("vms.pass.cipEscortHint")
          }
        >
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={escorts}
            />
          )}
        </FormSheetField>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <FormSheetField name="idType" label={t("vms.idDocument")} required>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={labels(ID_TYPES, "vms.ids")}
              defaultValue="nid"
            />
          )}
        </FormSheetField>
        <FormSheetField name="idNumber" label={t("vms.pass.idNumber")}>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormSheetField>
      </div>
      <FormSheetField name="stay" label={t("vms.pass.stay")} required>
        {(field, controls) => (
          <FormSheetSelect
            field={field}
            controls={controls}
            items={Object.fromEntries(
              STAY_HOURS.map((hours) => [
                String(hours),
                tk(`vms.pass.hours.${hours === 1 ? "one" : "other"}`, {
                  count: num(hours),
                }),
              ])
            )}
            defaultValue="2"
          />
        )}
      </FormSheetField>
      <div className="grid grid-cols-2 gap-3">
        <FormSheetField
          name="plate"
          label={t("vms.pass.plate")}
          description={t("vms.pass.plateHint")}
        >
          {(field) => <Input {...field} autoComplete="off" />}
        </FormSheetField>
        <FormSheetField name="vehicleType" label={t("vms.pass.vehicleType")}>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={labels(VEHICLE_TYPES, "vms.vehicles.types")}
              defaultValue="car"
            />
          )}
        </FormSheetField>
      </div>
    </FormSheet>
  )
}

/** The pass just issued, ready to print. */
function IssuedPassDialog({
  visitor,
  onClose,
}: {
  visitor: Visitor | null
  onClose: () => void
}) {
  const { t, locale } = useLocale()
  const printPasses = usePrintPasses()
  // Keep the last pass on screen while the dialog animates closed.
  const [shown, setShown] = React.useState(visitor)
  if (visitor && visitor !== shown) setShown(visitor)

  return (
    <Dialog open={visitor !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("vms.pass.issuedTitle")}</DialogTitle>
          {shown ? (
            <DialogDescription>
              {t("vms.pass.issued", {
                badge: shown.badge,
                name: shown.name[locale],
              })}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {shown ? <GatePassCard visitor={shown} /> : null}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common.done")}
          </Button>
          <Button size="sm" onClick={() => shown && printPasses([shown])}>
            <Printer />
            {t("vms.pass.print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

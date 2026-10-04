"use client"

import * as React from "react"
import { Car, IdCard, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/motion/avatar-stack"
import { Panel } from "@/components/motion/card-shell"
import { StatusTag } from "@/components/motion/status-tag"
import { cn } from "@/lib/utils"
import { useLookups, useTenant } from "@/lib/data"
import { HUE_VAR } from "@/lib/hue"
import { useLocale } from "@/lib/i18n/provider"
import { createRng } from "@/lib/mock/rng"
import { usePrint } from "@/lib/print"
import { CLEARANCE_HUE, CLEARANCE_LABEL } from "@/lib/vms"
import type { Visitor } from "@/lib/types"

/** A visitor's gate pass as shown on screen. */
export function GatePassCard({
  visitor,
  onPrint,
}: {
  visitor: Visitor
  /** Shows a print button on the pass. */
  onPrint?: () => void
}) {
  const lookups = useLookups()
  const { t, locale, time } = useLocale()
  const host = lookups.staff.get(visitor.hostStaffId)
  const vehicle = visitor.vehicleId
    ? lookups.vehicle.get(visitor.vehicleId)
    : undefined

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <IdCard className="size-3 text-muted-foreground" />
          <span className="nums">{visitor.badge}</span>
        </span>
      }
      actions={
        <StatusTag hue={CLEARANCE_HUE[visitor.clearance]} dot>
          {t(CLEARANCE_LABEL[visitor.clearance])}
        </StatusTag>
      }
    >
      <div className="flex items-center gap-2.5 pt-1">
        <Avatar
          name={visitor.name[locale]}
          seed={visitor.photoSeed}
          size={36}
        />
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">
            {visitor.name[locale]}
          </div>
          <div className="truncate text-[0.625rem] text-muted-foreground">
            {visitor.company[locale]}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <PassField
          label={t("visitors.purpose")}
          value={t(`visitors.purposes.${visitor.purpose}` as never)}
        />
        <PassField
          label={t("visitors.checkedInAt")}
          value={time(visitor.checkedInAt)}
        />
        <PassField
          label={t("visitors.visiting")}
          value={host?.name[locale] ?? "—"}
        />
        <PassField label={t("common.phone")} value={visitor.phone || "—"} />
      </div>

      {vehicle ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-surface px-2 py-1.5">
          <Car className="size-3 text-muted-foreground" />
          <span className="nums truncate text-[0.625rem]">
            {vehicle.plate[locale]}
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-1.5">
        <PassBarcode code={visitor.badge} className="h-6 flex-1 opacity-85" />
        {onPrint ? (
          <Button
            size="xs"
            variant="ghost"
            onClick={onPrint}
            aria-label={t("vms.pass.print")}
            title={t("vms.pass.print")}
          >
            <Printer />
          </Button>
        ) : null}
      </div>
    </Panel>
  )
}

function PassField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="micro">{label}</div>
      <div className="nums mt-0.5 truncate text-[0.6875rem]">{value}</div>
    </div>
  )
}

/**
 * A barcode-like strip drawn from the badge number, so every pass has its
 * own pattern and the same badge always draws the same bars.
 */
export function PassBarcode({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  const bars = React.useMemo(() => {
    const rng = createRng(`barcode:${code}`)
    return Array.from({ length: 36 }, () => ({
      width: rng.int(1, 3),
      gap: rng.int(1, 2),
    }))
  }, [code])

  return (
    <span aria-hidden className={cn("flex items-stretch", className)}>
      {bars.map((bar, index) => (
        <span
          key={index}
          className="bg-current"
          style={{ flexGrow: bar.width, flexBasis: 0, marginRight: bar.gap }}
        />
      ))}
    </span>
  )
}

/** Prints one or more passes, each on its own ID-card-sized page. */
export function usePrintPasses() {
  const print = usePrint()
  const { t } = useLocale()

  return React.useCallback(
    (visitors: readonly Visitor[]) => {
      if (visitors.length === 0) return
      print(
        <>
          {visitors.map((visitor) => (
            <PrintablePass key={visitor.id} visitor={visitor} />
          ))}
        </>,
        {
          title:
            visitors.length === 1
              ? t("vms.pass.printTitle", { badge: visitors[0].badge })
              : t("vms.pass.printTitleMany"),
          size: "85.6mm 54mm",
          margin: "0",
        }
      )
    },
    [print, t]
  )
}

/** The printed pass: ID-1 card size (85.6 × 54 mm), static for print. */
function PrintablePass({ visitor }: { visitor: Visitor }) {
  const tenant = useTenant()
  const lookups = useLookups()
  const { t, locale, time } = useLocale()
  const host = lookups.staff.get(visitor.hostStaffId)
  const escort = visitor.escortStaffId
    ? lookups.staff.get(visitor.escortStaffId)
    : undefined
  const vehicle = visitor.vehicleId
    ? lookups.vehicle.get(visitor.vehicleId)
    : undefined
  const hue = HUE_VAR[CLEARANCE_HUE[visitor.clearance]]

  const details: { label: string; value: string; wide?: boolean }[] = [
    {
      label: t("visitors.purpose"),
      value: t(`visitors.purposes.${visitor.purpose}` as never),
    },
    { label: t("visitors.visiting"), value: host?.name[locale] ?? "—" },
    {
      label: t("vms.clearance.validUntil"),
      value: visitor.expectedOutAt ? time(visitor.expectedOutAt) : "—",
    },
    // Plates are long; give them two of the three columns.
    ...(vehicle
      ? [
          {
            label: t("visitors.vehicle"),
            value: vehicle.plate[locale],
            wide: true,
          },
        ]
      : []),
    ...(visitor.escortRequired
      ? [{ label: t("visitors.escort"), value: escort?.name[locale] ?? "—" }]
      : []),
  ]

  return (
    <section
      className="flex flex-col justify-between overflow-hidden bg-white p-[3.5mm] text-neutral-900 not-last:break-after-page"
      style={{ width: "85.6mm", height: "54mm" }}
    >
      <header className="flex items-start justify-between gap-[2mm]">
        <div className="flex min-w-0 items-center gap-[2mm]">
          <span className="flex size-[7mm] shrink-0 items-center justify-center rounded-[1.5mm] bg-neutral-900 text-[7pt] font-semibold text-white">
            {tenant.initials}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[7pt] font-semibold">
              {tenant.name[locale]}
            </div>
            <div className="text-[6pt] text-neutral-500">
              {t("vms.pass.visitorPass")}
            </div>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full border px-[2mm] py-[0.3mm] text-[6.5pt] font-semibold"
          style={{
            color: hue,
            borderColor: hue,
            background: `color-mix(in oklch, ${hue} 12%, white)`,
          }}
        >
          {t(CLEARANCE_LABEL[visitor.clearance])}
        </span>
      </header>

      <div className="min-w-0 leading-tight">
        <div className="truncate text-[11pt] font-semibold">
          {visitor.name[locale]}
        </div>
        {visitor.company[locale] ? (
          <div className="truncate text-[7pt] text-neutral-600">
            {visitor.company[locale]}
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-3 gap-x-[2mm] gap-y-[1mm] leading-tight">
        {details.map((detail) => (
          <div
            key={detail.label}
            className={cn("min-w-0", detail.wide && "col-span-2")}
          >
            <dt className="truncate text-[5.5pt] text-neutral-500 uppercase">
              {detail.label}
            </dt>
            <dd className="truncate text-[7pt] font-medium">{detail.value}</dd>
          </div>
        ))}
      </dl>

      <footer className="flex items-end gap-[3mm]">
        <PassBarcode code={visitor.badge} className="h-[7mm] flex-1" />
        <span className="font-mono text-[10pt] font-semibold">
          {visitor.badge}
        </span>
      </footer>
    </section>
  )
}

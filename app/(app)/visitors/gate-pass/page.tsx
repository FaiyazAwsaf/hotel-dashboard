"use client"

import * as React from "react"
import { motion } from "motion/react"
import { IdCard } from "lucide-react"

import { EmptyState, PageHeader } from "@/components/motion/card-shell"
import { GatePassCard, usePrintPasses } from "@/components/vms/gate-pass"
import { IssuePassButton } from "@/components/vms/issue-pass"
import { useDataset } from "@/lib/data"
import { useLocale } from "@/lib/i18n/provider"

export default function GatePassPage() {
  const data = useDataset()
  const printPasses = usePrintPasses()
  const { t, num } = useLocale()

  // Everyone on site holds a live pass. Passes issued this session are added
  // at the top of the visitor list, so they lead here too.
  const active = React.useMemo(
    () => data.visitors.filter((visitor) => !visitor.checkedOutAt),
    [data.visitors]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("visitors.gatePass")}
        subtitle={`${num(active.length)} ${t("common.live").toLowerCase()}`}
      >
        <IssuePassButton />
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {active.length === 0 ? (
          <EmptyState icon={<IdCard />} title={t("vms.nobodyOnSite")} />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((visitor, index) => (
              <motion.div
                key={visitor.id}
                initial={{ opacity: 0, y: 10, rotateX: -6 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{
                  delay: Math.min(index, 12) * 0.04,
                  duration: 0.3,
                }}
              >
                <GatePassCard
                  visitor={visitor}
                  onPrint={() => printPasses([visitor])}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Clock, Download, FileText, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Panel, PageHeader } from "@/components/motion/card-shell"
import { Sparkline } from "@/components/motion/comb-chart"
import { SegmentedPills } from "@/components/motion/segmented"
import { StatusTag } from "@/components/motion/status-tag"
import { useTenant } from "@/lib/data"
import { useLocale } from "@/lib/i18n/provider"
import { CHART_COLORS } from "@/lib/hue"
import {
  REPORTS,
  reportText,
  useReportDownload,
  type ReportCategory,
} from "@/lib/reports"
import { useUi } from "@/lib/store"

type Category = "all" | ReportCategory

export default function ReportsPage() {
  const { t, locale } = useLocale()
  const tenant = useTenant()
  const router = useRouter()
  const download = useReportDownload()
  const setStudioDraft = useUi((state) => state.setStudioDraft)
  const [category, setCategory] = React.useState<Category>("all")

  const filtered =
    category === "all"
      ? REPORTS
      : REPORTS.filter((report) => report.category === category)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("reports.library")}
        subtitle={t("nav.groups.intelligence")}
      >
        <SegmentedPills
          size="sm"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: t("common.all") },
            { value: "operations", label: t("reports.categories.operations") },
            { value: "revenue", label: t("reports.categories.revenue") },
            { value: "guest", label: t("reports.categories.guest") },
            { value: "staff", label: t("reports.categories.staff") },
            { value: "compliance", label: t("reports.categories.compliance") },
          ]}
        />
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href="/ai/reports" />}
        >
          <Sparkles />
          {t("ai.reportStudio")}
        </Button>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((report, index) => {
            const text = reportText(report, tenant)
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 10) * 0.04 }}
              >
                <Panel
                  title={
                    <span className="flex items-center gap-1.5">
                      <FileText className="size-3 text-muted-foreground" />
                      {text.name[locale]}
                    </span>
                  }
                  onExpand={() => {
                    setStudioDraft(text.brief[locale])
                    router.push("/ai/reports")
                  }}
                  expandLabel={t("reports.openInStudio")}
                >
                  <div className="flex items-center gap-1.5 pt-1">
                    <StatusTag hue={report.hue}>
                      {t(`reports.categories.${report.category}` as never)}
                    </StatusTag>
                    {report.ai ? (
                      <StatusTag hue="blue">
                        <Sparkles className="size-2" />
                        {t("common.ai")}
                      </StatusTag>
                    ) : null}
                  </div>
                  <Sparkline
                    values={Array.from({ length: 22 }, (_, i) =>
                      Math.abs(Math.sin(i / 2 + index))
                    )}
                    color={CHART_COLORS[index % CHART_COLORS.length]}
                    className="mt-3"
                  />
                  <div className="mt-3 flex items-center gap-2 text-[0.625rem] text-muted-foreground">
                    <Clock className="size-2.5" />
                    {report.schedule[locale]}
                    <Button
                      size="xs"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => download(report.id)}
                      aria-label={t("reports.downloadCsv")}
                      title={t("reports.downloadCsv")}
                    >
                      <Download />
                    </Button>
                  </div>
                </Panel>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

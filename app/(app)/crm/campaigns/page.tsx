"use client"

import * as React from "react"
import { motion } from "motion/react"
import { CalendarClock, Send, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NewCampaignButton } from "@/components/crm/forms"
import { Panel, PageHeader } from "@/components/motion/card-shell"
import { KpiStrip } from "@/components/motion/kpi-strip"
import { Meter } from "@/components/motion/waveform"
import { StatusTag } from "@/components/motion/status-tag"
import { ChannelBadge } from "@/components/icons/channel-icons"
import { useDataset, useMoney } from "@/lib/data"
import { useLocale } from "@/lib/i18n/provider"
import { CHART_COLORS } from "@/lib/hue"

export default function CampaignsPage() {
  const data = useDataset()
  const money = useMoney()
  const { t, locale, num, pct, date } = useLocale()
  const campaigns = data.campaigns

  const kpis = React.useMemo(() => {
    const sent = campaigns.reduce((sum, c) => sum + c.sent, 0)
    const booked = campaigns.reduce((sum, c) => sum + c.sent * c.booked, 0)
    return [
      {
        id: "live",
        label: t("common.live"),
        value: campaigns.filter((c) => c.state === "live").length,
        color: CHART_COLORS[5],
      },
      {
        id: "sent",
        label: t("common.total"),
        value: sent,
        format: { notation: "compact" as const },
        color: CHART_COLORS[0],
      },
      {
        id: "booked",
        label: t("nav.bookings"),
        value: Math.round(booked),
        color: CHART_COLORS[1],
      },
      {
        id: "revenue",
        label: t("finance.revenue"),
        value: Math.round(booked * 22000),
        prefix: money.symbol,
        format: { notation: "compact" as const, maximumFractionDigits: 1 },
        color: CHART_COLORS[3],
      },
    ]
  }, [campaigns, t, money.symbol])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t("crm.campaigns")} subtitle={t("nav.groups.crm")}>
        <NewCampaignButton />
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5">
        <KpiStrip cells={kpis} />
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign, index) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Panel
                title={
                  <span className="flex items-center gap-1.5">
                    <ChannelBadge channel={campaign.channel} size={20} />
                    {campaign.name[locale]}
                  </span>
                }
                actions={
                  <StatusTag
                    hue={
                      campaign.state === "live"
                        ? "green"
                        : campaign.state === "scheduled"
                          ? "amber"
                          : "slate"
                    }
                    dot
                  >
                    {campaign.state === "live"
                      ? t("common.live")
                      : campaign.state === "scheduled"
                        ? t("reports.scheduled")
                        : t("common.done")}
                  </StatusTag>
                }
              >
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="figure text-xl">{num(campaign.sent)}</span>
                  <span className="text-[0.625rem] text-muted-foreground">
                    {campaign.scheduledAt
                      ? t("crm.forms.recipientsLabel")
                      : t("common.total").toLowerCase()}
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <Meter
                    value={campaign.opened}
                    label={t("nav.inbox")}
                    tone="primary"
                  />
                  <Meter
                    value={campaign.booked}
                    label={t("nav.bookings")}
                    tone="success"
                  />
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  {campaign.scheduledAt ? (
                    <>
                      <CalendarClock className="size-3 text-muted-foreground" />
                      <span className="text-[0.625rem] text-muted-foreground">
                        {t("crm.forms.scheduledFor", {
                          date: date(campaign.scheduledAt, {
                            day: "numeric",
                            month: "long",
                          }),
                          audience: campaign.audience
                            ? t(`crm.audiences.${campaign.audience}` as never)
                            : "",
                        })}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3 text-primary" />
                      <span className="text-[0.625rem] text-muted-foreground">
                        {locale === "bn"
                          ? `এআই প্রস্তাব: ${pct(campaign.booked * 100 + 3, 0)} পর্যন্ত বাড়ানো সম্ভব`
                          : `AI suggests headroom to ${pct(campaign.booked * 100 + 3, 0)}`}
                      </span>
                    </>
                  )}
                  <Button size="xs" variant="ghost" className="ml-auto">
                    <Send />
                  </Button>
                </div>
              </Panel>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

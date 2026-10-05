"use client"

import * as React from "react"
import { motion } from "motion/react"
import { Check, Plug } from "lucide-react"
import { toast } from "sonner"

import { Switch } from "@/components/ui/switch"
import { AddIntegrationButton } from "@/components/admin/forms"
import { Panel, PageHeader } from "@/components/motion/card-shell"
import { StatusTag } from "@/components/motion/status-tag"
import { useDataEdits, useDataset } from "@/lib/data"
import { useLocale } from "@/lib/i18n/provider"

export default function IntegrationsPage() {
  const data = useDataset()
  const edits = useDataEdits()
  const { t, locale, num } = useLocale()

  // Connections are session edits, so they survive leaving the page.
  const integrations = data.integrations
  const connected = integrations.filter((i) => i.connected).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("admin.integrations")}
        subtitle={`${num(connected)} ${t("admin.connected").toLowerCase()}`}
      >
        <AddIntegrationButton />
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration, index) => (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 12) * 0.035 }}
            >
              <Panel
                title={
                  <span className="flex items-center gap-2">
                    <span
                      className="flex size-6 items-center justify-center rounded-md text-[0.625rem] font-semibold"
                      style={{
                        background: `color-mix(in oklch, var(--hue-${integration.hue}) 16%, transparent)`,
                        color: `var(--hue-${integration.hue})`,
                      }}
                    >
                      {integration.name.slice(0, 2).toUpperCase()}
                    </span>
                    {integration.name}
                  </span>
                }
                subtitle={integration.detail[locale]}
                actions={
                  <Switch
                    checked={integration.connected}
                    aria-label={integration.name}
                    onCheckedChange={(checked) => {
                      edits.update("integrations", integration.id, {
                        connected: !!checked,
                      })
                      toast.success(
                        t(
                          checked
                            ? "admin.forms.nowConnected"
                            : "admin.forms.disconnected",
                          { name: integration.name }
                        )
                      )
                    }}
                  />
                }
              >
                <div className="flex items-center gap-1.5 pt-1">
                  <StatusTag hue={integration.hue}>
                    {integration.category[locale]}
                  </StatusTag>
                  {integration.connected ? (
                    <StatusTag hue="green" dot>
                      <Check className="size-2" />
                      {t("admin.connected")}
                    </StatusTag>
                  ) : (
                    <StatusTag hue="slate">
                      <Plug className="size-2" />
                      {t("admin.notConnected")}
                    </StatusTag>
                  )}
                </div>
              </Panel>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

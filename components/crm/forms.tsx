"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FormSheet,
  FormSheetDate,
  FormSheetField,
  FormSheetSelect,
  type FormErrors,
  type FormValues,
} from "@/components/motion/form-sheet"
import { useCrmActions } from "@/lib/crm-actions"
import { useDataEdits, useDataset, useMoney } from "@/lib/data"
import { addDays, demoToday, isoDay } from "@/lib/demo-time"
import { useLocale } from "@/lib/i18n/provider"
import { SEGMENTS } from "@/lib/mock/generate"
import { CONTACT_TITLES, INDUSTRIES } from "@/lib/mock/pools"
import { isEmail, isPhone, parseNumber } from "@/lib/validate"
import type {
  Bilingual,
  Campaign,
  CampaignAudience,
  ChannelId,
  CompanySegment,
  Dataset,
  TagHue,
} from "@/lib/types"

/** Options from a bilingual pool, keyed by the English text. */
function poolItems(pool: readonly Bilingual[], locale: "en" | "bn") {
  return Object.fromEntries(pool.map((entry) => [entry.en, entry[locale]]))
}

/** Account owners: the sales team, or everyone when there is none. */
function useOwners() {
  const data = useDataset()
  const { locale } = useLocale()
  return React.useMemo(() => {
    const sales = data.staff.filter((member) => member.department === "sales")
    return Object.fromEntries(
      (sales.length ? sales : data.staff)
        .slice()
        .sort((a, b) => a.name[locale].localeCompare(b.name[locale]))
        .map((member) => [member.id, member.name[locale]])
    )
  }, [data.staff, locale])
}

/** Companies by name, for pickers. */
function useCompanyItems() {
  const data = useDataset()
  return React.useMemo(
    () =>
      Object.fromEntries(
        data.companies
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((company) => [company.id, company.name])
      ),
    [data.companies]
  )
}

/* ------------------------------------------------------------------ *
 * Companies → New
 * ------------------------------------------------------------------ */

export function NewCompanyButton() {
  const data = useDataset()
  const actions = useCrmActions()
  const owners = useOwners()
  const { t, locale } = useLocale()
  const [open, setOpen] = React.useState(false)

  const submit = (values: FormValues): FormErrors | void => {
    const taken = data.companies.find(
      (company) => company.name.toLowerCase() === values.name.toLowerCase()
    )
    if (taken) {
      return { name: t("forms.alreadyExists", { name: taken.name }) }
    }
    const company = actions.addCompany({
      name: values.name,
      segment: values.segment as CompanySegment,
      industry:
        INDUSTRIES.find((entry) => entry.en === values.industry) ??
        INDUSTRIES[0],
      ownerId: values.owner,
    })
    toast.success(t("crm.forms.companyAdded", { name: company.name }))
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        {t("common.new")}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={t("crm.forms.companyTitle")}
        description={t("crm.forms.companyHint")}
        submitLabel={t("crm.forms.addCompany")}
        onSubmit={submit}
      >
        <FormSheetField name="name" label={t("common.name")} required>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormSheetField>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField
            name="segment"
            label={t("crm.forms.segment")}
            required
          >
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={Object.fromEntries(
                  SEGMENTS.map((segment) => [
                    segment,
                    t(`crm.segments.${segment}` as never),
                  ])
                )}
                defaultValue="enterprise"
              />
            )}
          </FormSheetField>
          <FormSheetField
            name="industry"
            label={t("crm.forms.industry")}
            required
          >
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={poolItems(INDUSTRIES, locale)}
              />
            )}
          </FormSheetField>
        </div>
        <FormSheetField name="owner" label={t("crm.owner")} required>
          {(field, controls) => (
            <FormSheetSelect field={field} controls={controls} items={owners} />
          )}
        </FormSheetField>
      </FormSheet>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Contacts → New
 * ------------------------------------------------------------------ */

export function NewContactButton() {
  const data = useDataset()
  const actions = useCrmActions()
  const companies = useCompanyItems()
  const { t, locale } = useLocale()
  const [open, setOpen] = React.useState(false)

  const submit = (values: FormValues): FormErrors | void => {
    const errors: FormErrors = {}
    if (!isEmail(values.email)) {
      errors.email = t("share.emailInvalid")
    } else {
      const taken = data.contacts.find(
        (c) => c.email.toLowerCase() === values.email.toLowerCase()
      )
      if (taken) {
        errors.email = t("forms.emailTaken", { name: taken.name[locale] })
      }
    }
    if (values.phone && !isPhone(values.phone)) {
      errors.phone = t("share.phoneInvalid")
    }
    if (Object.keys(errors).length > 0) return errors

    const contact = actions.addContact({
      name: values.name,
      title:
        CONTACT_TITLES.find((entry) => entry.en === values.title) ??
        CONTACT_TITLES[0],
      companyId: values.company,
      email: values.email,
      phone: values.phone,
    })
    toast.success(
      t("crm.forms.contactAdded", {
        name: contact.name[locale],
        company: companies[values.company] ?? "",
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
        onOpenChange={setOpen}
        title={t("crm.forms.contactTitle")}
        description={t("crm.forms.contactHint")}
        submitLabel={t("crm.forms.addContact")}
        onSubmit={submit}
      >
        <FormSheetField name="name" label={t("common.name")} required>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormSheetField>
        <FormSheetField name="title" label={t("crm.forms.jobTitle")} required>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={poolItems(CONTACT_TITLES, locale)}
            />
          )}
        </FormSheetField>
        <FormSheetField name="company" label={t("crm.forms.company")} required>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={companies}
            />
          )}
        </FormSheetField>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField name="email" label={t("common.email")} required>
            {(field) => <Input {...field} type="email" autoComplete="off" />}
          </FormSheetField>
          <FormSheetField name="phone" label={t("common.phone")}>
            {(field) => <Input {...field} type="tel" autoComplete="off" />}
          </FormSheetField>
        </div>
      </FormSheet>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Pipeline → + Deals
 * ------------------------------------------------------------------ */

export function NewDealButton() {
  const data = useDataset()
  const actions = useCrmActions()
  const owners = useOwners()
  const companies = useCompanyItems()
  const money = useMoney()
  const { t, locale, num } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [companyId, setCompanyId] = React.useState<string>()

  const changeOpen = (next: boolean) => {
    if (!next) setCompanyId(undefined)
    setOpen(next)
  }

  const company = data.companies.find((entry) => entry.id === companyId)
  const contacts = React.useMemo(
    () =>
      Object.fromEntries(
        data.contacts
          .filter((contact) => contact.companyId === companyId)
          .map((contact) => [
            contact.id,
            `${contact.name[locale]} · ${contact.title[locale]}`,
          ])
      ),
    [data.contacts, companyId, locale]
  )
  const hasContacts = Object.keys(contacts).length > 0
  const today = isoDay(demoToday())

  const submit = (values: FormValues): FormErrors | void => {
    const errors: FormErrors = {}
    const value = parseNumber(values.value)
    const roomNights = parseNumber(values.roomNights)
    if (value === null || value <= 0) {
      errors.value = t("forms.positiveNumber")
    }
    if (
      roomNights === null ||
      !Number.isInteger(roomNights) ||
      roomNights < 1
    ) {
      errors.roomNights = t("forms.wholeNumber", { min: num(1) })
    }
    if (values.closeDate < today) {
      errors.closeDate = t("forms.notInPast")
    }
    if (
      Object.keys(errors).length > 0 ||
      value === null ||
      roomNights === null
    ) {
      return errors
    }

    const deal = actions.addDeal({
      title: values.title,
      companyId: values.company,
      contactId: values.contact || undefined,
      ownerId: values.owner,
      value: Math.round(value),
      roomNights,
      closeDate: values.closeDate,
    })
    toast.success(
      t("crm.forms.dealAdded", {
        name: deal.title[locale],
        stage: t("crm.stages.enquiry"),
      })
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        {t("crm.deals")}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={changeOpen}
        title={t("crm.forms.dealTitle")}
        description={t("crm.forms.dealHint")}
        submitLabel={t("crm.forms.addDeal")}
        onSubmit={submit}
      >
        <FormSheetField name="title" label={t("crm.forms.dealName")} required>
          {(field) => (
            <Input
              {...field}
              autoComplete="off"
              placeholder={t("crm.forms.dealPlaceholder")}
            />
          )}
        </FormSheetField>
        <FormSheetField name="company" label={t("crm.forms.company")} required>
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={companies}
              onChange={setCompanyId}
            />
          )}
        </FormSheetField>
        {company ? (
          <div className="grid grid-cols-2 gap-3">
            <FormSheetField
              // A new company starts the contact and owner over.
              key={`contact-${company.id}`}
              name="contact"
              label={t("crm.forms.contact")}
              required={hasContacts}
              description={hasContacts ? undefined : t("crm.forms.noContacts")}
            >
              {(field, controls) =>
                hasContacts ? (
                  <FormSheetSelect
                    field={field}
                    controls={controls}
                    items={contacts}
                    defaultValue={Object.keys(contacts)[0]}
                  />
                ) : (
                  <Input {...field} disabled value="—" readOnly />
                )
              }
            </FormSheetField>
            <FormSheetField
              key={`owner-${company.id}`}
              name="owner"
              label={t("crm.owner")}
              required
            >
              {(field, controls) => (
                <FormSheetSelect
                  field={field}
                  controls={controls}
                  items={owners}
                  defaultValue={
                    company.ownerId in owners ? company.ownerId : undefined
                  }
                />
              )}
            </FormSheetField>
          </div>
        ) : (
          <FormSheetField name="owner" label={t("crm.owner")} required>
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={owners}
              />
            )}
          </FormSheetField>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField
            name="value"
            label={`${t("crm.forms.value")} (${money.symbol})`}
            required
          >
            {(field) => (
              <Input {...field} inputMode="decimal" autoComplete="off" />
            )}
          </FormSheetField>
          <FormSheetField
            name="roomNights"
            label={t("crm.roomNights")}
            required
          >
            {(field) => (
              <Input {...field} inputMode="numeric" autoComplete="off" />
            )}
          </FormSheetField>
        </div>
        <FormSheetField
          name="closeDate"
          label={t("crm.forms.closeDate")}
          required
        >
          {(field, controls) => (
            <FormSheetDate
              field={field}
              controls={controls}
              min={today}
              defaultValue={isoDay(addDays(demoToday(), 30))}
            />
          )}
        </FormSheetField>
      </FormSheet>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Campaigns → + New
 * ------------------------------------------------------------------ */

const CAMPAIGN_CHANNELS: ChannelId[] = [
  "whatsapp",
  "email",
  "sms",
  "messenger",
  "instagram",
  "webchat",
]

const CHANNEL_HUE: Record<ChannelId, TagHue> = {
  whatsapp: "green",
  email: "blue",
  sms: "amber",
  messenger: "purple",
  instagram: "magenta",
  webchat: "teal",
  voice: "slate",
}

export const AUDIENCES: CampaignAudience[] = [
  "allGuests",
  "member",
  "silver",
  "gold",
  "platinum",
  "corporate",
]

/** How many people an audience reaches. */
export function audienceSize(
  data: Pick<Dataset, "guests" | "contacts">,
  audience: CampaignAudience
) {
  if (audience === "allGuests") return data.guests.length
  if (audience === "corporate") return data.contacts.length
  return data.guests.filter((guest) => guest.tier === audience).length
}

export function NewCampaignButton() {
  const data = useDataset()
  const edits = useDataEdits()
  const { t, num, date } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [audience, setAudience] = React.useState<CampaignAudience>("allGuests")

  const changeOpen = (next: boolean) => {
    if (!next) setAudience("allGuests")
    setOpen(next)
  }

  const today = isoDay(demoToday())
  const reach = audienceSize(data, audience)

  const submit = (values: FormValues): FormErrors | void => {
    if (values.sendOn < today) return { sendOn: t("forms.notInPast") }
    const channel = values.channel as ChannelId
    const chosen = values.audience as CampaignAudience
    const campaign: Campaign = {
      id: edits.newId("campaign"),
      name: { en: values.name, bn: values.name },
      channel,
      state: "scheduled",
      hue: CHANNEL_HUE[channel],
      sent: audienceSize(data, chosen),
      opened: 0,
      booked: 0,
      audience: chosen,
      scheduledAt: values.sendOn,
    }
    edits.add("campaigns", campaign)
    toast.success(
      t("crm.forms.campaignAdded", {
        name: values.name,
        date: date(values.sendOn, { day: "numeric", month: "long" }),
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
        title={t("crm.forms.campaignTitle")}
        description={t("crm.forms.campaignHint")}
        submitLabel={t("crm.forms.schedule")}
        onSubmit={submit}
      >
        <FormSheetField name="name" label={t("common.name")} required>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormSheetField>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField
            name="channel"
            label={t("crm.forms.channel")}
            required
          >
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={Object.fromEntries(
                  CAMPAIGN_CHANNELS.map((channel) => [
                    channel,
                    t(`inbox.channels.${channel}` as never),
                  ])
                )}
                defaultValue="whatsapp"
              />
            )}
          </FormSheetField>
          <FormSheetField
            name="audience"
            label={t("crm.forms.audience")}
            required
            description={t("crm.forms.recipients", { count: num(reach) })}
          >
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={Object.fromEntries(
                  AUDIENCES.map((entry) => [
                    entry,
                    t(`crm.audiences.${entry}` as never),
                  ])
                )}
                defaultValue="allGuests"
                onChange={(value) => setAudience(value as CampaignAudience)}
              />
            )}
          </FormSheetField>
        </div>
        <FormSheetField name="sendOn" label={t("crm.forms.sendOn")} required>
          {(field, controls) => (
            <FormSheetDate
              field={field}
              controls={controls}
              min={today}
              defaultValue={isoDay(addDays(demoToday(), 1))}
            />
          )}
        </FormSheetField>
      </FormSheet>
    </>
  )
}

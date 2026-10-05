"use client"

import * as React from "react"

import { useDataEdits, useDataset } from "@/lib/data"
import { demoToday, isoDay } from "@/lib/demo-time"
import { SEGMENT_HUES } from "@/lib/mock/generate"
import type {
  Bilingual,
  Company,
  CompanySegment,
  Contact,
  Deal,
} from "@/lib/types"

export type NewCompany = {
  name: string
  segment: CompanySegment
  industry: Bilingual
  ownerId: string
}

export type NewContact = {
  name: string
  title: Bilingual
  companyId: string
  email: string
  phone: string
}

export type NewDeal = {
  title: string
  companyId: string
  contactId?: string
  ownerId: string
  value: number
  roomNights: number
  closeDate: string
}

/** What the AI suggests for a deal that has only just come in. */
const FIRST_ACTION: Bilingual = {
  en: "Qualify the enquiry: confirm dates, block size and budget with the contact within 24 hours.",
  bn: "২৪ ঘণ্টার মধ্যে যোগাযোগকারীর সাথে তারিখ, কক্ষের সংখ্যা ও বাজেট নিশ্চিত করে অনুসন্ধানটি যাচাই করুন।",
}

/** Lower-case letters only, so "Grameen Tech Ltd." is `grameentechltd.com`. */
function domainFor(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z]/g, "")
  return slug ? `${slug}.com` : ""
}

/**
 * Creating CRM records. A new contact or deal also touches its company —
 * the contact count and the last-activity date — so the companies list stays
 * in step.
 */
export function useCrmActions() {
  const data = useDataset()
  const edits = useDataEdits()

  return React.useMemo(() => {
    const today = isoDay(demoToday())
    const touchCompany = (companyId: string, changes: Partial<Company> = {}) =>
      edits.update("companies", companyId, { lastActivity: today, ...changes })

    return {
      addCompany(input: NewCompany): Company {
        const company: Company = {
          id: edits.newId("co"),
          name: input.name,
          segment: input.segment,
          industry: input.industry,
          ownerId: input.ownerId,
          accountValue: 0,
          roomNights: 0,
          contactCount: 0,
          lastActivity: today,
          domain: domainFor(input.name),
          hue: SEGMENT_HUES[input.segment],
        }
        edits.add("companies", company)
        return company
      },

      addContact(input: NewContact): Contact {
        const id = edits.newId("contact")
        const contact: Contact = {
          id,
          name: { en: input.name, bn: input.name },
          title: input.title,
          companyId: input.companyId,
          email: input.email,
          phone: input.phone,
          avatarSeed: `${input.name}-${id}`,
          lastTouch: today,
        }
        edits.add("contacts", contact)
        const company = data.companies.find((c) => c.id === input.companyId)
        if (company) {
          touchCompany(company.id, { contactCount: company.contactCount + 1 })
        }
        return contact
      },

      addDeal(input: NewDeal): Deal {
        const deal: Deal = {
          id: edits.newId("deal"),
          title: { en: input.title, bn: input.title },
          companyId: input.companyId,
          contactId: input.contactId ?? "",
          ownerId: input.ownerId,
          stage: "enquiry",
          value: input.value,
          roomNights: input.roomNights,
          probability: 10,
          closeDate: input.closeDate,
          createdAt: today,
          aiNextAction: FIRST_ACTION,
        }
        edits.add("deals", deal)
        touchCompany(input.companyId)
        return deal
      },
    }
  }, [data.companies, edits])
}

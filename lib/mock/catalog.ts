import { demoNow } from "@/lib/demo-time"
import type {
  AppUser,
  Campaign,
  Integration,
  StaffMember,
  UserRole,
} from "@/lib/types"

/**
 * Lists that are the same at every property — marketing campaigns, connected
 * integrations and the extra connectors that can be added — and the app
 * users, drawn from the property's staff. None of them draw from the
 * dataset's RNG, so adding them never reshuffles the generated data.
 */

const CAMPAIGNS: Campaign[] = [
  {
    id: "monsoon",
    name: { en: "Monsoon staycation offer", bn: "বর্ষার স্টে-কেশন অফার" },
    channel: "whatsapp",
    state: "live",
    hue: "green",
    sent: 12400,
    opened: 0.74,
    booked: 0.09,
  },
  {
    id: "corporate",
    name: { en: "Corporate rate renewal", bn: "কর্পোরেট ভাড়া নবায়ন" },
    channel: "email",
    state: "live",
    hue: "blue",
    sent: 840,
    opened: 0.52,
    booked: 0.21,
  },
  {
    id: "winback",
    name: { en: "Win back lapsed guests", bn: "হারানো অতিথি ফিরিয়ে আনা" },
    channel: "sms",
    state: "scheduled",
    hue: "amber",
    sent: 5600,
    opened: 0.61,
    booked: 0.04,
  },
  {
    id: "eid",
    name: { en: "Eid family package", bn: "ঈদ পারিবারিক প্যাকেজ" },
    channel: "messenger",
    state: "done",
    hue: "purple",
    sent: 21800,
    opened: 0.68,
    booked: 0.12,
  },
  {
    id: "loyalty",
    name: { en: "Platinum upgrade nudge", bn: "প্ল্যাটিনাম আপগ্রেড অনুরোধ" },
    channel: "instagram",
    state: "live",
    hue: "magenta",
    sent: 3100,
    opened: 0.81,
    booked: 0.16,
  },
  {
    id: "spa",
    name: { en: "Spa weekday promotion", bn: "কর্মদিবসে স্পা প্রচারণা" },
    channel: "webchat",
    state: "done",
    hue: "teal",
    sent: 1900,
    opened: 0.44,
    booked: 0.06,
  },
]
export function buildCampaigns(): Campaign[] {
  return CAMPAIGNS.map((campaign) => ({ ...campaign }))
}

const INTEGRATIONS: Integration[] = [
  {
    id: "bkash",
    name: "bKash",
    category: { en: "Payments", bn: "পেমেন্ট" },
    hue: "magenta",
    connected: true,
    detail: { en: "Mobile wallet collection", bn: "মোবাইল ওয়ালেট সংগ্রহ" },
  },
  {
    id: "nagad",
    name: "Nagad",
    category: { en: "Payments", bn: "পেমেন্ট" },
    hue: "amber",
    connected: true,
    detail: { en: "Mobile wallet collection", bn: "মোবাইল ওয়ালেট সংগ্রহ" },
  },
  {
    id: "stripe",
    name: "Stripe",
    category: { en: "Payments", bn: "পেমেন্ট" },
    hue: "purple",
    connected: true,
    detail: { en: "Card processing", bn: "কার্ড প্রক্রিয়াকরণ" },
  },
  {
    id: "twilio",
    name: "Twilio",
    category: { en: "Messaging", bn: "বার্তা" },
    hue: "rose",
    connected: true,
    detail: { en: "SMS and voice trunk", bn: "এসএমএস ও ভয়েস" },
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: { en: "Messaging", bn: "বার্তা" },
    hue: "green",
    connected: true,
    detail: { en: "Cloud API", bn: "ক্লাউড এপিআই" },
  },
  {
    id: "meta",
    name: "Meta Business",
    category: { en: "Messaging", bn: "বার্তা" },
    hue: "blue",
    connected: true,
    detail: { en: "Messenger and Instagram", bn: "মেসেঞ্জার ও ইনস্টাগ্রাম" },
  },
  {
    id: "booking",
    name: "Booking.com",
    category: { en: "Distribution", bn: "বিতরণ" },
    hue: "blue",
    connected: true,
    detail: { en: "Two-way inventory sync", bn: "দ্বিমুখী ইনভেন্টরি সিঙ্ক" },
  },
  {
    id: "agoda",
    name: "Agoda",
    category: { en: "Distribution", bn: "বিতরণ" },
    hue: "magenta",
    connected: true,
    detail: { en: "Two-way inventory sync", bn: "দ্বিমুখী ইনভেন্টরি সিঙ্ক" },
  },
  {
    id: "sabre",
    name: "Sabre GDS",
    category: { en: "Distribution", bn: "বিতরণ" },
    hue: "slate",
    connected: false,
    detail: { en: "Corporate travel distribution", bn: "কর্পোরেট ভ্রমণ বিতরণ" },
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: { en: "Accounting", bn: "হিসাবরক্ষণ" },
    hue: "teal",
    connected: false,
    detail: { en: "Ledger export", bn: "খতিয়ান রপ্তানি" },
  },
  {
    id: "onelogin",
    name: "OneLogin SSO",
    category: { en: "Security", bn: "নিরাপত্তা" },
    hue: "purple",
    connected: true,
    detail: { en: "SAML single sign-on", bn: "সামল সিঙ্গেল সাইন-অন" },
  },
  {
    id: "hikvision",
    name: "Hikvision",
    category: { en: "Security", bn: "নিরাপত্তা" },
    hue: "amber",
    connected: false,
    detail: { en: "Door locks and CCTV", bn: "দরজার তালা ও সিসিটিভি" },
  },
]
export function buildIntegrations(): Integration[] {
  return INTEGRATIONS.map((integration) => ({ ...integration }))
}

/** Connectors not set up yet, offered by Integrations → Add. */
export const INTEGRATION_CATALOG: Omit<Integration, "connected">[] = [
  {
    id: "sslcommerz",
    name: "SSLCommerz",
    category: { en: "Payments", bn: "পেমেন্ট" },
    hue: "teal",
    detail: {
      en: "Local cards, internet banking and wallets",
      bn: "দেশীয় কার্ড, ইন্টারনেট ব্যাংকিং ও ওয়ালেট",
    },
  },
  {
    id: "expedia",
    name: "Expedia",
    category: { en: "Distribution", bn: "বিতরণ" },
    hue: "amber",
    detail: { en: "Two-way inventory sync", bn: "দ্বিমুখী ইনভেন্টরি সিঙ্ক" },
  },
  {
    id: "airbnb",
    name: "Airbnb",
    category: { en: "Distribution", bn: "বিতরণ" },
    hue: "rose",
    detail: {
      en: "Listing and calendar sync",
      bn: "লিস্টিং ও ক্যালেন্ডার সিঙ্ক",
    },
  },
  {
    id: "googleHotels",
    name: "Google Hotel Ads",
    category: { en: "Distribution", bn: "বিতরণ" },
    hue: "blue",
    detail: {
      en: "Free booking links and metasearch",
      bn: "বিনামূল্যে বুকিং লিংক ও মেটাসার্চ",
    },
  },
  {
    id: "xero",
    name: "Xero",
    category: { en: "Accounting", bn: "হিসাবরক্ষণ" },
    hue: "blue",
    detail: { en: "Ledger and invoice export", bn: "খতিয়ান ও চালান রপ্তানি" },
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: { en: "Marketing", bn: "বিপণন" },
    hue: "amber",
    detail: {
      en: "Email campaigns and audiences",
      bn: "ইমেইল প্রচারণা ও অডিয়েন্স",
    },
  },
  {
    id: "tripadvisor",
    name: "Tripadvisor",
    category: { en: "Reviews", bn: "রিভিউ" },
    hue: "green",
    detail: { en: "Review sync and replies", bn: "রিভিউ সিঙ্ক ও উত্তর" },
  },
  {
    id: "salto",
    name: "Salto KS",
    category: { en: "Security", bn: "নিরাপত্তা" },
    hue: "slate",
    detail: { en: "Keyless room access", bn: "চাবিবিহীন কক্ষে প্রবেশ" },
  },
]

/** Roles in the order the users list has always cycled through them. */
const ROLE_CYCLE: UserRole[] = [
  "owner",
  "gm",
  "frontOffice",
  "housekeeping",
  "finance",
  "readonly",
]

/** The first 22 staff members hold app logins. */
export function buildUsers(staff: StaffMember[]): AppUser[] {
  return staff.slice(0, 22).map((member, index) => ({
    id: `user_${index + 1}`,
    name: member.name,
    email: member.email,
    avatarSeed: member.avatarSeed,
    role: ROLE_CYCLE[index % ROLE_CYCLE.length],
    status: index % 9 === 4 ? "disabled" : "enabled",
    department: member.department,
    lastSeenAt: new Date(demoNow() - index * 7 * 3_600_000).toISOString(),
  }))
}

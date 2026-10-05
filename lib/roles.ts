import type { Bilingual, TagHue, UserRole } from "@/lib/types"

/** App roles, in the order the roles matrix lists them. */
export const USER_ROLES: { id: UserRole; name: Bilingual; hue: TagHue }[] = [
  { id: "owner", name: { en: "Owner", bn: "স্বত্বাধিকারী" }, hue: "purple" },
  {
    id: "gm",
    name: { en: "General Manager", bn: "মহাব্যবস্থাপক" },
    hue: "blue",
  },
  {
    id: "frontOffice",
    name: { en: "Front Office", bn: "ফ্রন্ট অফিস" },
    hue: "teal",
  },
  {
    id: "housekeeping",
    name: { en: "Housekeeping", bn: "হাউসকিপিং" },
    hue: "amber",
  },
  { id: "finance", name: { en: "Finance", bn: "অর্থ" }, hue: "green" },
  { id: "readonly", name: { en: "Read-only", bn: "শুধু পাঠ" }, hue: "slate" },
]

export const ROLE_BY_ID = new Map(USER_ROLES.map((role) => [role.id, role]))

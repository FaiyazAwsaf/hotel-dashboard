"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Users } from "lucide-react"

import { InviteUserButton } from "@/components/admin/forms"
import { Avatar } from "@/components/motion/avatar-stack"
import { DataTable, TableSearch } from "@/components/motion/data-table"
import { PageHeader } from "@/components/motion/card-shell"
import { StatusTag } from "@/components/motion/status-tag"
import { useDataset } from "@/lib/data"
import { useLocale } from "@/lib/i18n/provider"
import { ROLE_BY_ID } from "@/lib/roles"
import type { AppUser, TagHue, UserStatus } from "@/lib/types"

const STATUS_HUE: Record<UserStatus, TagHue> = {
  enabled: "green",
  disabled: "slate",
  invited: "amber",
}

const STATUS_KEY = {
  enabled: "common.enabled",
  disabled: "common.disabled",
  invited: "admin.invited",
} as const

export default function UsersPage() {
  const data = useDataset()
  const { t, locale, num, relative } = useLocale()
  const [query, setQuery] = React.useState("")

  const users = data.users

  const columns = React.useMemo<ColumnDef<AppUser, unknown>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name[locale],
        header: t("common.name"),
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Avatar
              name={row.original.name[locale]}
              seed={row.original.avatarSeed}
              size={24}
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {row.original.name[locale]}
              </span>
              <span className="block truncate text-[0.625rem] text-muted-foreground">
                {row.original.email}
              </span>
            </span>
          </span>
        ),
      },
      {
        id: "role",
        accessorFn: (row) => ROLE_BY_ID.get(row.role)?.name[locale] ?? "",
        header: t("staff.role"),
        cell: ({ row }) => {
          const role = ROLE_BY_ID.get(row.original.role)
          return role ? (
            <StatusTag hue={role.hue}>{role.name[locale]}</StatusTag>
          ) : null
        },
      },
      {
        id: "department",
        accessorFn: (row) =>
          row.department
            ? t(`staff.departments.${row.department}` as never)
            : "",
        header: t("staff.department"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.department
              ? t(`staff.departments.${row.original.department}` as never)
              : "—"}
          </span>
        ),
      },
      {
        id: "lastSeen",
        accessorFn: (row) => row.lastSeenAt ?? "",
        header: t("admin.lastSeen"),
        meta: { align: "right", export: false },
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.lastSeenAt ? relative(row.original.lastSeenAt) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        meta: {
          align: "right",
          exportValue: (row) => t(STATUS_KEY[row.status]),
        },
        cell: ({ row }) => (
          <StatusTag hue={STATUS_HUE[row.original.status]} dot>
            {t(STATUS_KEY[row.original.status])}
          </StatusTag>
        ),
      },
    ],
    [locale, t, relative]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("admin.users")}
        subtitle={`${num(users.length)} ${t("admin.users").toLowerCase()}`}
      >
        <InviteUserButton />
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
        <DataTable
          data={users}
          columns={columns}
          globalFilter={query}
          onGlobalFilterChange={setQuery}
          rowId={(row) => row.id}
          selectable
          exportName="users"
          emptyIcon={<Users />}
          className="min-h-0 flex-1"
          toolbar={
            <TableSearch
              value={query}
              onChange={setQuery}
              className="ml-auto"
            />
          }
        />
      </div>
    </div>
  )
}

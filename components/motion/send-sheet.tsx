"use client"

import * as React from "react"
import { Paperclip } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  FormSheet,
  FormSheetField,
  FormSheetSelect,
  type FormErrors,
  type FormValues,
} from "@/components/motion/form-sheet"
import { useLocale } from "@/lib/i18n/provider"
import { isEmail, isPhone } from "@/lib/validate"

type Channel = "email" | "whatsapp"

/** How long the pretend send takes, so it reads as a send rather than a no-op. */
const SEND_MS = 900

/**
 * "Share": send a document by email or WhatsApp. Nothing leaves the browser —
 * there is no mail server — so the send is simulated with a short progress
 * toast and a confirmation naming the recipient.
 *
 * `children` go above the standard fields, e.g. a picker for which invoice to
 * send. When they change what is being sent, change `resetKey` too, so the
 * recipient and message refill for the new document.
 */
export function SendSheet({
  open,
  onOpenChange,
  title,
  description,
  attachment,
  recipient,
  subject,
  message,
  sentMessage,
  resetKey = "",
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** The file that goes with the message, e.g. `INV-2026-2003.pdf`. */
  attachment?: string
  /** Prefilled addresses, by channel. */
  recipient?: { email?: string; phone?: string }
  subject?: string
  message?: string
  /** The confirmation once sent, e.g. "Invoice INV-… sent to …". */
  sentMessage: (to: string) => string
  resetKey?: string
  /** Checks the `children` fields; return errors to keep the sheet open. */
  onSubmit?: (values: FormValues) => FormErrors | void
  children?: React.ReactNode
}) {
  const { t } = useLocale()
  const [channel, setChannel] = React.useState<Channel>("email")

  const changeOpen = (next: boolean) => {
    if (!next) setChannel("email")
    onOpenChange(next)
  }

  const submit = (values: FormValues) => {
    const errors = onSubmit?.(values)
    if (errors && Object.keys(errors).length > 0) return errors

    const to = values.recipient
    if (channel === "email" && !isEmail(to)) {
      return { recipient: t("share.emailInvalid") }
    }
    if (channel === "whatsapp" && !isPhone(to)) {
      return { recipient: t("share.phoneInvalid") }
    }

    toast.promise(new Promise((resolve) => setTimeout(resolve, SEND_MS)), {
      loading: t("share.sending"),
      success: sentMessage(to),
    })
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={changeOpen}
      title={title}
      description={description}
      submitLabel={t("share.send")}
      onSubmit={submit}
    >
      {children}
      <FormSheetField name="channel" label={t("share.sendBy")} required>
        {(field, controls) => (
          <FormSheetSelect
            field={field}
            controls={controls}
            items={{
              email: t("inbox.channels.email"),
              whatsapp: t("inbox.channels.whatsapp"),
            }}
            defaultValue="email"
            onChange={(value) => setChannel(value as Channel)}
          />
        )}
      </FormSheetField>
      <FormSheetField
        // A new channel or document starts from its own prefilled address.
        key={`recipient-${channel}-${resetKey}`}
        name="recipient"
        label={channel === "email" ? t("share.emailTo") : t("share.whatsappTo")}
        required
      >
        {(field) => (
          <Input
            {...field}
            type={channel === "email" ? "email" : "tel"}
            defaultValue={
              channel === "email" ? recipient?.email : recipient?.phone
            }
            placeholder={
              channel === "email" ? "name@example.com" : "+880 1XXX-XXXXXX"
            }
            autoComplete="off"
          />
        )}
      </FormSheetField>
      {channel === "email" ? (
        <FormSheetField
          key={`subject-${resetKey}`}
          name="subject"
          label={t("share.subject")}
        >
          {(field) => (
            <Input {...field} defaultValue={subject} autoComplete="off" />
          )}
        </FormSheetField>
      ) : null}
      <FormSheetField
        key={`message-${resetKey}`}
        name="message"
        label={t("share.message")}
      >
        {(field) => (
          <Textarea {...field} defaultValue={message} className="min-h-32" />
        )}
      </FormSheetField>
      {attachment ? (
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[0.6875rem]">
          <Paperclip className="size-3.5 text-muted-foreground" />
          <span className="nums min-w-0 flex-1 truncate font-medium">
            {attachment}
          </span>
          <span className="text-[0.625rem] text-muted-foreground">PDF</span>
        </div>
      ) : null}
    </FormSheet>
  )
}

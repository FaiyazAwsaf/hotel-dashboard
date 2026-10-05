"use client"

import * as React from "react"
import { CalendarDays, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { addMonths, CalendarMonth } from "@/components/motion/calendar-month"
import { cn } from "@/lib/utils"
import { demoToday, isoDay, startOfMonth } from "@/lib/demo-time"
import { useLocale } from "@/lib/i18n/provider"

/**
 * Side-panel form for creating or editing a record.
 *
 * Fields are ordinary form controls with a `name`, wrapped in
 * `FormSheetField`. On submit the values arrive as a trimmed string map,
 * after required fields have been checked. Errors appear under each field in
 * the interface language — the browser's own validation popups are switched
 * off because they ignore the app's language.
 *
 *   <FormSheet open={open} onOpenChange={setOpen} title="Issue pass"
 *     onSubmit={(values) => { add(values.name); }}>
 *     <FormSheetField name="name" label="Name" required>
 *       {(field) => <Input {...field} />}
 *     </FormSheetField>
 *
 * Controls that don't fire DOM change events, like `Select`, clear their
 * error through the second argument:
 *
 *       {(field, { clearError }) => (
 *         <Select name={field.name} onValueChange={clearError}>…</Select>
 *       )}
 *   </FormSheet>
 *
 * The form unmounts when the sheet closes, so every open starts blank.
 */

export type FormValues = Record<string, string>
/** Messages by field name. */
export type FormErrors = Record<string, string>

type FieldInfo = { id: string; required: boolean }

type FormSheetContextValue = {
  errors: FormErrors
  register: (name: string, info: FieldInfo) => () => void
  clearError: (name: string) => void
}

const FormSheetContext = React.createContext<FormSheetContextValue | null>(null)

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel?: string
  /** Return errors to keep the sheet open with them shown; otherwise it closes. */
  onSubmit: (values: FormValues) => FormErrors | void
  children: React.ReactNode
}) {
  const { t } = useLocale()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <div className="flex items-start gap-3 border-b border-[var(--hairline)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <SheetTitle>{title}</SheetTitle>
            {description ? (
              <SheetDescription className="mt-0.5">
                {description}
              </SheetDescription>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label={t("common.close")}
          >
            <X />
          </Button>
        </div>
        <FormBody
          submitLabel={submitLabel ?? t("common.save")}
          onSubmit={onSubmit}
          onClose={() => onOpenChange(false)}
        >
          {children}
        </FormBody>
      </SheetContent>
    </Sheet>
  )
}

function FormBody({
  submitLabel,
  onSubmit,
  onClose,
  children,
}: {
  submitLabel: string
  onSubmit: (values: FormValues) => FormErrors | void
  onClose: () => void
  children: React.ReactNode
}) {
  const { t } = useLocale()
  const [errors, setErrors] = React.useState<FormErrors>({})
  const fields = React.useRef(new Map<string, FieldInfo>())

  // Stable, so fields register once and keep their on-screen order.
  const register = React.useCallback((name: string, info: FieldInfo) => {
    fields.current.set(name, info)
    return () => {
      fields.current.delete(name)
    }
  }, [])

  const clearError = React.useCallback(
    (name: string) =>
      setErrors((current) => {
        if (!(name in current)) return current
        const next = { ...current }
        delete next[name]
        return next
      }),
    []
  )

  const context = React.useMemo<FormSheetContextValue>(
    () => ({ errors, register, clearError }),
    [errors, register, clearError]
  )

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values: FormValues = {}
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") values[name] = value.trim()
    }

    const missing: FormErrors = {}
    for (const [name, field] of fields.current) {
      if (field.required && !values[name]) {
        missing[name] = t("common.fieldRequired")
      }
    }
    const found =
      Object.keys(missing).length > 0 ? missing : (onSubmit(values) ?? {})

    if (Object.keys(found).length === 0) {
      onClose()
      return
    }
    setErrors(found)
    // Fields register in render order, so this is the first one on screen.
    const first = [...fields.current].find(([name]) => name in found)
    if (first) document.getElementById(first[1].id)?.focus()
  }

  return (
    <FormSheetContext.Provider value={context}>
      <form
        noValidate
        onSubmit={submit}
        // Typing into a field clears its error. Controls that don't fire
        // change events call `clearError` from the field render prop.
        onChange={(event) => {
          const target: EventTarget = event.target
          if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement
          ) {
            clearError(target.name)
          }
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <FieldGroup className="gap-3.5">{children}</FieldGroup>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--hairline)] px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" size="sm">
            {submitLabel}
          </Button>
        </div>
      </form>
    </FormSheetContext.Provider>
  )
}

/** Props to spread onto the field's control. */
export type FormFieldProps = {
  id: string
  name: string
  required: boolean
  "aria-invalid": boolean
  "aria-describedby"?: string
}

export type FormFieldControls = {
  /** Clears this field's error — for controls without DOM change events. */
  clearError: () => void
}

export function FormSheetField({
  name,
  label,
  required = false,
  description,
  children,
}: {
  name: string
  label: string
  required?: boolean
  description?: string
  children: (
    field: FormFieldProps,
    controls: FormFieldControls
  ) => React.ReactNode
}) {
  const context = React.useContext(FormSheetContext)
  if (!context) {
    throw new Error("FormSheetField must be used inside <FormSheet>")
  }
  const { errors, register, clearError } = context
  const { t } = useLocale()
  const id = React.useId()
  const error = errors[name]

  React.useEffect(
    () => register(name, { id, required }),
    [register, name, id, required]
  )

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {/* Visual only — the control itself carries required. */}
        {required ? (
          <span
            aria-hidden
            className="text-destructive"
            title={t("common.required")}
          >
            *
          </span>
        ) : null}
      </FieldLabel>
      {children(
        {
          id,
          name,
          required,
          "aria-invalid": Boolean(error),
          "aria-describedby": error ? `${id}-error` : undefined,
        },
        { clearError: () => clearError(name) }
      )}
      {description && !error ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  )
}

/**
 * A select for a `FormSheetField`, with its options as `{ value: label }`:
 *
 *   {(field, controls) => (
 *     <FormSheetSelect field={field} controls={controls} items={GATES} />
 *   )}
 */
export function FormSheetSelect({
  field,
  controls,
  items,
  defaultValue,
  onChange,
}: {
  field: FormFieldProps
  controls: FormFieldControls
  items: Record<string, string>
  defaultValue?: string
  onChange?: (value: string) => void
}) {
  return (
    <Select
      name={field.name}
      items={items}
      defaultValue={defaultValue}
      onValueChange={(value) => {
        controls.clearError()
        if (typeof value === "string") onChange?.(value)
      }}
    >
      <SelectTrigger
        id={field.id}
        aria-required={field.required || undefined}
        aria-invalid={field["aria-invalid"]}
        aria-describedby={field["aria-describedby"]}
        className="w-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * A date for a `FormSheetField`, picked from the app's own calendar so it
 * reads in the interface language. Submits an ISO day (`2026-10-05`).
 *
 *   {(field, controls) => (
 *     <FormSheetDate field={field} controls={controls} min={today} />
 *   )}
 */
export function FormSheetDate({
  field,
  controls,
  defaultValue,
  min,
  max,
}: {
  field: FormFieldProps
  controls: FormFieldControls
  defaultValue?: string
  /** Earliest selectable ISO day. */
  min?: string
  max?: string
}) {
  const { t, date } = useLocale()
  const [value, setValue] = React.useState(defaultValue ?? "")
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState(() =>
    startOfMonth(new Date(value || min || isoDay(demoToday())))
  )

  return (
    <>
      <input type="hidden" name={field.name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={field.id}
          aria-required={field.required || undefined}
          aria-invalid={field["aria-invalid"]}
          aria-describedby={field["aria-describedby"]}
          className={cn(
            "flex h-7 w-full items-center gap-1.5 rounded-md border border-input bg-input/20 px-2 text-left text-xs/relaxed transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:hover:bg-input/50",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="nums truncate">
            {value
              ? date(value, { day: "numeric", month: "long", year: "numeric" })
              : t("forms.pickDate")}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <CalendarMonth
            month={month}
            range={{ from: value || undefined }}
            min={min}
            max={max}
            groupId={field.id}
            onPrev={() => setMonth(addMonths(month, -1))}
            onNext={() => setMonth(addMonths(month, 1))}
            onSelect={(day) => {
              setValue(isoDay(day))
              setOpen(false)
              controls.clearError()
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}

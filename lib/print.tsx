"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { useTenant } from "@/lib/data"
import { demoNow } from "@/lib/demo-time"
import { useLocale } from "@/lib/i18n/provider"

/**
 * Printing, including the browser's "Save as PDF".
 *
 * The app shell is a fixed-height frame that hides overflow, so printing the
 * page itself cuts content off at the edge of the screen. Instead, the
 * document to print is rendered into a hidden iframe that carries the app's
 * stylesheets and fonts but not its theme class, and the iframe is printed.
 * Print output is therefore always the light theme at 100% scale, and the
 * screen never changes while the dialog is open.
 *
 * The content is portalled from inside the provider, so it can use every app
 * hook (`useDataset`, `useLocale`, …). Keep it static: entry animations
 * would print at their starting frame.
 */

export type PrintOptions = {
  /** Document title; browsers use it as the suggested "Save as PDF" name. */
  title?: string
  /** CSS `@page` size, e.g. `"A4"` or `"85.6mm 54mm"`. Defaults to the printer's. */
  size?: string
  /** CSS `@page` margin. */
  margin?: string
}

type PrintJob = PrintOptions & {
  id: number
  content: React.ReactNode
  /** Where focus was, to hand it back once the dialog closes. */
  returnFocus: Element | null
}

type Print = (content: React.ReactNode, options?: PrintOptions) => void

const PrintContext = React.createContext<Print | null>(null)

const BLANK_DOCUMENT =
  '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'

export function PrintProvider({ children }: { children: React.ReactNode }) {
  const [job, setJob] = React.useState<PrintJob | null>(null)
  const [mount, setMount] = React.useState<HTMLElement | null>(null)
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const jobCount = React.useRef(0)

  const print = React.useCallback<Print>((content, options = {}) => {
    jobCount.current += 1
    setMount(null)
    setJob({
      ...options,
      content,
      id: jobCount.current,
      returnFocus: document.activeElement,
    })
  }, [])

  /** Dresses the blank iframe in the app's styles once it has loaded. */
  const prepareFrame = React.useCallback(() => {
    const doc = frameRef.current?.contentDocument
    if (!doc || !job) return
    const source = document.documentElement
    const html = doc.documentElement

    html.lang = source.lang
    // The font variables live as classes on the app's <html>. The theme class
    // stays behind, so print is always the light theme.
    html.className = [...source.classList]
      .filter((name) => name !== "dark")
      .join(" ")
    html.style.setProperty("--ui-scale", "1")
    html.style.colorScheme = "light"

    for (const node of document.querySelectorAll<HTMLElement>(
      'link[rel="stylesheet"], style'
    )) {
      const copy = node.cloneNode(true) as HTMLElement
      // Resolve relative hrefs against the app, not about:srcdoc.
      if (copy instanceof HTMLLinkElement && node instanceof HTMLLinkElement) {
        copy.href = node.href
      }
      doc.head.appendChild(copy)
    }

    const page = doc.createElement("style")
    page.textContent = [
      `@page { ${job.size ? `size: ${job.size};` : ""} margin: ${job.margin ?? "12mm"}; }`,
      "html, body { background: #fff; }",
      "body { margin: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }",
    ].join("\n")
    doc.head.appendChild(page)
    doc.title = job.title ?? document.title

    setMount(doc.body)
  }, [job])

  React.useEffect(() => {
    const frame = frameRef.current
    const win = frame?.contentWindow
    const doc = frame?.contentDocument
    if (!job || !mount || !win || !doc) return

    let cancelled = false
    const previousTitle = document.title

    const finish = () => {
      document.title = previousTitle
      // Printing focused the frame, which is about to go; without this the
      // page ignores the keyboard (⌘K, Escape) until the next click.
      window.focus()
      if (job.returnFocus instanceof HTMLElement) {
        job.returnFocus.focus({ preventScroll: true })
      }
      // Let the browser finish with the frame before it is removed.
      setTimeout(() => {
        setJob((current) => (current?.id === job.id ? null : current))
      }, 0)
    }

    const run = async () => {
      const sheets = [
        ...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      ]
      await Promise.all(
        sheets.map((link) =>
          link.sheet
            ? null
            : new Promise((resolve) => {
                link.addEventListener("load", resolve, { once: true })
                link.addEventListener("error", resolve, { once: true })
              })
        )
      )
      // Lay out once so the fonts the content uses start loading, then wait
      // for them — otherwise Bangla can print in a fallback face.
      await new Promise((resolve) => win.requestAnimationFrame(resolve))
      await doc.fonts.ready
      if (cancelled) return

      // Some browsers name the PDF after the top document, some after the frame.
      if (job.title) document.title = job.title
      win.addEventListener("afterprint", finish, { once: true })
      win.focus()
      win.print()
    }

    void run()
    return () => {
      cancelled = true
      win.removeEventListener("afterprint", finish)
      document.title = previousTitle
    }
  }, [job, mount])

  return (
    <PrintContext.Provider value={print}>
      {children}
      {job ? (
        <iframe
          key={job.id}
          ref={frameRef}
          title={job.title ?? "print"}
          aria-hidden
          tabIndex={-1}
          srcDoc={BLANK_DOCUMENT}
          onLoad={prepareFrame}
          className="pointer-events-none fixed right-0 bottom-0 size-0 border-0 opacity-0"
        />
      ) : null}
      {job && mount ? createPortal(job.content, mount) : null}
    </PrintContext.Provider>
  )
}

/** `const print = usePrint(); print(<Statement />, { title: "Folio F-7012" })` */
export function usePrint() {
  const print = React.useContext(PrintContext)
  if (!print) throw new Error("usePrint must be used inside <PrintProvider>")
  return print
}

/**
 * Standard letterhead for printed documents: the property, the document
 * title and reference, the content, and a printed-on footer.
 */
export function PrintDocument({
  title,
  reference,
  children,
}: {
  title: string
  reference?: string
  children: React.ReactNode
}) {
  const tenant = useTenant()
  const { t, locale, dateTime } = useLocale()

  return (
    <article className="flex min-h-full flex-col gap-6 bg-white p-2 text-[0.75rem] text-neutral-900">
      <header className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-neutral-900 text-[0.75rem] font-semibold text-white">
            {tenant.initials}
          </span>
          <div>
            <div className="text-[0.875rem] font-semibold">
              {tenant.name[locale]}
            </div>
            <div className="text-neutral-500">
              {tenant.city[locale]} · {tenant.country[locale]}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[1rem] font-semibold">{title}</div>
          {reference ? (
            <div className="font-mono text-neutral-500">{reference}</div>
          ) : null}
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="flex justify-between border-t border-neutral-300 pt-3 text-[0.625rem] text-neutral-500">
        <span>
          {t("brand.name")} · {t("brand.ownedBy")}
        </span>
        <span>{t("common.printedOn", { date: dateTime(demoNow()) })}</span>
      </footer>
    </article>
  )
}

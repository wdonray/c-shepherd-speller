'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border px-4 py-2 text-[15px] font-medium text-ink hover:bg-muted"
    >
      Print this worksheet
    </button>
  )
}

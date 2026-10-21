/**
 * Presentational "unsaved" markers for form fields on the list editor page
 * (issue #509). The marker is purely visual: a `data-unsaved="true"`
 * attribute that the stylesheet turns into a high-contrast ring. It never
 * participates in layout (the CSS uses `outline`, which paints outside the
 * border box), satisfying the standing rule that status indicators must
 * never shift layout.
 *
 * Marking is driven by blur events in ListEditorPage: a field gets marked
 * when it loses focus with a changed value while the form still has unsaved
 * changes. Marks clear when a save confirms. This module holds no React
 * state so it stays unit-testable in isolation.
 */

/** Attribute contract with the stylesheet. */
export const UNSAVED_FIELD_ATTRIBUTE = 'data-unsaved'

/**
 * Read the comparable value of a form field: `value` for text inputs,
 * textareas and selects, the checked state for checkboxes and radios.
 * Returns null for elements that are not fields (so callers skip them).
 */
export function fieldSnapshotValue(element: Element): string | null {
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      return element.checked ? 'checked' : 'unchecked'
    }
    return element.value
  }
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value
  }
  return null
}

/** True when the element currently carries the unsaved marker. */
export function isFieldMarkedUnsaved(element: Element): boolean {
  return element.getAttribute(UNSAVED_FIELD_ATTRIBUTE) === 'true'
}

/** Paint the unsaved ring on a field. Idempotent. */
export function markFieldUnsaved(element: Element): void {
  element.setAttribute(UNSAVED_FIELD_ATTRIBUTE, 'true')
}

/** Remove the unsaved ring from a field. */
export function unmarkFieldUnsaved(element: Element): void {
  element.removeAttribute(UNSAVED_FIELD_ATTRIBUTE)
}

/** Remove every unsaved marker under a root (called when a save confirms). */
export function clearUnsavedFieldMarks(root: ParentNode): void {
  for (const el of root.querySelectorAll(`[${UNSAVED_FIELD_ATTRIBUTE}="true"]`)) {
    el.removeAttribute(UNSAVED_FIELD_ATTRIBUTE)
  }
}

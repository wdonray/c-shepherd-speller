import { describe, expect, it } from 'vitest'
import {
  UNSAVED_FIELD_ATTRIBUTE,
  clearUnsavedFieldMarks,
  fieldSnapshotValue,
  isFieldMarkedUnsaved,
  markFieldUnsaved,
  unmarkFieldUnsaved,
} from './unsaved-field-marker'

describe('fieldSnapshotValue', () => {
  it('reads the value of a text input', () => {
    const input = document.createElement('input')
    input.value = 'hello'
    expect(fieldSnapshotValue(input)).toBe('hello')
  })

  it('reads the value of a textarea', () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'some rule'
    expect(fieldSnapshotValue(textarea)).toBe('some rule')
  })

  it('reads the selected value of a select', () => {
    const select = document.createElement('select')
    const option = document.createElement('option')
    option.value = 'common'
    option.selected = true
    select.appendChild(option)
    expect(fieldSnapshotValue(select)).toBe('common')
  })

  it('reads the checked state of a checkbox', () => {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    expect(fieldSnapshotValue(checkbox)).toBe('unchecked')
    checkbox.checked = true
    expect(fieldSnapshotValue(checkbox)).toBe('checked')
  })

  it('reads the checked state of a radio', () => {
    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.checked = true
    expect(fieldSnapshotValue(radio)).toBe('checked')
  })

  it('returns null for non-field elements', () => {
    expect(fieldSnapshotValue(document.createElement('div'))).toBeNull()
    expect(fieldSnapshotValue(document.createElement('button'))).toBeNull()
    expect(fieldSnapshotValue(document.createElement('span'))).toBeNull()
  })
})

describe('mark / unmark / isFieldMarkedUnsaved', () => {
  it('marks a field and reports it', () => {
    const input = document.createElement('input')
    expect(isFieldMarkedUnsaved(input)).toBe(false)
    markFieldUnsaved(input)
    expect(isFieldMarkedUnsaved(input)).toBe(true)
    expect(input.getAttribute(UNSAVED_FIELD_ATTRIBUTE)).toBe('true')
  })

  it('marking twice stays marked', () => {
    const input = document.createElement('input')
    markFieldUnsaved(input)
    markFieldUnsaved(input)
    expect(isFieldMarkedUnsaved(input)).toBe(true)
  })

  it('unmarks a field', () => {
    const input = document.createElement('input')
    markFieldUnsaved(input)
    unmarkFieldUnsaved(input)
    expect(isFieldMarkedUnsaved(input)).toBe(false)
    expect(input.hasAttribute(UNSAVED_FIELD_ATTRIBUTE)).toBe(false)
  })

  it('unmarking an unmarked field is a no-op', () => {
    const input = document.createElement('input')
    unmarkFieldUnsaved(input)
    expect(isFieldMarkedUnsaved(input)).toBe(false)
  })
})

describe('clearUnsavedFieldMarks', () => {
  it('clears every mark under the root and leaves other attributes alone', () => {
    const root = document.createElement('div')
    const marked = document.createElement('input')
    marked.id = 'list-name'
    markFieldUnsaved(marked)
    const unmarked = document.createElement('input')
    unmarked.setAttribute('placeholder', 'e.g. 1')
    root.append(marked, unmarked)

    clearUnsavedFieldMarks(root)

    expect(isFieldMarkedUnsaved(marked)).toBe(false)
    expect(unmarked.getAttribute('placeholder')).toBe('e.g. 1')
  })

  it('does not touch marks outside the root', () => {
    const root = document.createElement('div')
    const outside = document.createElement('input')
    markFieldUnsaved(outside)

    clearUnsavedFieldMarks(root)

    expect(isFieldMarkedUnsaved(outside)).toBe(true)
  })

  it('is a no-op when nothing is marked', () => {
    const root = document.createElement('div')
    root.appendChild(document.createElement('input'))
    expect(() => clearUnsavedFieldMarks(root)).not.toThrow()
  })
})

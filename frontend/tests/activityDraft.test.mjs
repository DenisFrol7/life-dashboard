import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActivityDraft } from '../src/utils/activityDraft.ts'

test('a successful save clears the dirty state only for the submitted draft', () => {
  const draft = createActivityDraft('2026-11-07')
  draft.edit()
  const submitted = draft.snapshot()
  assert.equal(draft.hasChanges, true)
  assert.equal(draft.accept(submitted), true)
  assert.equal(draft.hasChanges, false)
})

test('typing while a save is pending keeps newer fields protected from a server refresh', () => {
  const draft = createActivityDraft('2026-11-07')
  draft.edit()
  const submitted = draft.snapshot()
  draft.edit()
  assert.equal(draft.accept(submitted), false)
  draft.selectDate('2026-11-07')
  assert.equal(draft.hasChanges, true)
  assert.equal(draft.isCurrent(submitted), false)
})

test('a save for a previous date cannot accept or report errors against the new draft', () => {
  const draft = createActivityDraft('2026-11-06')
  draft.edit()
  const submitted = draft.snapshot()
  draft.selectDate('2026-11-07')
  draft.edit()
  assert.equal(draft.accept(submitted), false)
  assert.equal(draft.isCurrent(submitted), false)
  assert.equal(draft.snapshot().date, '2026-11-07')
  assert.equal(draft.hasChanges, true)
})

test('returning to the submitted date does not revive its old result even without new edits', () => {
  const draft = createActivityDraft('2026-11-06')
  const submitted = draft.snapshot()
  draft.selectDate('2026-11-07')
  draft.selectDate('2026-11-06')
  assert.equal(draft.accept(submitted), false)
  assert.equal(draft.isCurrent(submitted), false)
})

test('refreshing the same date preserves an unsaved draft and its revision', () => {
  const draft = createActivityDraft('2026-11-07')
  draft.edit()
  const submitted = draft.snapshot()
  draft.selectDate('2026-11-07')
  assert.deepEqual(draft.snapshot(), submitted)
  assert.equal(draft.hasChanges, true)
})

test('new edits after an accepted save remain protected while its refresh is pending', () => {
  const draft = createActivityDraft('2026-11-07')
  draft.edit()
  const submitted = draft.snapshot()
  assert.equal(draft.accept(submitted), true)
  draft.edit()
  draft.selectDate('2026-11-07')
  assert.equal(draft.hasChanges, true)
  assert.equal(draft.accept(submitted), false)
})

test('deleting the submitted day cannot clear a draft entered while deletion was pending', () => {
  const draft = createActivityDraft('2026-11-06')
  const deletion = draft.snapshot()
  draft.edit()
  assert.equal(draft.accept(deletion), false)
  assert.equal(draft.hasChanges, true)
  draft.selectDate('2026-11-07')
  assert.equal(draft.hasChanges, false)
  assert.equal(draft.isCurrent(deletion), false)
})

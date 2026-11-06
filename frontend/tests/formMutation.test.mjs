import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFormMutation } from '../src/utils/formMutation.ts'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function callbacks() {
  const events = []
  return {
    events,
    onStart: () => events.push('start'),
    onSuccess: value => events.push(['success', value]),
    onError: error => events.push(['error', error.message]),
    onFinish: () => events.push('finish'),
  }
}

test('double submit is locked before React can render a disabled button', async () => {
  const mutation = createFormMutation(), response = deferred(), view = callbacks()
  let writes = 0
  const save = () => { writes++; return response.promise }
  const first = mutation.run(save, view)
  await mutation.run(save, view)
  assert.equal(writes, 1)
  assert.deepEqual(view.events, ['start'])
  response.resolve(42)
  await first
  assert.deepEqual(view.events, ['start', ['success', 42], 'finish'])
})

for (const [firstAction, secondAction] of [['save', 'delete'], ['delete', 'save']]) {
  test(`${firstAction} blocks ${secondAction}, including its confirmation, until the operation finishes`, async () => {
    const mutation = createFormMutation(), response = deferred()
    const actions = []
    const first = mutation.run(() => { actions.push(firstAction); return response.promise }, callbacks())
    await mutation.run(async () => { actions.push(secondAction); return true }, callbacks())
    assert.deepEqual(actions, [firstAction])
    response.resolve(true)
    await first
    await mutation.run(async () => { actions.push(secondAction); return true }, callbacks())
    assert.deepEqual(actions, [firstAction, secondAction])
  })
}

test('closing an old form cannot close a newly opened form or show an old success message', async () => {
  const old = createFormMutation(), fresh = createFormMutation(), response = deferred()
  let openForm = 'old', toasts = 0, finishes = 0
  const oldSave = old.run(() => response.promise, {
    onSuccess: () => { openForm = null; toasts++ },
    onError: () => assert.fail('Unexpected failure'),
    onFinish: () => finishes++,
  })
  old.dispose()
  openForm = 'new'
  response.resolve(1)
  await oldSave
  assert.equal(openForm, 'new')
  assert.equal(toasts, 0)
  assert.equal(finishes, 0)
  await fresh.run(async () => 2, { onSuccess: () => { openForm = null }, onError: assert.fail })
  assert.equal(openForm, null)
})

test('a late failure after closing does not update errors or the loading state', async () => {
  const mutation = createFormMutation(), response = deferred(), view = callbacks()
  const save = mutation.run(() => response.promise, view)
  mutation.dispose()
  response.reject(new Error('Late server error'))
  await save
  assert.deepEqual(view.events, ['start'])
})

test('closing suppresses UI callbacks while allowing every step of the initiated write to finish', async () => {
  const mutation = createFormMutation(), response = deferred(), view = callbacks()
  const writes = []
  const save = mutation.run(async () => {
    writes.push('save item')
    const item = await response.promise
    writes.push(`save library for ${item.id}`)
    writes.push('save profile and progress')
    return item
  }, view)
  mutation.dispose()
  response.resolve({ id: 12 })
  await save
  assert.deepEqual(writes, ['save item', 'save library for 12', 'save profile and progress'])
  assert.deepEqual(view.events, ['start'])
})

test('a current failure is shown and releases the lock for a retry', async () => {
  const mutation = createFormMutation(), view = callbacks()
  await mutation.run(async () => { throw new Error('Save failed') }, view)
  await mutation.run(async () => 'retry saved', view)
  assert.deepEqual(view.events, ['start', ['error', 'Save failed'], 'finish', 'start', ['success', 'retry saved'], 'finish'])
})

test('cancelled deletion releases the lock and does not run its success action', async () => {
  const mutation = createFormMutation()
  let writes = 0, deleted = 0
  await mutation.run(async () => false, {
    onSuccess: confirmed => { if (confirmed) deleted++ }, onError: assert.fail,
  })
  await mutation.run(async () => { writes++; return true }, { onSuccess: () => {}, onError: assert.fail })
  assert.equal(deleted, 0)
  assert.equal(writes, 1)
})

test('effect reactivation does not revive old callbacks or allow overlapping writes', async () => {
  const mutation = createFormMutation(), response = deferred(), view = callbacks()
  const save = mutation.run(() => response.promise, view)
  mutation.dispose()
  mutation.activate()
  let writes = 0
  await mutation.run(async () => writes++, view)
  assert.equal(writes, 0)
  response.resolve(true)
  await save
  assert.deepEqual(view.events, ['start'])
  await mutation.run(async () => writes++, view)
  assert.equal(writes, 1)
})

test('a synchronous failure releases the lock; a disposed form starts no writes', async () => {
  const mutation = createFormMutation(), view = callbacks()
  await mutation.run(() => { throw new Error('Synchronous error') }, view)
  assert.deepEqual(view.events, ['start', ['error', 'Synchronous error'], 'finish'])
  mutation.dispose()
  await mutation.run(() => assert.fail('Write after disposal'), view)
  assert.equal(view.events.length, 3)
})

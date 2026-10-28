import assert from 'node:assert/strict'
import { test } from 'node:test'
import { saveLibraryForm } from '../src/pages/libraryForm.ts'

function form(overrides = {}) {
  const calls = []
  const saved = { id: 42, title: 'Updated title' }
  return {
    calls,
    saved,
    options: {
      title: 'Original title',
      inLibrary: false,
      wasInLibrary: true,
      saveItem: async () => { calls.push('save'); return saved },
      putLibrary: async (id) => { calls.push(['put', id]) },
      removeLibrary: async (id) => { calls.push(['remove', id]) },
      ...overrides,
    },
  }
}

  test('cancelled removal does not save changes or call the library API', async () => {
    const { options, calls } = form()
    const result = await saveLibraryForm(options, (message) => {
      calls.push('confirm')
      assert.ok(message.includes('Original title'))
      assert.ok(message.includes('заметка и даты в библиотеке будут удалены'))
      assert.ok(message.includes('Карточка останется в каталоге'))
      assert.ok(message.includes('История и прогресс сохранятся'))
      return false
    })

    assert.equal(result, null)
    assert.deepEqual(calls, ['confirm'])
  })

  test('confirmed removal saves the item and removes only its library entry', async () => {
    const { options, calls, saved } = form()
    const result = await saveLibraryForm(options, () => { calls.push('confirm'); return true })

    assert.equal(result, saved)
    assert.deepEqual(calls, ['confirm', 'save', ['remove', saved.id]])
  })
for (const wasInLibrary of [false, true]) {
  test(`${wasInLibrary ? 'existing' : 'new'} library entry is saved without a removal confirmation`, async () => {
    const { options, calls, saved } = form({ inLibrary: true, wasInLibrary })
    const result = await saveLibraryForm(options, () => assert.fail('Unexpected confirmation'))

    assert.equal(result, saved)
    assert.deepEqual(calls, ['save', ['put', saved.id]])
  })
}

test('unchecked item outside the library does not send a spurious DELETE request', async () => {
  const { options, calls, saved } = form({ inLibrary: false, wasInLibrary: false })
  assert.equal(await saveLibraryForm(options, () => assert.fail('Unexpected confirmation')), saved)
  assert.deepEqual(calls, ['save'])
})

test('failed item save does not remove personal data', async () => {
  const error = new Error('Save failed')
  const { options, calls } = form({ saveItem: async () => { throw error } })

  await assert.rejects(saveLibraryForm(options, () => true), (reason) => reason === error)
  assert.deepEqual(calls, [])
})

test('failed library removal is reported to the form instead of returning success', async () => {
  const error = new Error('Removal failed')
  const { options, calls } = form({ removeLibrary: async () => { throw error } })

  await assert.rejects(saveLibraryForm(options, () => true), (reason) => reason === error)
  assert.deepEqual(calls, ['save'])
})

test('failed library update is reported to the form instead of returning success', async () => {
  const error = new Error('Library update failed')
  const { options, calls } = form({ inLibrary: true, putLibrary: async () => { throw error } })

  await assert.rejects(saveLibraryForm(options, () => assert.fail('Unexpected confirmation')), (reason) => reason === error)
  assert.deepEqual(calls, ['save'])
})

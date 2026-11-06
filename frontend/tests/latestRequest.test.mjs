import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLatestRequest } from '../src/utils/latestRequest.ts'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function view() {
  const state = { value: null, error: null, loading: false, finishes: 0 }
  return {
    state,
    callbacks: {
      onStart: () => { state.loading = true; state.error = null },
      onSuccess: (value) => { state.value = value },
      onError: (reason) => { state.error = reason.message },
      onFinish: () => { state.loading = false; state.finishes++ },
    },
  }
}

test('an older search cannot overwrite newer results when responses arrive in reverse order', async () => {
  const requests = createLatestRequest()
  const { state, callbacks } = view()
  const old = deferred(), fresh = deferred()
  const first = requests.run(() => old.promise, callbacks)
  const second = requests.run(() => fresh.promise, callbacks)
  fresh.resolve(['new result'])
  await second
  old.resolve(['old result'])
  await first
  assert.deepEqual(state, { value: ['new result'], error: null, loading: false, finishes: 1 })
})

test('a completed older request cannot hide the loading state of the current request', async () => {
  const requests = createLatestRequest()
  const { state, callbacks } = view()
  const old = deferred(), fresh = deferred()
  const first = requests.run(() => old.promise, callbacks)
  const second = requests.run(() => fresh.promise, callbacks)
  old.resolve(['old'])
  await first
  assert.equal(state.loading, true)
  assert.equal(state.value, null)
  assert.equal(state.finishes, 0)
  fresh.resolve([])
  await second
  assert.deepEqual(state.value, [])
  assert.equal(state.loading, false)
})

test('an older error does not replace the successful current result', async () => {
  const requests = createLatestRequest()
  const { state, callbacks } = view()
  const old = deferred()
  const first = requests.run(() => old.promise, callbacks)
  await requests.run(async () => 'selected title', callbacks)
  old.reject(new Error('old timeout'))
  await first
  assert.equal(state.value, 'selected title')
  assert.equal(state.error, null)
  assert.equal(state.finishes, 1)
})

test('the current error is displayed and completes its loading indicator', async () => {
  const requests = createLatestRequest()
  const { state, callbacks } = view()
  await requests.run(async () => { throw new Error('current timeout') }, callbacks)
  assert.equal(state.error, 'current timeout')
  assert.equal(state.loading, false)
  assert.equal(state.finishes, 1)
})

test('editing the query invalidates the response even without starting another search', async () => {
  const requests = createLatestRequest()
  const { state, callbacks } = view()
  const old = deferred()
  const pending = requests.run(() => old.promise, callbacks)
  requests.invalidate()
  state.loading = false
  old.resolve(['result for the previous query'])
  await pending
  assert.equal(state.value, null)
  assert.equal(state.finishes, 0)
})

test('selecting a book invalidates an earlier search without replacing the selected record', async () => {
  const requests = createLatestRequest()
  const { state, callbacks } = view()
  const search = deferred()
  const pending = requests.run(() => search.promise, callbacks)
  requests.invalidate()
  state.value = { title: 'Selected book', coverUrl: 'selected-cover' }
  search.resolve({ title: 'Old book', coverUrl: 'old-cover' })
  await pending
  assert.deepEqual(state.value, { title: 'Selected book', coverUrl: 'selected-cover' })
})

for (const reject of [false, true]) {
  test(`closing a form ignores a late ${reject ? 'failure' : 'success'} and all completion callbacks`, async () => {
    const requests = createLatestRequest()
    const { state, callbacks } = view()
    const result = deferred()
    const pending = requests.run(() => result.promise, callbacks)
    requests.dispose()
    if (reject) result.reject(new Error('too late'))
    else result.resolve('too late')
    await pending
    assert.equal(state.value, null)
    assert.equal(state.error, null)
    assert.equal(state.finishes, 0)
    await requests.run(() => assert.fail('Disposed requests must not start'), callbacks)
  })
}

test('React effect reactivation permits new requests without reviving old ones', async () => {
  const requests = createLatestRequest()
  const { state, callbacks } = view()
  const old = deferred()
  const pending = requests.run(() => old.promise, callbacks)
  requests.dispose()
  requests.activate()
  await requests.run(async () => 'new mount', callbacks)
  old.resolve('old mount')
  await pending
  assert.equal(state.value, 'new mount')
  assert.equal(state.finishes, 1)
})

test('independent metadata and cover searches do not cancel each other', async () => {
  const metadata = createLatestRequest(), covers = createLatestRequest()
  const game = view(), artwork = view()
  const result = deferred()
  const pending = metadata.run(() => result.promise, game.callbacks)
  await covers.run(async () => ['cover'], artwork.callbacks)
  result.resolve('game details')
  await pending
  assert.equal(game.state.value, 'game details')
  assert.deepEqual(artwork.state.value, ['cover'])
})

test('synchronous request failures use the same error and completion handling', async () => {
  const requests = createLatestRequest()
  const { state, callbacks } = view()
  await requests.run(() => { throw new Error('invalid request') }, callbacks)
  assert.equal(state.error, 'invalid request')
  assert.equal(state.loading, false)
})

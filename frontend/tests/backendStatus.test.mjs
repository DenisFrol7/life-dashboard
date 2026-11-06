import assert from 'node:assert/strict'
import { setImmediate as flush } from 'node:timers/promises'
import { test } from 'node:test'
import { watchBackendStatus } from '../src/utils/backendStatus.ts'

function watcher(initialVisibility = 'visible') {
  const events = new EventTarget()
  const visibility = new EventTarget()
  visibility.visibilityState = initialVisibility
  const timers = new Map(), requests = [], statuses = []
  let nextId = 0
  const probe = signal => new Promise((resolve, reject) => requests.push({ signal, resolve, reject }))
  const options = {
    events, visibility,
    schedule: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, delay }); return id },
    cancel: id => timers.delete(id),
  }
  const stop = watchBackendStatus(probe, status => statuses.push(status), options)
  return {
    events, visibility, timers, requests, statuses, stop, probe, options,
    tick(delay) {
      const [id, timer] = [...timers].find(([, timer]) => timer.delay === delay)
      timers.delete(id)
      timer.callback()
    },
    show(state) {
      visibility.visibilityState = state
      visibility.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

test('availability is established only after a successful probe and checked again after 30 seconds', async () => {
  const w = watcher()
  assert.deepEqual(w.statuses, ['checking'])
  assert.equal(w.requests.length, 1)
  w.requests[0].resolve()
  await flush()
  assert.deepEqual(w.statuses, ['checking', 'connected'])
  assert.deepEqual([...w.timers.values()].map(t => t.delay), [30_000])
  w.tick(30_000)
  assert.equal(w.requests.length, 2)
  // A background check keeps the last confirmed result instead of blinking on every poll.
  assert.equal(w.statuses.at(-1), 'connected')
  w.stop()
})

test('a failed request marks the backend unavailable and polling restores the connection', async () => {
  const w = watcher()
  w.requests[0].reject(new TypeError('Failed to fetch'))
  await flush()
  assert.equal(w.statuses.at(-1), 'unavailable')
  w.tick(30_000)
  w.requests[1].resolve()
  await flush()
  assert.equal(w.statuses.at(-1), 'connected')
  w.stop()
})

test('the five-second deadline aborts a hung request and its late success cannot override recovery', async () => {
  const w = watcher()
  w.tick(5_000)
  assert.equal(w.requests[0].signal.aborted, true)
  assert.equal(w.statuses.at(-1), 'unavailable')
  w.events.dispatchEvent(new Event('focus'))
  w.requests[1].reject(new Error('Still offline'))
  await flush()
  const before = [...w.statuses]
  w.requests[0].resolve()
  await flush()
  assert.deepEqual(w.statuses, before)
  assert.deepEqual([...w.timers.values()].map(t => t.delay), [30_000])
  w.stop()
})

test('focus and connectivity events check immediately without overlapping an active probe', async () => {
  const w = watcher()
  for (const type of ['focus', 'online', 'offline']) w.events.dispatchEvent(new Event(type))
  assert.equal(w.requests.length, 1)
  w.requests[0].resolve()
  await flush()
  w.events.dispatchEvent(new Event('online'))
  w.events.dispatchEvent(new Event('focus'))
  assert.equal(w.requests.length, 2)
  // An offline browser hint may still leave a localhost server reachable.
  w.requests[1].resolve()
  await flush()
  w.events.dispatchEvent(new Event('offline'))
  assert.equal(w.requests.length, 3)
  w.stop()
})

test('hiding the tab cancels its request and timers; returning checks fresh data', async () => {
  const w = watcher()
  w.show('hidden')
  assert.equal(w.requests[0].signal.aborted, true)
  assert.equal(w.timers.size, 0)
  w.events.dispatchEvent(new Event('focus'))
  w.events.dispatchEvent(new Event('online'))
  assert.equal(w.requests.length, 1)
  w.show('visible')
  assert.equal(w.requests.length, 2)
  w.requests[1].resolve()
  await flush()
  w.requests[0].reject(new Error('Late aborted response'))
  await flush()
  assert.equal(w.statuses.at(-1), 'connected')
  w.show('hidden')
  assert.equal(w.timers.size, 0)
  w.stop()
})

test('a tab opened in the background waits until it becomes visible', () => {
  const w = watcher('hidden')
  assert.equal(w.requests.length, 0)
  assert.equal(w.timers.size, 0)
  w.show('visible')
  assert.equal(w.requests.length, 1)
  w.stop()
})

test('cleanup aborts the request, removes event listeners and ignores queued callbacks', async () => {
  const w = watcher()
  const queuedDeadline = [...w.timers.values()][0].callback
  w.stop()
  assert.equal(w.requests[0].signal.aborted, true)
  assert.equal(w.timers.size, 0)
  queuedDeadline()
  w.requests[0].reject(new Error('Aborted'))
  await flush()
  for (const type of ['focus', 'online', 'offline']) w.events.dispatchEvent(new Event(type))
  w.show('visible')
  assert.equal(w.requests.length, 1)
  assert.deepEqual(w.statuses, ['checking'])
  assert.equal(w.timers.size, 0)
})

test('React effect restart ignores the prior effect result and keeps the new polling loop', async () => {
  const w = watcher()
  w.stop()
  const stop = watchBackendStatus(w.probe, status => w.statuses.push(status), w.options)
  w.requests[1].resolve()
  await flush()
  w.requests[0].reject(new Error('Previous effect'))
  await flush()
  assert.deepEqual(w.statuses, ['checking', 'checking', 'connected'])
  assert.equal(w.timers.size, 1)
  stop()
})

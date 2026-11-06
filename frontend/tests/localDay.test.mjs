import assert from 'node:assert/strict'
import { test } from 'node:test'
import { localDate, millisecondsUntilNextDay, watchLocalDay } from '../src/utils/localDay.ts'

function clock(initial) {
  let current = initial
  let nextId = 0
  const scheduled = new Map()
  const focusTarget = new EventTarget()
  const visibilityTarget = new EventTarget()
  visibilityTarget.visibilityState = 'visible'
  const days = []
  const stop = watchLocalDay(day => days.push(day), {
    now: () => current,
    schedule: (callback, delay) => { const id = ++nextId; scheduled.set(id, { callback, delay }); return id },
    cancel: id => scheduled.delete(id), focusTarget, visibilityTarget,
  })
  return {
    days, stop, scheduled, focusTarget, visibilityTarget,
    set: date => { current = date },
    tick: () => { const [id, timer] = scheduled.entries().next().value; scheduled.delete(id); timer.callback() },
  }
}

test('the local calendar date includes a local day that differs from UTC', () => {
  const previousZone = process.env.TZ
  try {
    process.env.TZ = 'Europe/Moscow'
    assert.equal(localDate(new Date('2026-11-06T22:30:00Z')), '2026-11-07')
  } finally {
    if (previousZone === undefined) delete process.env.TZ
    else process.env.TZ = previousZone
  }
})

for (const [before, after, expected] of [
  [new Date(2026, 10, 6, 23, 59, 59, 900), new Date(2026, 10, 7), '2026-11-07'],
  [new Date(2026, 10, 30, 23, 59, 59, 900), new Date(2026, 11, 1), '2026-12-01'],
  [new Date(2026, 11, 31, 23, 59, 59, 900), new Date(2027, 0, 1), '2027-01-01'],
]) {
  test(`the midnight timer updates the date to ${expected}`, () => {
    const watcher = clock(before)
    assert.equal([...watcher.scheduled.values()][0].delay, 100)
    watcher.set(after)
    watcher.tick()
    assert.equal(watcher.days.at(-1), expected)
    assert.equal(watcher.scheduled.size, 1)
    watcher.stop()
  })
}

test('returning focus catches up after several days without waiting for a timer', () => {
  const watcher = clock(new Date(2026, 10, 6, 12))
  watcher.set(new Date(2026, 10, 10, 9))
  watcher.focusTarget.dispatchEvent(new Event('focus'))
  assert.equal(watcher.days.at(-1), '2026-11-10')
  assert.equal(watcher.scheduled.size, 1)
  watcher.stop()
})

test('a hidden tab refreshes as soon as it becomes visible', () => {
  const watcher = clock(new Date(2026, 10, 6, 12))
  watcher.visibilityTarget.visibilityState = 'hidden'
  watcher.set(new Date(2026, 10, 7, 12))
  watcher.visibilityTarget.dispatchEvent(new Event('visibilitychange'))
  assert.equal(watcher.days.at(-1), '2026-11-06')
  watcher.visibilityTarget.visibilityState = 'visible'
  watcher.visibilityTarget.dispatchEvent(new Event('visibilitychange'))
  assert.equal(watcher.days.at(-1), '2026-11-07')
  watcher.stop()
})

test('a changed clock is checked again within a minute', () => {
  const watcher = clock(new Date(2026, 10, 6, 12))
  assert.equal([...watcher.scheduled.values()][0].delay, 60_000)
  watcher.set(new Date(2026, 10, 5, 12))
  watcher.tick()
  assert.equal(watcher.days.at(-1), '2026-11-05')
  watcher.stop()
})

test('unmounting removes timers, listeners and ignores an already queued timer', () => {
  const watcher = clock(new Date(2026, 10, 6, 23))
  const queued = [...watcher.scheduled.values()][0].callback
  watcher.stop()
  watcher.set(new Date(2026, 10, 7))
  queued()
  watcher.focusTarget.dispatchEvent(new Event('focus'))
  watcher.visibilityTarget.dispatchEvent(new Event('visibilitychange'))
  assert.deepEqual(watcher.days, ['2026-11-06'])
  assert.equal(watcher.scheduled.size, 0)
})

test('daylight saving transitions use the actual next local midnight', () => {
  const previousZone = process.env.TZ
  try {
    process.env.TZ = 'America/New_York'
    assert.equal(millisecondsUntilNextDay(new Date(2026, 2, 8)), 23 * 60 * 60 * 1000)
    assert.equal(millisecondsUntilNextDay(new Date(2026, 10, 1)), 25 * 60 * 60 * 1000)
  } finally {
    if (previousZone === undefined) delete process.env.TZ
    else process.env.TZ = previousZone
  }
})

type DraftSnapshot = Readonly<{ date: string; revision: number }>

export function createActivityDraft(initialDate: string) {
  let date = initialDate
  let revision = 0
  let dirty = false
  const isCurrent = (snapshot: DraftSnapshot) => snapshot.date === date && snapshot.revision === revision

  return {
    selectDate(nextDate: string) {
      if (nextDate === date) return
      date = nextDate
      revision++
      dirty = false
    },
    edit() {
      revision++
      dirty = true
    },
    snapshot(): DraftSnapshot {
      return { date, revision }
    },
    get hasChanges() {
      return dirty
    },
    isCurrent,
    accept(snapshot: DraftSnapshot) {
      if (!isCurrent(snapshot)) return false
      dirty = false
      return true
    },
  }
}

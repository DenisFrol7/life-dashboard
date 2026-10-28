type LibraryFormOptions<T> = {
  title: string
  inLibrary: boolean
  wasInLibrary: boolean
  saveItem: () => Promise<T>
  putLibrary: (id: number) => Promise<unknown>
  removeLibrary: (id: number) => Promise<unknown>
}

export async function saveLibraryForm<T extends { id: number }>(
  options: LibraryFormOptions<T>,
  confirmRemoval: (message: string) => boolean = (message) => window.confirm(message),
): Promise<T | null> {
  const removing = options.wasInLibrary && !options.inLibrary
  if (removing) {
    const confirmed = confirmRemoval(`Убрать «${options.title}» из моей библиотеки?\n\n`
      + 'Статус, оценка, избранное, заметка и даты в библиотеке будут удалены. '
      + 'История и прогресс сохранятся.\n\nКарточка останется в каталоге.')
    if (!confirmed) return null
  }

  const saved = await options.saveItem()
  if (options.inLibrary) await options.putLibrary(saved.id)
  else if (removing) await options.removeLibrary(saved.id)
  return saved
}

import type { Book, BookFormat } from '../api/books'
import type { LibraryStatus } from '../api/movies'

export const bookStatusLabels: Record<LibraryStatus, string> = {
  NOT_STARTED: 'Не начата',
  PLANNED: 'В планах',
  IN_PROGRESS: 'Читаю',
  COMPLETED: 'Прочитана',
  PAUSED: 'На паузе',
  DROPPED: 'Брошена',
}

export const bookFormatLabels: Record<BookFormat, string> = {
  PAPER: 'Бумажная',
  EBOOK: 'Электронная',
  AUDIOBOOK: 'Аудиокнига',
}

export const progressText = (book: Book) =>
  book.bookFormat === 'AUDIOBOOK'
    ? `${book.currentMinute ?? 0} из ${book.durationMinutes ?? 0} мин.`
    : `${book.currentPage ?? 0} из ${book.pageCount ?? 0} стр.`

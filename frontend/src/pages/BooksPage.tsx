import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router";
import { BookOpen, ChevronDown, Heart, Plus, Search } from "lucide-react";
import {
  createBook,
  createReadingSession,
  deleteBook,
  deleteReadingSession,
  getBooks,
  putBookLibrary,
  putBookProgress,
  removeBookLibrary,
  searchGoogleBooks,
  updateBook,
  updateReadingSession,
  uploadBookCover,
  type Book,
  type BookFormat,
  type BookInput,
  type BookLibraryInput,
  type GoogleBookCandidate,
  type ReadingSession,
  type ReadingSessionInput,
} from "../api/books";
import type { LibraryStatus } from "../api/movies";
import { bookFormatLabels, bookStatusLabels, progressText } from "./bookUi";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { useToast } from "../components/ToastContext";
import { saveLibraryForm } from "./libraryForm";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { useFormMutation } from "../hooks/useFormMutation";
import { getApiErrorMessage } from "../api/client";
import "./BooksPage.css";

const emptyBook: BookInput = {
  title: "",
  author: "",
  bookFormat: "PAPER",
  pageCount: null,
  durationMinutes: null,
  releaseYear: null,
  genre: null,
  coverUrl: null,
  description: null,
  googleBooksId: null,
  isbn: null,
};
const localDateTime = (value: string) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export function BooksPage() {
  const requests = useLatestRequest();
  const [books, setBooks] = useState<Book[]>([]);
  const [editing, setEditing] = useState<Book | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LibraryStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statisticsExpanded, setStatisticsExpanded] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const focusTargetRef = useRef<"new" | number>("new");
  const focusAfterDialogRef = useRef(false);

  const load = useCallback(() => requests.run(getBooks, {
    onStart: () => { setLoading(true); setError(null); },
    onSuccess: items => { setBooks(items); setInitialized(true); },
    onError: reason => setError(getApiErrorMessage(reason, "Не удалось загрузить книги")),
    onFinish: () => setLoading(false),
  }), [requests]);
  useEffect(() => { void load(); return () => requests.invalidate(); }, [load, requests]);
  useEffect(() => {
    if (!focusAfterDialogRef.current || loading || editing) return;
    focusAfterDialogRef.current = false;
    const target = focusTargetRef.current;
    const fallback = target === "new" ? addRef.current : pageRef.current?.querySelector<HTMLButtonElement>(`[data-book-id="${target}"] .books-catalog-add-library`) ?? addRef.current;
    (triggerRef.current?.isConnected ? triggerRef.current : fallback)?.focus({ preventScroll: true });
  }, [loading, editing]);
  const openForm = (book: Book | "new", trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    focusTargetRef.current = book === "new" ? "new" : book.id;
    setEditing(book);
  };
  const finishDialog = (refresh = false) => {
    focusAfterDialogRef.current = true;
    setEditing(null);
    if (refresh) void load();
  };
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return books.filter(book => (!normalized || `${book.title} ${book.author}`.toLocaleLowerCase("ru-RU").includes(normalized)) && (!status || book.status === status));
  }, [books, query, status]);
  const libraryBooks = books.filter(book => book.libraryEntryId != null);
  const sessionCount = books.reduce((sum, book) => sum + book.sessions.length, 0);
  const readingMinutes = books.reduce((sum, book) => sum + book.sessions.reduce((total, session) => total + session.durationMinutes, 0), 0);
  const filtered = Boolean(query.trim() || status);

  return <div ref={pageRef} className="books-library-page">
    <section className="books-catalog-toolbar" aria-label="Управление каталогом книг">
      <div className="books-catalog-tabs" role="group" aria-label="Статус книги">{([
        ["", "Все"], ["NOT_STARTED", "Не начато"], ["IN_PROGRESS", "Читаю"], ["PLANNED", "В планах"], ["COMPLETED", "Прочитано"], ["PAUSED", "На паузе"], ["DROPPED", "Брошено"],
      ] as const).map(([value, label]) => <button type="button" key={value || "all"} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}</div>
      <div className="books-catalog-search"><Search aria-hidden="true" /><input type="search" aria-label="Найти книгу или автора" value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти книгу или автора" /></div>
      <button ref={addRef} type="button" className="primary-button icon-button books-catalog-add" onClick={event => openForm("new", event.currentTarget)}><Plus aria-hidden="true" />Добавить книгу</button>
    </section>
    <section className="books-catalog-layout">
      <div className="books-catalog-main">
        <div className="books-catalog-heading"><h2>Каталог</h2><output aria-live="polite" aria-atomic="true">{loading ? "Загружаем книги…" : error ? "Книги не загружены" : `Показано: ${visible.length} из ${books.length}`}</output></div>
        {loading ? <LoadingState message="Загружаем книги…" /> : error ? <ErrorState title="Не удалось загрузить книги" message={error} onRetry={() => void load()} /> : visible.length === 0 ? <div className="books-catalog-empty"><BookOpen aria-hidden="true" /><h2>{filtered ? "Книги не найдены" : "Каталог пока пуст"}</h2><p>{filtered ? "Попробуйте изменить поиск или статус." : "Добавьте первую книгу в каталог."}</p>{filtered && <button type="button" className="secondary-button" onClick={() => { setQuery(""); setStatus(""); }}>Сбросить фильтры</button>}</div> : <section className="books-catalog-grid" aria-label="Книги">{visible.map(book => {
          const inLibrary = book.libraryEntryId != null;
          const progress = Math.max(0, Math.min(100, book.progressPercent));
          return <article className="books-catalog-card" key={book.id} data-book-id={book.id}>
            <Link className="books-catalog-cover" to={`/books/${book.id}`} aria-label={`Открыть книгу «${book.title}»`}>
              <span className="books-catalog-cover-letter" aria-hidden="true">{book.title.slice(0, 1)}</span>
              {book.coverUrl && <img key={book.coverUrl} src={book.coverUrl} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true; }} />}
              {book.favorite && <span className="books-catalog-favorite" role="img" aria-label="В избранном"><Heart aria-hidden="true" /></span>}
            </Link>
            <div className="books-catalog-copy">
              <h3><Link to={`/books/${book.id}`} title={book.title}>{book.title}</Link></h3>
              <p className="books-catalog-author" title={book.author || undefined}>{book.author || "Автор не указан"}</p>
              <div className="books-catalog-meta"><span>{book.releaseYear ?? "Год не указан"}</span><span>{bookFormatLabels[book.bookFormat]}</span></div>
              <p className="books-catalog-genre" title={book.genre || undefined}>{book.genre || "Жанр не указан"}</p>
              {inLibrary && <div className="books-catalog-progress"><strong>{progressText(book)} <small>· {Math.round(progress)}%</small></strong><div role="progressbar" aria-label={book.bookFormat === "AUDIOBOOK" ? "Прогресс прослушивания" : "Прогресс чтения"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={progressText(book)}><span style={{ width: `${progress}%` }} /></div></div>}
            </div>
            <div className="books-catalog-personal">{inLibrary ? <>
              <span className={`books-catalog-status ${book.status?.toLowerCase() ?? "not_started"}`}>{bookStatusLabels[book.status ?? "NOT_STARTED"]}</span>
              <strong className="books-catalog-rating" data-rated={book.rating != null} aria-label={book.rating != null ? `Оценка: ${book.rating} из 10` : "Без оценки"}>{book.rating != null ? `${book.rating}/10` : "Без оценки"}</strong>
            </> : <button type="button" className="books-catalog-add-library" aria-label={`Добавить в библиотеку «${book.title}»`} onClick={event => openForm(book, event.currentTarget)}><Plus aria-hidden="true" />В библиотеку</button>}</div>
          </article>;
        })}</section>}
      </div>
      <aside className="books-catalog-statistics">
        <p className="eyebrow">Общая статистика</p><h2>Книги <span>{initialized ? books.length : "—"}</span></h2>
        <button type="button" className="books-catalog-statistics-toggle" aria-expanded={statisticsExpanded} aria-controls="books-catalog-statistics-details" onClick={() => setStatisticsExpanded(expanded => !expanded)}>Общая статистика<ChevronDown aria-hidden="true" /></button>
        <div id="books-catalog-statistics-details" className="books-catalog-statistics-details" data-expanded={statisticsExpanded}><dl>{([
          ["Количество книг", books.length], ["В библиотеке", libraryBooks.length], ["Не начато", libraryBooks.filter(book => book.status === "NOT_STARTED").length], ["Читаю", libraryBooks.filter(book => book.status === "IN_PROGRESS").length], ["В планах", libraryBooks.filter(book => book.status === "PLANNED").length], ["Прочитано", libraryBooks.filter(book => book.status === "COMPLETED").length], ["На паузе", libraryBooks.filter(book => book.status === "PAUSED").length], ["Брошено", libraryBooks.filter(book => book.status === "DROPPED").length], ["Бумажные", books.filter(book => book.bookFormat === "PAPER").length], ["Электронные", books.filter(book => book.bookFormat === "EBOOK").length], ["Аудиокниги", books.filter(book => book.bookFormat === "AUDIOBOOK").length], ["Сеансы чтения", sessionCount], ["Время чтения", `${Math.floor(readingMinutes / 60)} ч ${readingMinutes % 60} мин`],
        ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{initialized ? value : "—"}</dd></div>)}</dl></div>
      </aside>
    </section>
    {editing && <BookForm book={editing === "new" ? undefined : editing} onClose={() => finishDialog()} onSaved={() => finishDialog(true)} />}
  </div>;
}


export function BookForm({
  book,
  onClose,
  onSaved,
  onDeleted,
}: {
  book?: Book;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const { showToast } = useToast();
  const [item, setItem] = useState<BookInput>(
    book
      ? {
          title: book.title,
          author: book.author,
          bookFormat: book.bookFormat,
          pageCount: book.pageCount,
          durationMinutes: book.durationMinutes,
          releaseYear: book.releaseYear,
          genre: book.genre,
          coverUrl: book.coverUrl,
          description: book.description,
          googleBooksId: book.googleBooksId,
          isbn: book.isbn,
        }
      : emptyBook,
  );
  const [inLibrary, setInLibrary] = useState(Boolean(book?.libraryEntryId));
  const [library, setLibrary] = useState<BookLibraryInput>({
    status: book?.status ?? "NOT_STARTED",
    rating: book?.rating ?? null,
    favorite: book?.favorite ?? false,
    startedAt: book?.startedAt ?? null,
    completedAt: book?.completedAt ?? null,
    personalNote: book?.personalNote ?? null,
  });
  const mutations = useFormMutation();
  const { saving, deleting, pending } = mutations;
  const [error, setError] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [candidates, setCandidates] = useState<GoogleBookCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const catalogRequests = useLatestRequest();
  const uploadRequests = useLatestRequest();
  const cancelCatalog = () => {
    catalogRequests.invalidate();
    setSearching(false);
    setCandidates([]);
    setSearchCompleted(false);
  };
  const changeCatalogQuery = (value: string) => {
    cancelCatalog();
    setCatalogQuery(value);
  };
  const closeForm = () => {
    mutations.dispose();
    catalogRequests.dispose();
    uploadRequests.dispose();
    onClose();
  };
  const set = <K extends keyof BookInput>(key: K, value: BookInput[K]) => {
    if (key === "coverUrl") {
      uploadRequests.invalidate();
      setUploadingCover(false);
    }
    setItem((current) => ({ ...current, [key]: value }));
  };
  const setLib = <K extends keyof BookLibraryInput>(
    key: K,
    value: BookLibraryInput[K],
  ) => setLibrary((current) => ({ ...current, [key]: value }));
  const changeFormat = (format: BookFormat) =>
    setItem((current) => ({
      ...current,
      bookFormat: format,
      pageCount: format === "AUDIOBOOK" ? null : current.pageCount,
      durationMinutes: format === "AUDIOBOOK" ? current.durationMinutes : null,
    }));
  const searchCatalog = async () => {
    const value = catalogQuery.trim();
    if (value.length < 2) return;
    await catalogRequests.run(() => searchGoogleBooks(value), {
      onStart: () => { setSearching(true); setSearchCompleted(false); setError(null); setCandidates([]); },
      onSuccess: (results) => { setCandidates(results); setSearchCompleted(true); },
      onError: (reason) => setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось выполнить поиск в Google Books",
      ),
      onFinish: () => setSearching(false),
    });
  };
  const selectCandidate = (candidate: GoogleBookCandidate) => {
    if (candidate.existingBookId) return;
    cancelCatalog();
    uploadRequests.invalidate();
    setUploadingCover(false);
    setItem({
      ...emptyBook,
      title: candidate.title,
      author: candidate.author,
      pageCount: candidate.pageCount,
      releaseYear: candidate.releaseYear,
      genre: candidate.genre,
      coverUrl: candidate.coverUrl,
      description: candidate.description,
      googleBooksId: candidate.googleBooksId,
      isbn: candidate.isbn,
    });
    setCandidates([]);
  };
  const uploadCover = async (file?: File) => {
    if (!file) return;
    await uploadRequests.run(() => uploadBookCover(file), {
      onStart: () => { setUploadingCover(true); setError(null); },
      onSuccess: (uploaded) => setItem((current) => ({ ...current, coverUrl: uploaded.coverUrl })),
      onError: (reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить обложку"),
      onFinish: () => setUploadingCover(false),
    });
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending || searching || uploadingCover) return;
    setError(null);
    await mutations.run('save', () => saveLibraryForm({
      title: book?.title ?? item.title,
      inLibrary,
      wasInLibrary: Boolean(book?.libraryEntryId),
      saveItem: () => book ? updateBook(book.id, item) : createBook(item),
      putLibrary: (id) => putBookLibrary(id, library),
      removeLibrary: removeBookLibrary,
    }), {
      onSuccess: (saved) => {
        if (!saved) return;
        showToast(book ? "Книга обновлена" : "Книга добавлена");
        onSaved();
      },
      onError: (reason) => setError(
        reason instanceof Error ? reason.message : "Не удалось сохранить книгу",
      ),
    });
  };
  const remove = async () => {
    if (!book || pending || searching || uploadingCover) return;
    setError(null);
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить «${book.title}» из каталога вместе с прогрессом и всей историей чтения?`)) return false;
      await deleteBook(book.id);
      return true;
    }, {
      onSuccess: (deleted) => {
        if (!deleted) return;
        showToast("Книга удалена");
        (onDeleted ?? onSaved)();
      },
      onError: (reason) => setError(
        reason instanceof Error ? reason.message : "Не удалось удалить книгу",
      ),
    });
  };
  return (
    <div className="modal-backdrop">
      <form className="habit-form book-form" onSubmit={(e) => void submit(e)}>
        <div className="form-heading">
          <div>
            <p className="eyebrow">Книги</p>
            <h2>{book ? "Редактирование" : "Новая книга"}</h2>
          </div>
          <button type="button" onClick={closeForm}>
            ×
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        {!book && (
          <section className="kinopoisk-movie-search">
            <div>
              <input
                value={catalogQuery}
                onChange={(e) => changeCatalogQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void searchCatalog();
                  }
                }}
                placeholder="Введите название книги или ISBN"
              />
              <button
                className="secondary-button"
                type="button"
                disabled={searching || catalogQuery.trim().length < 2}
                onClick={() => void searchCatalog()}
              >
                {searching ? "Ищем…" : "Найти в Google Books"}
              </button>
            </div>
            {item.googleBooksId && (
              <p>
                Издание выбрано. Проверьте данные и при необходимости замените
                URL обложки.
              </p>
            )}
            {candidates.length > 0 && (
              <div className="kinopoisk-movie-results">
                {candidates.map((candidate) => (
                  <button
                    type="button"
                    key={candidate.googleBooksId}
                    disabled={Boolean(candidate.existingBookId)}
                    onClick={() => selectCandidate(candidate)}
                  >
                    {candidate.coverUrl ? (
                      <img src={candidate.coverUrl} alt="" />
                    ) : (
                      <span>▥</span>
                    )}
                    <span>
                      <strong>{candidate.title}</strong>
                      <small>
                        {candidate.author}
                        {candidate.publisher ? ` · ${candidate.publisher}` : ""}
                        {candidate.publishedDate
                          ? ` · ${candidate.publishedDate}`
                          : ""}
                        {candidate.isbn ? ` · ISBN ${candidate.isbn}` : ""}
                        {candidate.existingBookId ? " · Уже в каталоге" : ""}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {searchCompleted && candidates.length === 0 && (
              <p className="form-hint">
                Книга не найдена в Google Books. Проверьте ISBN или заполните
                данные вручную.
              </p>
            )}
          </section>
        )}
        <label>
          Название
          <input
            required
            maxLength={300}
            value={item.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
        <label>
          Автор
          <input
            required
            maxLength={300}
            value={item.author}
            onChange={(e) => set("author", e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Формат
            <select
              value={item.bookFormat}
              onChange={(e) => changeFormat(e.target.value as BookFormat)}
            >
              {Object.entries(bookFormatLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {item.bookFormat === "AUDIOBOOK" ? (
            <label>
              Продолжительность, минут
              <input
                required
                min="1"
                type="number"
                value={item.durationMinutes ?? ""}
                onChange={(e) =>
                  set(
                    "durationMinutes",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              />
            </label>
          ) : (
            <label>
              Количество страниц
              <input
                required
                min="1"
                type="number"
                value={item.pageCount ?? ""}
                onChange={(e) =>
                  set(
                    "pageCount",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              />
            </label>
          )}
          <label>
            Год
            <input
              min="1"
              type="number"
              value={item.releaseYear ?? ""}
              onChange={(e) =>
                set(
                  "releaseYear",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            />
          </label>
          <label>
            Жанр
            <input
              maxLength={100}
              value={item.genre ?? ""}
              onChange={(e) => set("genre", e.target.value || null)}
            />
          </label>
        </div>
        <label>
          ISBN
          <input
            maxLength={20}
            value={item.isbn ?? ""}
            onChange={(e) => set("isbn", e.target.value || null)}
            placeholder="ISBN конкретного издания"
          />
        </label>
        <label>
          URL обложки
          <input
            type="text"
            inputMode="url"
            value={item.coverUrl ?? ""}
            onChange={(e) => set("coverUrl", e.target.value || null)}
          />
        </label>
        <label>
          Файл обложки
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploadingCover}
            onChange={(e) => void uploadCover(e.target.files?.[0])}
          />
          <small className="book-cover-upload-hint">
            {uploadingCover
              ? "Загружаем обложку…"
              : "JPEG, PNG или WebP, не более 5 МБ"}
          </small>
        </label>
        <label>
          Описание
          <textarea
            rows={3}
            value={item.description ?? ""}
            onChange={(e) => set("description", e.target.value || null)}
          />
        </label>
        <fieldset className="library-fields">
          <legend>Моя библиотека</legend>
          <label className="all-day-check">
            <input
              type="checkbox"
              checked={inLibrary}
              onChange={(e) => setInLibrary(e.target.checked)}
            />
            Добавить в библиотеку
          </label>
          {inLibrary && (
            <>
              <div className="form-grid">
                <label>
                  Статус
                  <select
                    value={library.status}
                    onChange={(e) =>
                      setLib("status", e.target.value as LibraryStatus)
                    }
                  >
                    {Object.entries(bookStatusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Оценка
                  <select
                    value={library.rating ?? ""}
                    onChange={(e) =>
                      setLib(
                        "rating",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">Без оценки</option>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <label className="favorite-check">
                <input
                  type="checkbox"
                  checked={library.favorite}
                  onChange={(e) => setLib("favorite", e.target.checked)}
                />
                В избранном
              </label>
              <label>
                Заметка
                <textarea
                  rows={2}
                  value={library.personalNote ?? ""}
                  onChange={(e) =>
                    setLib("personalNote", e.target.value || null)
                  }
                />
              </label>
            </>
          )}
        </fieldset>
        <div className="form-buttons">
          {book && (
            <button
              className="danger-button"
              type="button"
              disabled={pending || searching || uploadingCover}
              onClick={() => void remove()}
            >
              {deleting ? "Удаляем…" : "Удалить"}
            </button>
          )}
          <button className="secondary-button" type="button" onClick={closeForm}>
            Отмена
          </button>
          <button className="primary-button" disabled={pending || searching || uploadingCover}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ProgressForm({
  book,
  onClose,
  onSaved,
}: {
  book: Book;
  onClose: () => void;
  onSaved: () => void;
}) {
  const audio = book.bookFormat === "AUDIOBOOK";
  const [value, setValue] = useState(
    audio ? (book.currentMinute ?? 0) : (book.currentPage ?? 0),
  );
  const mutations = useFormMutation();
  const { saving, pending } = mutations;
  const [error, setError] = useState<string | null>(null);
  const closeForm = () => { mutations.dispose(); onClose(); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    await mutations.run('save', () => putBookProgress(
      book.id,
      audio ? null : value,
      audio ? value : null,
    ), {
      onSuccess: onSaved,
      onError: (reason) => setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось обновить прогресс",
      ),
    });
  };
  return (
    <div className="modal-backdrop">
      <form
        className="habit-form compact-book-form"
        onSubmit={(e) => void submit(e)}
      >
        <div className="form-heading">
          <div>
            <p className="eyebrow">Прогресс</p>
            <h2>{book.title}</h2>
          </div>
          <button type="button" onClick={closeForm}>
            ×
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <label>
          {audio ? "Текущая позиция, минут" : "Текущая страница"}
          <input
            required
            min="0"
            max={(audio ? book.durationMinutes : book.pageCount) ?? undefined}
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </label>
        <div className="form-buttons">
          <button className="secondary-button" type="button" onClick={closeForm}>
            Отмена
          </button>
          <button className="primary-button" disabled={pending}>{saving ? "Сохраняем…" : "Сохранить"}</button>
        </div>
      </form>
    </div>
  );
}

export function SessionForm({
  book,
  session,
  onClose,
  onSaved,
}: {
  book: Book;
  session?: ReadingSession;
  onClose: () => void;
  onSaved: () => void;
}) {
  const audio = book.bookFormat === "AUDIOBOOK";
  const [input, setInput] = useState<ReadingSessionInput>(
    session
      ? {
          startedAt: session.startedAt,
          durationMinutes: session.durationMinutes,
          pagesRead: session.pagesRead,
          listenedMinutes: session.listenedMinutes,
          note: session.note,
        }
      : {
          startedAt: new Date().toISOString(),
          durationMinutes: 30,
          pagesRead: 0,
          listenedMinutes: 0,
          note: null,
        },
  );
  const [error, setError] = useState<string | null>(null);
  const mutations = useFormMutation();
  const { saving, deleting, pending } = mutations;
  const closeForm = () => { mutations.dispose(); onClose(); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);
    await mutations.run('save', async () => {
      if (session) await updateReadingSession(session.id, input);
      else await createReadingSession(book.id, input);
    }, {
      onSuccess: onSaved,
      onError: (reason) => setError(
        reason instanceof Error ? reason.message : "Не удалось сохранить сеанс",
      ),
    });
  };
  const remove = async () => {
    if (!session || pending) return;
    setError(null);
    await mutations.run('delete', async () => {
      if (!window.confirm("Удалить сеанс чтения?")) return false;
      await deleteReadingSession(session.id);
      return true;
    }, {
      onSuccess: (deleted) => { if (deleted) onSaved(); },
      onError: (reason) => setError(
        reason instanceof Error ? reason.message : "Не удалось удалить сеанс",
      ),
    });
  };
  return (
    <div className="modal-backdrop">
      <form
        className="habit-form compact-book-form"
        onSubmit={(e) => void submit(e)}
      >
        <div className="form-heading">
          <div>
            <p className="eyebrow">Сеанс чтения</p>
            <h2>{book.title}</h2>
          </div>
          <button type="button" onClick={closeForm}>
            ×
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <label>
          Начало
          <input
            type="datetime-local"
            value={localDateTime(input.startedAt)}
            onChange={(e) =>
              setInput((current) => ({
                ...current,
                startedAt: new Date(e.target.value).toISOString(),
              }))
            }
          />
        </label>
        <div className="form-grid">
          <label>
            Продолжительность, минут
            <input
              min="1"
              type="number"
              value={input.durationMinutes}
              onChange={(e) =>
                setInput((current) => ({
                  ...current,
                  durationMinutes: Number(e.target.value),
                }))
              }
            />
          </label>
          {audio ? (
            <label>
              Прослушано, минут
              <input
                min="0"
                type="number"
                value={input.listenedMinutes}
                onChange={(e) =>
                  setInput((current) => ({
                    ...current,
                    listenedMinutes: Number(e.target.value),
                  }))
                }
              />
            </label>
          ) : (
            <label>
              Прочитано страниц
              <input
                min="0"
                type="number"
                value={input.pagesRead}
                onChange={(e) =>
                  setInput((current) => ({
                    ...current,
                    pagesRead: Number(e.target.value),
                  }))
                }
              />
            </label>
          )}
        </div>
        <label>
          Заметка
          <textarea
            rows={3}
            value={input.note ?? ""}
            onChange={(e) =>
              setInput((current) => ({
                ...current,
                note: e.target.value || null,
              }))
            }
          />
        </label>
        <p className="form-hint">
          После сохранения прогресс изменится автоматически.
        </p>
        <div className="form-buttons">
          {session && (
            <button className="danger-button" type="button" disabled={pending} onClick={() => void remove()}>{deleting ? "Удаляем…" : "Удалить"}</button>
          )}
          <button className="secondary-button" type="button" onClick={closeForm}>
            Отмена
          </button>
          <button className="primary-button" disabled={pending}>{saving ? "Сохраняем…" : "Сохранить"}</button>
        </div>
      </form>
    </div>
  );
}

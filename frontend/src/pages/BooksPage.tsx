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
  createReadingSession,
  deleteReadingSession,
  getBooks,
  putBookProgress,
  updateReadingSession,
  type Book,
  type ReadingSession,
  type ReadingSessionInput,
} from "../api/books";
import type { LibraryStatus } from "../api/movies";
import { bookFormatLabels, bookStatusLabels, progressText } from "./bookUi";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { useFormMutation } from "../hooks/useFormMutation";
import { getApiErrorMessage } from "../api/client";
import { BookForm } from "../components/BookForm";
import "./BooksPage.css";

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
    {editing && <BookForm returnFocusTo={triggerRef.current} book={editing === "new" ? undefined : editing} onClose={() => finishDialog()} onSaved={() => finishDialog(true)} />}
  </div>;
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

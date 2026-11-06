import { lazy, Suspense } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import {
  BarChart3, BookOpen, CalendarDays, Clapperboard, Clock3, Film, Footprints,
  Gamepad2, Gauge, Home, Moon, NotebookPen, Settings, Sparkles, Sun,
  Tv, UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from './components/ThemeContext'
import { BackendStatus } from './components/BackendStatus'
import { LoadingState } from './components/AsyncState'
import { PageErrorBoundary } from './components/PageErrorBoundary'
import './App.css'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })))
const HabitsPage = lazy(() => import('./pages/HabitsPage').then(module => ({ default: module.HabitsPage })))
const ActivityPage = lazy(() => import('./pages/ActivityPage').then(module => ({ default: module.ActivityPage })))
const SleepPage = lazy(() => import('./pages/SleepPage').then(module => ({ default: module.SleepPage })))
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(module => ({ default: module.CalendarPage })))
const BlogPage = lazy(() => import('./pages/JournalPage').then(module => ({ default: module.BlogPage })))
const TimelinePage = lazy(() => import('./pages/TimelinePage').then(module => ({ default: module.TimelinePage })))
const MoviesPage = lazy(() => import('./pages/MoviesPage').then(module => ({ default: module.MoviesPage })))
const MovieDetailsPage = lazy(() => import('./pages/MovieDetailsPage').then(module => ({ default: module.MovieDetailsPage })))
const SeriesPage = lazy(() => import('./pages/SeriesPage').then(module => ({ default: module.SeriesPage })))
const SeriesDetailsPage = lazy(() => import('./pages/SeriesDetailsPage').then(module => ({ default: module.SeriesDetailsPage })))
const AnimePage = lazy(() => import('./pages/AnimePage').then(module => ({ default: module.AnimePage })))
const AnimeDetailsPage = lazy(() => import('./pages/AnimeDetailsPage').then(module => ({ default: module.AnimeDetailsPage })))
const GamesPage = lazy(() => import('./pages/GamesPage').then(module => ({ default: module.GamesPage })))
const GameDetailsPage = lazy(() => import('./pages/GameDetailsPage').then(module => ({ default: module.GameDetailsPage })))
const BooksPage = lazy(() => import('./pages/BooksPage').then(module => ({ default: module.BooksPage })))
const BookDetailsPage = lazy(() => import('./pages/BookDetailsPage').then(module => ({ default: module.BookDetailsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })))
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage').then(module => ({ default: module.PlaceholderPage })))

type NavItem = { path: string; label: string; short: string; description: string }

const navigation: NavItem[] = [
  { path: '/', label: 'Обзор', short: '⌂', description: 'Главная сводка на сегодня' },
  { path: '/analytics', label: 'Статистика', short: '⌁', description: 'Динамика и сравнение показателей' },
  { path: '/habits', label: 'Привычки', short: '✓', description: 'Расписание и прогресс привычек' },
  { path: '/activity', label: 'Активность', short: '↗', description: 'Шаги и пройденная дистанция' },
  { path: '/sleep', label: 'Сон', short: '☾', description: 'История и качество сна' },
  { path: '/calendar', label: 'Календарь', short: '□', description: 'События, задачи и напоминания' },
  { path: '/journal', label: 'Журнал активности', short: '≋', description: 'Хронология событий дня' },
  { path: '/blog', label: 'Блог', short: '✎', description: 'Мысли, заметки и теги' },
  { path: '/movies', label: 'Фильмы', short: '▶', description: 'Фильмы и история просмотров' },
  { path: '/series', label: 'Сериалы', short: '▤', description: 'Сезоны, эпизоды и прогресс' },
  { path: '/anime', label: 'Аниме', short: '◇', description: 'Многосерийное аниме' },
  { path: '/games', label: 'Игры', short: '＋', description: 'Игровая библиотека и Xbox' },
  { path: '/books', label: 'Книги', short: '▥', description: 'Книжная библиотека и прогресс чтения' },
  { path: '/settings', label: 'Настройки', short: '⚙', description: 'Экспорт, импорт и параметры приложения' },
]

const navigationIcons: Record<string, LucideIcon> = {
  '/': Home,
  '/analytics': BarChart3,
  '/habits': Gauge,
  '/activity': Footprints,
  '/sleep': Moon,
  '/calendar': CalendarDays,
  '/journal': Clock3,
  '/blog': NotebookPen,
  '/movies': Film,
  '/series': Tv,
  '/anime': Sparkles,
  '/games': Gamepad2,
  '/books': BookOpen,
  '/settings': Settings,
}

function App() {
  const { pathname } = useLocation()
  const { resolvedTheme, setMode } = useTheme()
  const current = navigation.find((item) => item.path === pathname)
    ?? (pathname.startsWith('/games/') ? navigation.find((item) => item.path === '/games') : undefined)
    ?? (pathname.startsWith('/books/') ? navigation.find((item) => item.path === '/books') : undefined)
    ?? (pathname.startsWith('/movies/') ? navigation.find((item) => item.path === '/movies') : undefined)
    ?? (pathname.startsWith('/series/') ? navigation.find((item) => item.path === '/series') : undefined)
    ?? (pathname.startsWith('/anime/') ? navigation.find((item) => item.path === '/anime') : undefined)
    ?? navigation[0]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><BarChart3 /></span>
          <span><strong>Life</strong> Dashboard</span>
        </div>
        <nav aria-label="Основная навигация">
          {navigation.map((item) => {
            const Icon = navigationIcons[item.path] ?? Clapperboard
            return <NavLink
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              end={item.path === '/'}
              to={item.path}
              key={item.path}
            >
              <span className="nav-icon" aria-hidden="true"><Icon /></span>
              <span>{item.label}</span>
            </NavLink>
          })}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-theme-toggle" type="button" onClick={() => setMode(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label={resolvedTheme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>
            <span>{resolvedTheme === 'dark' ? <Sun /> : <Moon />}</span>
            {resolvedTheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          </button>
          <BackendStatus />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Life Dashboard</p>
            <h1>{current.label}</h1>
          </div>
          <div className="profile-chip" title="Пользователь по умолчанию">
            <span><UserRound /></span>
            <div><strong>Владелец</strong><small>Домашний профиль</small></div>
          </div>
        </header>

        <PageErrorBoundary key={pathname}>
          <Suspense fallback={<LoadingState message="Загружаем страницу…" />}>
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/sleep" element={<SleepPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/journal" element={<TimelinePage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/movies" element={<MoviesPage />} />
              <Route path="/movies/:id" element={<MovieDetailsPage />} />
              <Route path="/series" element={<SeriesPage />} />
              <Route path="/series/:id" element={<SeriesDetailsPage />} />
              <Route path="/anime" element={<AnimePage />} />
              <Route path="/anime/:id" element={<AnimeDetailsPage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/games/:id" element={<GameDetailsPage />} />
              <Route path="/books" element={<BooksPage />} />
              <Route path="/books/:id" element={<BookDetailsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              {navigation.slice(1).filter((item) => !['/analytics', '/habits', '/activity', '/sleep', '/calendar', '/journal', '/blog', '/movies', '/series', '/anime', '/games', '/books', '/settings'].includes(item.path)).map((item) => (
                <Route
                  key={item.path}
                  path={item.path}
                  element={<PlaceholderPage title={item.label} description={item.description} />}
                />
              ))}
              <Route path="*" element={<Navigate replace to="/" />} />
            </Routes>
          </Suspense>
        </PageErrorBoundary>
      </main>
    </div>
  )
}

export default App

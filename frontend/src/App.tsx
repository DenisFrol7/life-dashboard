import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import { DashboardPage } from './pages/DashboardPage'
import { HabitsPage } from './pages/HabitsPage'
import { ActivityPage } from './pages/ActivityPage'
import { SleepPage } from './pages/SleepPage'
import { CalendarPage } from './pages/CalendarPage'
import { BlogPage } from './pages/JournalPage'
import { TimelinePage } from './pages/TimelinePage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import './App.css'

type NavItem = { path: string; label: string; short: string; description: string }

const navigation: NavItem[] = [
  { path: '/', label: 'Обзор', short: '⌂', description: 'Главная сводка на сегодня' },
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
]

function App() {
  const { pathname } = useLocation()
  const current = navigation.find((item) => item.path === pathname) ?? navigation[0]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">L</span>
          <span><strong>Life</strong> Dashboard</span>
        </div>
        <nav aria-label="Основная навигация">
          {navigation.map((item) => (
            <NavLink
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              end={item.path === '/'}
              to={item.path}
              key={item.path}
            >
              <span className="nav-icon" aria-hidden="true">{item.short}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" /> Backend подключён
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Life Dashboard</p>
            <h1>{current.label}</h1>
          </div>
          <div className="profile-chip" title="Пользователь по умолчанию">
            <span>LD</span>
            <div><strong>Владелец</strong><small>Домашний профиль</small></div>
          </div>
        </header>

        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/sleep" element={<SleepPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/journal" element={<TimelinePage />} />
          <Route path="/blog" element={<BlogPage />} />
          {navigation.slice(1).filter((item) => !['/habits', '/activity', '/sleep', '/calendar', '/journal', '/blog'].includes(item.path)).map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={<PlaceholderPage title={item.label} description={item.description} />}
            />
          ))}
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </main>
    </div>
  )
}

export default App

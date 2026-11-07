import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { ChevronRight, Clapperboard, Ellipsis, Moon, Sun, X, type LucideIcon } from 'lucide-react'
import { useTheme } from './ThemeContext'
import './MobileNavigation.css'

type NavigationItem = { path: string; label: string }
type Menu = 'media' | 'more'

const primaryPaths = ['/', '/activity', '/calendar']
const mediaPaths = ['/movies', '/series', '/anime', '/games', '/books']

export function MobileNavigation({ items, icons }: {
  items: readonly NavigationItem[]
  icons: Record<string, LucideIcon>
}) {
  const { pathname } = useLocation()
  const { resolvedTheme, setMode } = useTheme()
  const [menu, setMenu] = useState<Menu | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const primaryItems = primaryPaths.flatMap(path => items.filter(item => item.path === path))
  const mediaItems = items.filter(item => mediaPaths.includes(item.path))
  const moreItems = items.filter(item => !primaryPaths.includes(item.path) && !mediaPaths.includes(item.path))
  const matchesPath = (path: string) => pathname === path || pathname.startsWith(`${path}/`)
  const mediaActive = mediaPaths.some(matchesPath)
  const moreActive = moreItems.some(item => matchesPath(item.path))

  useEffect(() => {
    const dialog = dialogRef.current
    if (menu && !dialog?.open) dialog?.showModal()
    if (!menu && dialog?.open) dialog.close()
  }, [menu])

  useEffect(() => {
    dialogRef.current?.close()
  }, [pathname])

  useEffect(() => {
    const desktop = matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) dialogRef.current?.close() }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  return <>
    <nav className="mobile-navigation" aria-label="Мобильная навигация">
      {primaryItems.map(item => {
        const Icon = icons[item.path]
        return <NavLink key={item.path} to={item.path} end={item.path === '/'}
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
          <Icon aria-hidden="true" /><span>{item.label}</span>
        </NavLink>
      })}
      <button type="button" className={`mobile-nav-item${mediaActive || menu === 'media' ? ' active' : ''}`}
        aria-haspopup="dialog" aria-expanded={menu === 'media'} aria-controls="mobile-navigation-menu"
        onClick={() => setMenu('media')}>
        <Clapperboard aria-hidden="true" /><span>Медиатека</span>
      </button>
      <button type="button" className={`mobile-nav-item${moreActive || menu === 'more' ? ' active' : ''}`}
        aria-haspopup="dialog" aria-expanded={menu === 'more'} aria-controls="mobile-navigation-menu"
        onClick={() => setMenu('more')}>
        <Ellipsis aria-hidden="true" /><span>Ещё</span>
      </button>
    </nav>

    <dialog ref={dialogRef} id="mobile-navigation-menu" className="mobile-menu"
      aria-labelledby="mobile-menu-title" onClose={() => setMenu(null)}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
      onClick={event => { if (event.target === event.currentTarget) setMenu(null) }}>
      <div className="mobile-menu-panel">
        <header className="mobile-menu-heading">
          <h2 id="mobile-menu-title">{menu === 'media' ? 'Медиатека' : 'Ещё'}</h2>
          <button type="button" className="mobile-menu-close" aria-label="Закрыть меню" autoFocus
            onClick={() => setMenu(null)}><X aria-hidden="true" /></button>
        </header>
        <nav className="mobile-menu-links" aria-label={menu === 'media' ? 'Разделы медиатеки' : 'Другие разделы'}>
          {(menu === 'media' ? mediaItems : moreItems).map(item => {
            const Icon = icons[item.path]
            return <NavLink key={item.path} to={item.path} onClick={() => setMenu(null)}
              className={({ isActive }) => `mobile-menu-link${isActive ? ' active' : ''}`}>
              <span className="mobile-menu-icon"><Icon aria-hidden="true" /></span>
              <span>{item.label}</span><ChevronRight aria-hidden="true" />
            </NavLink>
          })}
        </nav>
        {menu === 'more' && <button type="button" className="mobile-menu-theme"
          onClick={() => setMode(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          {resolvedTheme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          <span>{resolvedTheme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}</span>
        </button>}
      </div>
    </dialog>
  </>
}

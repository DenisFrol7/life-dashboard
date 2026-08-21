import { useRef, useState, type ChangeEvent } from 'react'
import { exportData, importData, type DataTransferResult } from '../api/dataTransfer'
import { getApiErrorMessage } from '../api/client'
import { useToast } from '../components/ToastContext'
import { useTheme, type ThemeMode } from '../components/ThemeContext'

export function SettingsPage() {
  const { showToast } = useToast()
  const { mode, setMode } = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DataTransferResult | null>(null)

  const download = async () => {
    setExporting(true); setError(null)
    try { await exportData(); showToast('Экспорт данных создан') }
    catch (reason) { setError(getApiErrorMessage(reason, 'Не удалось экспортировать данные')) }
    finally { setExporting(false) }
  }

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.name.toLocaleLowerCase().endsWith('.json')) { setError('Выберите JSON-файл экспорта Life Dashboard.'); return }
    if (!window.confirm(`Импортировать данные из «${file.name}»?\n\nТекущие данные будут заменены. Перед заменой backend автоматически создаст резервную копию.`)) return
    setImporting(true); setError(null); setResult(null)
    try { const imported = await importData(file); setResult(imported); showToast('Импорт данных завершён') }
    catch (reason) { setError(getApiErrorMessage(reason, 'Не удалось импортировать данные')) }
    finally { setImporting(false) }
  }

  return <div className="settings-page">
    <section className="settings-intro"><p className="eyebrow">Внешний вид</p><h2>Тема оформления</h2><p>Выберите комфортное оформление. Системный режим следует настройкам Windows.</p></section>
    <section className="theme-selector" aria-label="Тема оформления">
      {([['light', '☀', 'Светлая'], ['dark', '☾', 'Тёмная'], ['system', '◐', 'Системная']] as [ThemeMode, string, string][]).map(([value, icon, label]) => <button className={mode === value ? 'active' : ''} type="button" onClick={() => setMode(value)} key={value}><span>{icon}</span><strong>{label}</strong></button>)}
    </section>
    <section className="settings-intro"><p className="eyebrow">Данные</p><h2>Экспорт и импорт</h2><p>Сохраните все записи Life Dashboard в переносимый JSON-архив или восстановите ранее экспортированные данные.</p></section>
    {error && <div className="notice error settings-error"><strong>Ошибка</strong><span>{error}</span></div>}
    {result && <div className="notice settings-success"><strong>Импорт завершён</strong><span>Восстановлено строк: {result.rowCount}. Автоматическая копия прежних данных: {result.backupFile}</span></div>}
    <section className="settings-transfer-grid">
      <article className="settings-card"><span className="settings-card-icon">↓</span><div><h3>Экспорт данных</h3><p>Скачивает записи всех разделов, справочники и историю. Схема Flyway в архив не включается.</p></div><button className="primary-button" disabled={exporting || importing} onClick={() => void download()}>{exporting ? 'Создаём файл…' : 'Скачать JSON'}</button></article>
      <article className="settings-card danger"><span className="settings-card-icon">↑</span><div><h3>Импорт данных</h3><p>Полностью заменяет текущие записи. Подходит только архив от этой же версии схемы базы данных.</p></div><input ref={inputRef} type="file" accept="application/json,.json" onChange={(event) => void upload(event)} /><button className="danger-button" disabled={exporting || importing} onClick={() => inputRef.current?.click()}>{importing ? 'Импортируем…' : 'Выбрать архив'}</button></article>
    </section>
    <section className="settings-safety"><h3>Как защищены данные</h3><ul><li>Архив проверяется до начала замены данных.</li><li>Версия Flyway и набор таблиц должны полностью совпадать.</li><li>Перед импортом в папке <code>backups</code> автоматически создаётся JSON-копия.</li><li>Импорт выполняется одной транзакцией: при ошибке база возвращается в прежнее состояние.</li></ul></section>
  </div>
}

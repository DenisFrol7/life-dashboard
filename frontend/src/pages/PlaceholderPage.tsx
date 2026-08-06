export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="placeholder-card">
      <span className="placeholder-mark">01</span>
      <p className="eyebrow">Следующий этап</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="notice"><strong>Раздел подключён к навигации</strong><span>Интерфейс и формы добавим следующим коммитом.</span></div>
    </section>
  )
}

# Life Dashboard

Life Dashboard — локальное персональное приложение для ведения повседневной активности и личной медиатеки. Версия: **1.4.0**.

## Возможности

- дашборд и журнал активности;
- календарь, привычки, шаги и сон;
- блог для личных записей;
- фильмы, сериалы, аниме и история просмотров;
- книги, прогресс и сеансы чтения;
- игры, несколько библиотечных копий, платформы, источники, игровые сессии, прохождения, достижения Xbox и DLC;
- статистика за 7 и 30 дней, год, произвольный период и всё время;
- светлая, тёмная и системная темы;
- экспорт и импорт данных в JSON;
- резервное копирование и восстановление PostgreSQL.

## Технологии

- Java 21, Spring Boot 4.1, Maven 3.9.16;
- PostgreSQL 17 и Flyway;
- React 19, TypeScript 6, React Router 8 и Vite 8;
- Docker Compose для локальной базы данных.

## Требования

- Java 21;
- Node.js 24 или новее;
- Docker Desktop;
- PowerShell для приведённых ниже команд.

Глобально устанавливать Maven не требуется: в `backend` находится Maven Wrapper.

## Первый запуск

1. Создайте локальный файл окружения:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Замените `change_me` в `.env` на собственный пароль PostgreSQL.

3. Запустите PostgreSQL и дождитесь состояния `healthy`:

   ```powershell
   docker compose up -d
   docker compose ps
   ```

4. В отдельном терминале запустите backend:

   ```powershell
   Set-Location backend
   .\mvnw.cmd spring-boot:run
   ```

5. В другом терминале запустите frontend:

   ```powershell
   Set-Location frontend
   npm ci
   npm run dev
   ```

Приложение откроется по адресу `http://localhost:5173`. Backend доступен на `http://localhost:8080`, Swagger UI — на `http://localhost:8080/swagger-ui.html`.

## Проверки

Backend использует отдельную базу `life_dashboard_test`:

```powershell
Set-Location backend
.\mvnw.cmd test
```

Frontend:

```powershell
Set-Location frontend
npm run lint
npm run build
npm audit
```

## Остановка

Остановите процессы backend и frontend в их терминалах сочетанием `Ctrl+C`, затем остановите PostgreSQL без удаления данных:

```powershell
docker compose stop
```

Для следующего запуска существующего контейнера достаточно `docker compose start`. Команда `docker compose up -d` также безопасна и создаст отсутствующий контейнер при необходимости.

## Резервное копирование PostgreSQL

PostgreSQL должен быть запущен и находиться в состоянии `healthy`:

```powershell
.\scripts\backup.ps1
```

Архивы сохраняются в `backups/` и не отслеживаются Git. Для восстановления сначала остановите backend:

```powershell
.\scripts\restore.ps1 -BackupFile .\backups\life-dashboard_YYYY-MM-DD_HH-mm-ss.dump
```

Восстановление полностью заменяет содержимое development-базы и требует ручного ввода `RESTORE`.

## Экспорт и импорт JSON

На странице «Настройки» можно скачать переносимый JSON-архив всех прикладных таблиц. Перед импортом backend проверяет формат, версию схемы Flyway и набор таблиц, а затем автоматически сохраняет прежние данные в `backups/`.

JSON-архив содержит личные данные в открытом виде. Не добавляйте его в Git и не публикуйте.

## Ограничения версии 1.4.0

- приложение рассчитано на локальное использование одним пользователем;
- авторизация отсутствует;
- мобильная адаптация отложена;
- сведения о книгах и библиотеки Steam/Xbox пока не импортируются автоматически.

Планы последующих версий перечислены в [CHANGELOG.md](CHANGELOG.md).

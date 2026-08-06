# Life Dashboard Frontend

Клиентская часть Life Dashboard на React, TypeScript, React Router и Vite.

## Запуск

Backend должен быть доступен на `http://localhost:8080`. В режиме разработки Vite
проксирует запросы `/api` на backend.

```powershell
npm install
npm run dev
```

Приложение откроется по адресу `http://localhost:5173`.

Для отдельного адреса API скопируйте `.env.example` в `.env` и задайте
`VITE_API_URL`. Пустое значение использует текущий origin и локальный proxy.

## Проверки

```powershell
npm run lint
npm run build
npm audit
```

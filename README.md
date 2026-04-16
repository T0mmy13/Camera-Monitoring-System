# Camera Monitoring System

Система для мониторинга и учёта состояния камер видеонаблюдения.

## Функционал

- Учёт регистраторов и камер
- Ежедневные отчёты о состоянии камер
- Управление пользователями (3 роли: admin, editor, user)
- Журнал действий пользователей
- Экспорт отчётов в Excel
- Резервное копирование базы данных

## Технологии

- Backend: Flask (Python)
- Database: PostgreSQL
- Frontend: HTML, CSS, JavaScript
- Библиотеки: psycopg, openpyxl, python-dotenv

## Установка и запуск

### Требования

- Python 3.8+
- PostgreSQL
- Git

### Быстрый старт

git clone https://github.com/T0mmy13/Camera-Monitoring-System

cd cam-monitoring

main.bat

Выберите пункт 1.

### Ручная установка

python -m venv venv
venv\Scripts\activate
pip install Flask psycopg[binary] openpyxl python-dotenv

Создайте файл .env:

DB_NAME=postgres

DB_USER=postgres

DB_PASSWORD=qwerty

DB_HOST=localhost

DB_PORT=5432

FLASK_SECRET_KEY=your_secret_key_here

Запуск:

python app.py

## Структура БД

- cam_registrators – регистраторы (АП, IP, порты)
- cam_camers – камеры (порт, тип, расположение)
- cam_camera_report – отчёты о состоянии камер
- cam_users – пользователи системы
- cam_action_log – журнал действий
- cam_locks – блокировки записей

## Роли пользователей

| Роль | Доступ | Редактирование |
|------|--------|----------------|
| admin | Все таблицы | Все таблицы |
| editor | Регистраторы, Камеры, Отчёты | Только Отчёты |
| user | Только Отчёты | Нет |

## Команды start.bat

- 1 – Запустить сервер (http://localhost:8080)
- 2 – Создать резервную копию БД
- 0 – Выход

Остановить сервер – Ctrl+C
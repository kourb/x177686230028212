# Методы API

Источник: `https://133892.ip-ns.net/openapi/v1.json`

## AdminApplicationBooking (админ: запись заявки)
- `POST /v1/admin/applications/{publicId}/assign-slot` - Назначить слот заявке от имени менеджера: забронировать слот для владельца заявки и привязать его к заявке.

## AdminApplications (админ: заявки)
- `POST /v1/admin/applications/{id}/change-status` - Изменить статус заявки вручную.
- `POST /v1/admin/applications/{id}/run-flags` - Запустить автопроверки/флаги по заявке.
- `GET /v1/admin/applications/{id}` - Получить полную карточку заявки: заявители, история статусов, флаги.
- `POST /v1/admin/applications/flags/{flagId}/resolve` - Пометить флаг как решенный.
- `GET /v1/admin/applications` - Получить список заявок с фильтрами и пагинацией.

## AdminBookings (админ: бронирования)
- `GET /v1/admin/bookings` - Получить список бронирований с фильтрами по визовому центру, статусу, датам слотов и пользователю.

## AdminCustomFields (админ: кастомные поля)
- `DELETE /v1/admin/custom-fields/{id}` - Отключить кастомное поле.
- `PATCH /v1/admin/custom-fields/{id}` - Обновить настройки кастомного поля.
- `POST /v1/admin/custom-fields/reorder/{visaTypeId}` - Поменять порядок кастомных полей для типа визы.
- `POST /v1/admin/custom-fields` - Создать новое кастомное поле для типа визы.

## AdminPing
- `GET /v1/admin/ping` - Проверка, что админ-API доступно и авторизация работает.

## AdminSlots (админ: слоты)
- `GET /v1/admin/slots` - Получить список слотов без фильтра по доступности; доступны все источники и статусы.
- `PATCH /v1/admin/slots/{publicId}` - Частично обновить вместимость и/или статус слота.
- `POST /v1/admin/slots/{publicId}/close` - Закрыть слот, сохранив уже существующие бронирования.
- `POST /v1/admin/slots` - Создать слот вручную и уведомить подписчиков по стране/городу.

## AdminVisaCenters (админ: визовые центры)
- `DELETE /v1/admin/visa-centers/{id}` - Мягко отключить визовый центр, сохранив существующие слоты и бронирования.
- `PATCH /v1/admin/visa-centers/{id}` - Частично обновить визовый центр.
- `POST /v1/admin/visa-centers` - Создать визовый центр с локализованными переводами.

## AdminVisaTypes (админ: типы виз)
- `DELETE /v1/admin/visa-types/{id}` - Отключить тип визы.
- `PATCH /v1/admin/visa-types/{id}` - Обновить тип визы.
- `POST /v1/admin/visa-types` - Создать новый тип визы с переводами.

## ApplicationAggregate
- `GET /v1/app/applications/{id}/full` - Получить полную агрегированную информацию по заявке.

## ApplicationDocuments (документы заявки)
- `DELETE /v1/app/applications/{applicationId}/documents/{documentId}` - Удалить документ из заявки и файл, если он больше нигде не используется.
- `GET /v1/app/applications/{applicationId}/documents` - Получить список документов в заявке.
- `POST /v1/app/applications/{applicationId}/documents` - Привязать уже загруженный файл к заявке как документ.

## Applications (заявки)
- `GET /v1/app/applications/{id}/applicants` - Получить список заявителей в заявке.
- `POST /v1/app/applications/{id}/applicants` - Добавить заявителя в заявку.
- `POST /v1/app/applications/{id}/auto-save` - Быстро сохранить черновик заявки и заявителей одним запросом.
- `POST /v1/app/applications/{id}/clone` - Скопировать существующую заявку в новый черновик.
- `POST /v1/app/applications/{id}/return-to-draft` - Вернуть заявку из SelfCheck обратно в Draft.
- `POST /v1/app/applications/{id}/self-check` - Перевести заявку из Draft в SelfCheck; нужен минимум один заявитель.
- `GET /v1/app/applications/{id}/status-log` - Получить историю смены статусов.
- `POST /v1/app/applications/{id}/submit` - Отправить заявку на проверку: SelfCheck/NeedsEdits -> PendingReview.
- `DELETE /v1/app/applications/{id}` - Мягко удалить заявку.
- `GET /v1/app/applications/{id}` - Получить одну заявку по публичному ID.
- `PATCH /v1/app/applications/{id}` - Частично обновить черновик заявки.
- `GET /v1/app/applications/applicants/{applicantId}/custom-fields` - Получить значения кастомных полей заявителя.
- `PUT /v1/app/applications/applicants/{applicantId}/custom-fields` - Сохранить значения кастомных полей заявителя.
- `GET /v1/app/applications/applicants/{applicantId}/vfs` - Получить данные анкеты VFS по заявителю.
- `PUT /v1/app/applications/applicants/{applicantId}/vfs` - Сохранить данные анкеты VFS по заявителю.
- `DELETE /v1/app/applications/applicants/{applicantId}` - Удалить заявителя из заявки.
- `PATCH /v1/app/applications/applicants/{applicantId}` - Обновить данные заявителя: поля Шенгена и/или фото.
- `GET /v1/app/applications/latest` - Получить последнюю созданную заявку пользователя.
- `GET /v1/app/applications` - Получить список заявок текущего пользователя с cursor-пагинацией.
- `POST /v1/app/applications` - Создать новую заявку-черновик.

## AppPing
- `GET /v1/app/ping` - Проверка, что пользовательское API доступно и авторизация работает.

## Auth (авторизация)
- `DELETE /v1/app/auth/account` - Полностью удалить аккаунт текущего пользователя.
- `POST /v1/app/auth/apple` - Войти через Apple.
- `POST /v1/app/auth/change-password` - Изменить пароль текущего пользователя.
- `POST /v1/app/auth/email/send-otp` - Отправить OTP-код на email.
- `POST /v1/app/auth/email/verify-otp` - Проверить OTP-код и получить токены.
- `POST /v1/app/auth/google` - Войти через Google.
- `POST /v1/app/auth/login` - Войти по email и паролю.
- `POST /v1/app/auth/password/reset-confirm` - Подтвердить сброс пароля по OTP (пока не реализовано).
- `POST /v1/app/auth/password/reset-request` - Запросить OTP для сброса пароля (пока не реализовано).
- `POST /v1/app/auth/refresh` - Обновить access/refresh токены.
- `POST /v1/app/auth/register` - Зарегистрировать новый аккаунт (email + пароль).
- `DELETE /v1/app/auth/sessions/{sessionId}` - Завершить конкретную сессию по ID.
- `DELETE /v1/app/auth/sessions` - Завершить все сессии, опционально оставив текущую.
- `GET /v1/app/auth/sessions` - Получить список активных сессий пользователя.

## Bookings (бронирования)
- `DELETE /v1/app/bookings/{bookingPublicId}` - Отменить свое бронирование или любое бронирование для manager+ и очистить слот заявки.
- `GET /v1/app/applications/{publicId}/booking` - Получить текущее активное бронирование по заявке или 404, если его нет.
- `POST /v1/app/applications/{publicId}/book-slot` - Забронировать слот для заявки и привязать его с компенсационным откатом при ошибке привязки.

## Checklist
- `GET /v1/app/applications/{id}/checklist` - Получить чеклист готовности заявки к отправке.

## Dashboard
- `GET /v1/app/dashboard` - Получить сводные данные для главного экрана пользователя.

## Documents (файлы)
- `POST /v1/app/documents/{id}/ocr` - Запустить OCR по документу (пока не реализовано, возвращает 501).
- `POST /v1/app/documents/{id}/photo-check` - Проверить фото на соответствие требованиям (пока не реализовано, возвращает 501).
- `GET /v1/app/documents/{publicId}/download` - Получить временную ссылку на скачивание файла.
- `DELETE /v1/app/documents/{publicId}` - Удалить файл по публичному ID.
- `GET /v1/app/documents/{publicId}` - Получить метаданные файла по публичному ID.
- `POST /v1/app/documents/confirm` - Подтвердить, что файл загружен в S3.
- `GET /v1/app/documents/my-files` - Получить список файлов текущего пользователя.
- `POST /v1/app/documents/upload-url` - Получить временную ссылку для загрузки файла в S3.

## Insurance (страховка)
- `GET /v1/app/insurance/{id}` - Получить полис страховки по ID.
- `POST /v1/app/insurance/purchase` - Купить страховку по выбранной котировке.
- `GET /v1/app/insurance/quotes` - Получить варианты страховок по стране и датам поездки.

## Notifications (уведомления)
- `POST /v1/app/notifications/mark-read` - Отметить уведомления как прочитанные; пустой список ids с markAll=true отмечает все.
- `GET /v1/app/notifications` - Получить список уведомлений пользователя с cursor-пагинацией.

## Passport (паспорта)
- `DELETE /v1/app/passports/{publicId}` - Удалить паспорт по публичному ID.
- `GET /v1/app/passports` - Получить список паспортов пользователя.
- `POST /v1/app/passports` - Добавить новый паспорт.

## Payments (платежи)
- `POST /v1/app/payments/{id}/refund` - Сделать возврат платежа.
- `GET /v1/app/payments/{id}` - Получить платеж по ID.
- `POST /v1/app/payments/webhook` - Вебхук от платежного провайдера; публичная точка без Bearer-токена.
- `GET /v1/app/payments` - Получить список платежей по заявке.
- `POST /v1/app/payments` - Создать новый платеж по заявке.

## ReferenceData (справочники)
- `GET /v1/app/reference/countries` - Получить список стран.
- `GET /v1/app/reference/visa-types/{visaTypeId}/custom-fields` - Получить кастомные поля для типа визы.
- `GET /v1/app/reference/visa-types` - Получить типы виз, опционально с фильтром по стране.

## Slots (слоты записи)
- `DELETE /v1/app/slots/subscriptions/{countryId}/{city}` - Удалить подписку текущего пользователя на слоты по стране и городу.
- `POST /v1/app/slots/subscriptions` - Подписаться на доступность слотов по стране и городу.
- `GET /v1/app/slots/subscriptions` - Получить текущие подписки пользователя на слоты.
- `GET /v1/app/slots` - Получить доступные для бронирования слоты в заданном окне.

## VisaCenters (визовые центры)
- `GET /v1/app/visa-centers` - Получить список активных визовых центров, опционально с фильтром по стране.

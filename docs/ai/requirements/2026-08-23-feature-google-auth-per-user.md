---
phase: requirements
title: Requirements & Problem Understanding
description: Clarify the problem space, gather requirements, and define success criteria
---

# Requirements & Problem Understanding

## Problem Statement
**What problem are we solving?**

Сейчас Cloudflare Access защищает только страницу Integrations и два integration API endpoint. Главная страница, тренажёр и остальные API доступны без входа. D1 хранит статусы фраз, сохранённые примеры и DeepL-ключ одной общей записью, а тренажёр использует общий ключ localStorage. Поэтому один посетитель может увидеть и изменить прогресс другого.

Пользователь приложения — любой человек, который входит через Google. Текущий владелец legacy-данных — koreybadenis@gmail.com. Сегодня workaround отсутствует: приложение фактически работает как общая доска.

## Goals & Objectives
**What do we want to achieve?**

### Goals

- Защитить весь production Worker Cloudflare Access.
- Разрешить вход через уже созданный Google Identity Provider.
- Использовать проверенный Access JWT, а не email из запроса или cookie, как источник identity.
- Изолировать для каждого пользователя статусы фраз, пользовательские фразы, сохранённые примеры и интеграционные ключи.
- Сохранить legacy-прогресс, примеры и DeepL-ключ только для подтверждённого аккаунта koreybadenis@gmail.com.
- Оставить перевод опциональным: отсутствие или сбой DeepL не блокирует добавление и продвижение фразы.
- Остаться в бесплатном тарифе Cloudflare: Worker, D1 и Access Free; без R2, KV, Durable Objects, Queues и платных функций.

### Non-goals

- Собственная OAuth-реализация или хранение Google access/refresh tokens.
- Командный доступ, роли, профили и совместные библиотеки.
- Перенос локального тренажёрного прогресса в D1 в рамках этого PR.
- Поддержка нескольких провайдеров интеграций кроме существующего DeepL UI.

## User Stories & Use Cases
**How will users interact with the solution?**

- Как новый пользователь, я хочу войти через Google и получить чистую личную библиотеку.
- Как пользователь A, я хочу добавлять и переводить фразы, не меняя данные пользователя B.
- Как пользователь, я хочу сохранить DeepL-ключ так, чтобы он не был виден или использован другим аккаунтом.
- Как владелец legacy-аккаунта, я хочу увидеть существующий прогресс после первого Google-входа.
- Как пользователь, я хочу выйти через Cloudflare Access и не увидеть данные следующего пользователя в том же браузере.

Краевые случаи:

- Отсутствующий, просроченный или неверный Access JWT должен дать 401 до SQL-запросов.
- Новый пользователь не должен получить legacy-данные автоматически.
- Повторный вход и повторная миграция должны быть идемпотентными.
- Один и тот же preset доступен всем, но его статус и examples принадлежат конкретному user_id.
- DeepL недоступен или не настроен: фраза всё равно сохраняется, перевод помечается pending.
- Внешний клиентский заголовок user identity не должен влиять на identity, сформированную Worker.

## Success Criteria
**How will we know when we're done?**

- Cloudflare Access application покрывает весь hostname Worker; Google IdP включён, а current path-specific integration app тоже совместим с Google.
- Все пользовательские API требуют проверенную identity и отвечают 401 без неё.
- В D1 есть users, phrase_progress, user-scoped examples и user-scoped encrypted secrets.
- Тесты подтверждают, что A не читает и не меняет данные B.
- Legacy rows назначаются только подтверждённому адресу владельца; новые аккаунты получают независимое состояние.
- localStorage тренажёра namespaced по authenticated user; старый общий ключ импортируется только для legacy-владельца.
- lint, typecheck, build и тесты проходят; remote D1 migration применена; production smoke через Google подтверждён.

## Constraints & Assumptions
**What limitations do we need to work within?**

- Production: Cloudflare Worker + Static Assets + D1, repository koreyba/ListenToLearn.
- Cloudflare Access остаётся внешним authentication boundary; приложение не принимает user id из body, query или обычного cookie.
- Access JWT проверяется по issuer team domain и audience одного или нескольких Access applications.
- Стабильный Access sub используется как user id; email хранится как display/legacy-claim атрибут.
- ACCESS_TEAM_DOMAIN и ACCESS_AUD — несекретные Worker vars; Google client secret и integration encryption key не коммитятся.
- Legacy owner email фиксирован текущим verified Access identity и не является механизмом общей авторизации.

## Questions & Open Items
**What do we still need to clarify?**

Продуктовых открытых вопросов нет: пользователь явно выбрал Google и попросил push, PR, merge и deploy. Остаются только операционные проверки после реализации: фактический Google login, remote migration и production smoke.

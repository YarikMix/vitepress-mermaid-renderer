# Mermaid Render Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать внешней рамке достоверный сигнал успеха и ошибки static Mermaid.

**Architecture:** Factory передаёт существующий `renderComplete` компонента как DOM event
на wrapper конкретной схемы. Сам pipeline и интерфейс управления не меняются.

**Tech Stack:** Vue3, TypeScript6, Vitest, Bun, существующая Vite-сборка.

**Spec:** `docs/superpowers/specs/2026-11-02-mermaid-render-events-design.md`.

## Global Constraints

- Сохранять lifecycle-исправления базы `9e6c070e5d305086688b9067904061fee7bd6384`.
- Версия `1.2.3-cdd.2`; dist в Git; потребитель устанавливает полный SHA.
- Mermaid11 у потребителя и strict security сохраняются. Новых зависимостей нет.
- Не менять zoom/fit, не публиковать npm, не сливать PR автоматически.

## Review Focus

1. Ошибка static render: потребитель получает `success:false`, а не вечное ожидание.
2. Две схемы: событие принадлежит собственному wrapper и содержит собственный id.
3. Смена темы: следующий SVG даёт следующее событие, а не только первое.
4. Уход во время await: поздняя работа не доставляет событие удалённой схемы.
5. Повтор после ошибки: успешная попытка доступна потребителю без нового factory.

---

### Task 1: Мост события, regression tests и готовый пакет

**Files:**
- Modify: `src/MermaidRenderer.ts`, `tests/lifecycle.test.ts`, `README.md`, `package.json`.
- Regenerate: tracked `dist/` через штатную сборку; `bun.lock` только если Bun меняет метаданные версии.

**Interfaces:**
- Consumes: Vue emit `renderComplete`, payload `{id:string; success:boolean; error?:unknown}`.
- Produces: `CustomEvent<{id:string; success:boolean; error?:unknown}>` с именем
  `vitepress-mermaid:render-complete`, `bubbles:true`, target `.mermaid-wrapper`.
- Produces: собранный immutable Git SHA для `github:YarikMix/vitepress-mermaid-renderer#<SHA>`.

- [ ] **1. Зафиксировать baseline и написать regression cases в существующем describe.**
  Использовать настоящие factory/Vue и существующий mock Mermaid boundary из
  `tests/lifecycle.test.ts`; слушатель на родителе установить до `getInstance({static:true})`.
  Добавить `staticSuccessEvent`, `staticFailureThenRecovery`, `eventsStayWithOwnWrapper`,
  `themeRerenderEmitsAgain`, `unmountDuringRenderEmitsNothing`.
  Assert: на успехе `success===true`, непустой id и `event.target.querySelector('svg')`;
  на ошибке `success===false` и error; после theme/retry следующий успех;
  два target/id различны; после снятия root и release deferred число событий не растёт.
  Ошибку повторять через mock до исчерпания штатного retry, не менять алгоритм retry.

- [ ] **2. Получить RED.** `bun run test -- tests/lifecycle.test.ts`:
  новые positive delivery assertions падают из-за отсутствия событий; сохранить полный лог.
  До изменения исходников также выполнить весь `bun run test`, `bun run lint`, `bun run build`.
  Отдельно отметить существующие предупреждения lint; baseline ошибки не игнорировать.

- [ ] **3. Подключить мост в `h(MermaidDiagram, props)`.**
  Добавить `onRenderComplete(payload: {id:string;success:boolean;error?:unknown}):void`,
  который dispatch-ит указанный CustomEvent на wrapper при живом renderer и подключённом root.
  Передавать payload без сериализации и изменения ошибки. Использовать существующее
  disposal состояние; не добавлять параллельный observer или второй render queue.

- [ ] **4. Получить GREEN.** Узкий тест, весь `bun run test`, `bun run lint`, `bun run build`.
  Сборка без TypeScript/declaration diagnostics, даже если процесс вернул0.
  Тесты прежнего lifecycle остаются зелёными; исходные136 тестов не удалять/не ослаблять.
  При необходимости форматировать только изменённые файлы, повторить затронутые проверки.

- [ ] **5. Зафиксировать пакет.** Обновить версию и README: имя события, target,
  detail, успех/ошибка/повтор и пример listener на внешней обёртке. Собрать dist после
  финальных исходников. `git diff --check`; коммит `feat(mermaid): передавать результат отрисовки наружу`.
  Push `feat/render-events`; открыть personal PR с base `fix/lifecycle`, проверить head SHA.
  Из чистого temporary checkout проверить `bun install --frozen-lockfile` и сборку;
  docs устанавливает опубликованный SHA, а не локальный path или плавающую ветку.
  Записать SHA/PR и RED→GREEN в журнал выбранного процесса. Не сливать.

## Передача в docs

Реализуется как prerequisite связанного плана
`/home/oleg/2026_H2/docs/.claude/worktrees/mermaid-renderer/docs/superpowers/plans/2026-11-02-mermaid-layout.md`.
Выбранный владельцем способ исполнения применяется к обоим планам; повторный выбор не нужен.

Самопроверка 2026-11-02: контракт совпадает с Task1/Task3 docs; каждый Review Focus
покрыт названным lifecycle case. Выполнение и RED→GREEN ещё не начаты.

# Сигнал готовности SVG для внешней рамки

Статус: часть утверждённого 2026-11-02 дизайна docs:
`/home/oleg/2026_H2/docs/.claude/worktrees/mermaid-renderer/docs/superpowers/specs/2026-11-02-mermaid-layout-design.md`.

## Проверенные факты

- База личного форка YarikMix — `9e6c070e5d305086688b9067904061fee7bd6384`, ветка `fix/lifecycle`.
- `MermaidDiagram.vue` уже emits `renderComplete({id, success, error?})` после попытки
  отрисовки, включая смену темы. Factory в `MermaidRenderer.ts` не подписывается на него.
- `static:true` оставляет SVG и смену темы, но скрывает собственный интерфейс ошибки.
- Docs использует собранный dist по полному Git SHA, Mermaid11, strict security.

## Контракт

На `.mermaid-wrapper` передавать существующий Vue emit как bubbling DOM event
`vitepress-mermaid:render-complete`. Detail: `{id: string; success: boolean; error?: unknown}`.
При успехе SVG уже находится внутри соответствующего wrapper. При неуспехе есть
`success:false`; внешняя рамка показывает ошибку. Повторная попытка и смена темы
дают следующие события той же схемы. Событие не должно приходить от удалённой схемы.

Сохраняются очередь, отмена задач, очистка roots, интерактивный режим, авторство и MIT.
Не добавлять собственный zoom/fit, глобальные callbacks, зависимости и npm-публикацию.
Версия `1.2.3-cdd.2`, dist коммитится вместе с исходниками. Docs получает новый SHA.
Новая ветка `feat/render-events` основана на lifecycle-fix; PR направить в `fix/lifecycle`,
чтобы отдельно показать мост событий. Ни этот PR, ни прежний PR #1 не сливать самостоятельно.

import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick, render } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MermaidDiagram from '../src/MermaidDiagram.vue';
import { MermaidRenderer } from '../src/MermaidRenderer';
import { resetRenderPipeline } from '../src/composables/useMermaidRenderer';
import { _resetFullscreenManager } from '../src/composables/useFullscreenManager';

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  run: vi.fn(),
  registerExternalDiagrams: vi.fn(),
}));
vi.mock('mermaid', () => ({ default: mermaid }));

const code = 'flowchart LR\nA-->B';
const wrappers: VueWrapper[] = [];
const roots: Element[] = [];
let added: ReturnType<typeof vi.spyOn>;
const flush = async () => {
  await nextTick();
  await vi.runAllTimersAsync();
  await nextTick();
};
const mountDiagram = () => {
  const wrapper = mount(MermaidDiagram, {
    attachTo: document.body,
    props: { code },
  });
  wrappers.push(wrapper);
  return wrapper;
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('SPA diagram lifecycle', () => {
  const eventPage = (count = 1) => {
    document.body.innerHTML = `<div id="app">${`<div class="language-mermaid"><pre>${code}</pre></div>`.repeat(count)}</div>`;
    const page = document.getElementById('app')!;
    const events: {
      target: Element;
      detail: { id: string; success: boolean; error?: unknown };
      svg: boolean;
    }[] = [];
    page.addEventListener('vitepress-mermaid:render-complete', (event) => {
      const target = event.target as Element;
      events.push({
        target,
        detail: (event as CustomEvent).detail,
        svg: !!target.querySelector('svg'),
      });
    });
    const renderer = MermaidRenderer.getInstance({ static: true });
    return { page, events, renderer };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    resetRenderPipeline();
    mermaid.initialize.mockReset();
    mermaid.run.mockReset();
    mermaid.registerExternalDiagrams.mockResolvedValue(undefined);
    mermaid.run.mockImplementation(async ({ nodes }: { nodes: Element[] }) => {
      nodes[0]!.innerHTML = '<svg><text>rendered graph</text></svg>';
    });
    added = vi.spyOn(document, 'addEventListener');
  });

  afterEach(async () => {
    MermaidRenderer.resetInstance();
    for (const wrapper of wrappers.splice(0)) {
      if (!wrapper.vm.$.isUnmounted) wrapper.unmount();
    }
    for (const root of roots.splice(0)) render(null, root);
    await flush();
    for (const [type, handler, options] of added.mock.calls) {
      if (String(type).startsWith('vitepress-mermaid:')) {
        document.removeEventListener(type, handler, options);
      }
    }
    _resetFullscreenManager();
    vi.useRealTimers();
  });

  it('staticSuccessEvent delivers a ready SVG to the parent', async () => {
    const { events } = eventPage();
    await flush();
    expect(events).toHaveLength(1);
    expect(events[0]!.target.matches('.mermaid-wrapper')).toBe(true);
    expect(events[0]!.detail.success).toBe(true);
    expect(events[0]!.detail.id).toBeTruthy();
    expect(events[0]!.svg).toBe(true);
  });

  it('staticFailureThenRecovery delivers the error and a later successful attempt', async () => {
    const error = new Error('invalid graph');
    mermaid.run.mockRejectedValue(error);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { events, renderer } = eventPage();
    await flush();
    expect(events.length).toBeGreaterThan(0);
    expect(
      events.every(
        (event) => !event.detail.success && event.detail.error === error,
      ),
    ).toBe(true);
    mermaid.run.mockImplementation(async ({ nodes }: { nodes: Element[] }) => {
      nodes[0]!.innerHTML = '<svg><text>recovered</text></svg>';
    });
    renderer.setConfig({ theme: 'dark' });
    await flush();
    expect(events.at(-1)!.detail.success).toBe(true);
    expect(events.at(-1)!.svg).toBe(true);
  });

  it('eventsStayWithOwnWrapper for multiple static diagrams', async () => {
    const { events } = eventPage(2);
    await flush();
    expect(events).toHaveLength(2);
    expect(new Set(events.map((event) => event.target)).size).toBe(2);
    expect(new Set(events.map((event) => event.detail.id)).size).toBe(2);
    expect(
      events.every((event) =>
        event.target.querySelector(`[id="${event.detail.id}"]`),
      ),
    ).toBe(true);
  });

  it('themeRerenderEmitsAgain from the same wrapper', async () => {
    const { events, renderer } = eventPage();
    await flush();
    renderer.setConfig({ theme: 'dark' });
    await flush();
    expect(events).toHaveLength(2);
    expect(events[1]!.target).toBe(events[0]!.target);
    expect(events[1]!.detail.id).toBe(events[0]!.detail.id);
    expect(events[1]!.svg).toBe(true);
  });

  it('unmountDuringRenderEmitsNothing after pending work is released', async () => {
    const gate = deferred();
    mermaid.run.mockImplementationOnce(
      async ({ nodes }: { nodes: Element[] }) => {
        await gate.promise;
        nodes[0]!.innerHTML = '<svg></svg>';
      },
    );
    const { page, events } = eventPage();
    await vi.advanceTimersByTimeAsync(200);
    expect(page.querySelector('.mermaid-wrapper')).not.toBeNull();
    page.innerHTML = '';
    await nextTick();
    gate.resolve();
    await flush();
    expect(events).toHaveLength(0);
  });

  it('unmounts programmatic roots when their page is removed', async () => {
    document.body.innerHTML = `<div id="app"><div class="language-mermaid"><pre>${code}</pre></div></div>`;
    MermaidRenderer.getInstance();
    await flush();
    roots.push(...document.querySelectorAll('.mermaid-wrapper'));
    expect(roots).toHaveLength(1);
    document.getElementById('app')!.innerHTML = '';
    await flush();
    mermaid.initialize.mockClear();
    document.dispatchEvent(
      new CustomEvent('vitepress-mermaid:config-updated', {
        detail: { theme: 'dark' },
      }),
    );
    await nextTick();
    expect(mermaid.initialize).not.toHaveBeenCalled();
  });

  it('does not register late mounted listeners after unmount during render', async () => {
    const gate = deferred();
    mermaid.run.mockImplementationOnce(
      async ({ nodes }: { nodes: Element[] }) => {
        await gate.promise;
        nodes[0]!.innerHTML = '<svg></svg>';
      },
    );
    const wrapper = mountDiagram();
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    expect(mermaid.run).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    added.mockClear();
    gate.resolve();
    await flush();
    expect(
      added.mock.calls.filter(([type]) =>
        String(type).startsWith('vitepress-mermaid:'),
      ),
    ).toHaveLength(0);
  });

  it('skips queued work belonging to an unmounted component', async () => {
    const gate = deferred();
    mermaid.run.mockImplementationOnce(async () => {
      await gate.promise;
    });
    mountDiagram();
    await nextTick();
    const removed = mountDiagram();
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    removed.unmount();
    gate.resolve();
    await flush();
    expect(mermaid.run).toHaveBeenCalledTimes(1);
  });

  it('does not register listeners after unmount during the fitted-view frame', async () => {
    const wrapper = mountDiagram();
    await nextTick();
    for (
      let frame = 0;
      frame < 10 && !wrapper.emitted('renderComplete');
      frame++
    ) {
      await vi.advanceTimersByTimeAsync(16);
    }
    expect(wrapper.emitted('renderComplete')).toHaveLength(1);
    wrapper.unmount();
    added.mockClear();
    await flush();
    expect(
      added.mock.calls.filter(([type]) =>
        String(type).startsWith('vitepress-mermaid:'),
      ),
    ).toHaveLength(0);
  });

  it('gives every queued render source text rather than the preceding SVG', async () => {
    const gate = deferred();
    const sources: string[] = [];
    mermaid.run.mockImplementation(async ({ nodes }: { nodes: Element[] }) => {
      sources.push(nodes[0]!.textContent ?? '');
      if (sources.length === 1) await gate.promise;
      nodes[0]!.innerHTML = '<svg><text>rendered graph</text></svg>';
    });
    mountDiagram();
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    document.dispatchEvent(
      new CustomEvent('vitepress-mermaid:config-updated', {
        detail: { theme: 'dark' },
      }),
    );
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    gate.resolve();
    await flush();
    expect(sources).toEqual([code, code]);
  });

  it('keeps the render pipeline serial across route changes', async () => {
    MermaidRenderer.getInstance();
    const gate = deferred();
    mermaid.run.mockImplementationOnce(async () => {
      await gate.promise;
    });
    mountDiagram();
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    document.dispatchEvent(new Event('vitepress:routeChanged'));
    mountDiagram();
    await nextTick();
    await vi.advanceTimersByTimeAsync(0);
    try {
      expect(mermaid.run).toHaveBeenCalledTimes(1);
    } finally {
      gate.resolve();
      await flush();
    }
  });

  it('does not mount queued source nodes from a removed page', async () => {
    document.body.innerHTML = `<div id="app"><div class="language-mermaid"><pre>${code}</pre></div><div class="language-mermaid" id="removed"><pre>${code}</pre></div></div>`;
    MermaidRenderer.getInstance();
    document.dispatchEvent(new Event('vitepress:routeChanged'));
    const removed = document.getElementById('removed')!;
    removed.remove();
    await flush();
    roots.push(
      ...document.querySelectorAll('.mermaid-wrapper'),
      ...removed.querySelectorAll('.mermaid-wrapper'),
    );
    expect(removed.querySelector('.mermaid-wrapper')).toBeNull();
  });

  it('unmounts live diagrams when the renderer is destroyed', async () => {
    document.body.innerHTML = `<div id="app"><div class="language-mermaid"><pre>${code}</pre></div></div>`;
    MermaidRenderer.getInstance();
    await flush();
    roots.push(...document.querySelectorAll('.mermaid-wrapper'));
    MermaidRenderer.resetInstance();
    mermaid.initialize.mockClear();
    document.dispatchEvent(
      new CustomEvent('vitepress-mermaid:config-updated', {
        detail: { theme: 'dark' },
      }),
    );
    await nextTick();
    expect(mermaid.initialize).not.toHaveBeenCalled();
  });

  it('does not restart initialization after the renderer is destroyed', async () => {
    MermaidRenderer.getInstance();
    MermaidRenderer.resetInstance();
    document.body.innerHTML = `<div id="app"><div class="language-mermaid"><pre>${code}</pre></div></div>`;
    await flush();
    roots.push(...document.querySelectorAll('.mermaid-wrapper'));
    expect(mermaid.run).not.toHaveBeenCalled();
  });
});

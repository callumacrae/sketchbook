import { Pane, TabPageApi } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import type { FpsGraphBladeApi } from '@tweakpane/plugin-essentials/dist/types/fps-graph/api/fps-graph';

import type { InitProps } from '../renderers/vanilla';
import type { SketchPlugin } from './interface';
import type ThreePlugin from './three';
import type OverlayPlugin from './webxr-overlay';
import type { WebGLRenderer } from 'three';

export interface InitControlsProps<UserConfig> {
  pane: TabPageApi;
  config: UserConfig;
  actualPane: Pane;
}

export type InitControlsFn<UserConfig> = (
  props: InitControlsProps<UserConfig>
) => void;

function isOverlayPlugin<T, S>(
  plugin: SketchPlugin<T, S>
): plugin is OverlayPlugin<T, S> {
  return plugin.name === 'overlay';
}

function isThreePlugin<T, S>(
  plugin: SketchPlugin<T, S>
): plugin is ThreePlugin<T, S> {
  return plugin.name === 'three';
}

export default class TweakpanePlugin<CanvasState, UserConfig>
  implements SketchPlugin<CanvasState, UserConfig>
{
  readonly name = 'tweakpane';
  hasChanged = false;

  private cb?: InitControlsFn<UserConfig>;

  private pane?: Pane;
  private fpsGraph?: FpsGraphBladeApi;

  constructor(cb?: InitControlsFn<UserConfig>) {
    this.cb = cb;
  }

  onBeforeInit(props: InitProps<CanvasState, UserConfig>) {
    const { userConfig, sketchConfig } = props;

    let renderer: WebGLRenderer | undefined = undefined;
    for (const plugin of sketchConfig.plugins) {
      if (isThreePlugin(plugin) && plugin.renderer) {
        renderer = plugin.renderer;
        break;
      }
    }

    if (sketchConfig.isPreview) return;

    // Store as a string as it has to be copied every time it's used anyway
    const flattenedUserConfig: Record<string, any> = {};
    const flattenUserConfig = (config: Record<string, any>) => {
      for (const [key, value] of Object.entries(config)) {
        if (typeof value === 'object') {
          flattenUserConfig(value);
        } else {
          flattenedUserConfig[key] = value;
        }
      }
    };
    if (userConfig) {
      flattenUserConfig(userConfig);
    }
    const initialUserConfig = JSON.stringify(flattenedUserConfig);

    let container: HTMLElement | undefined = undefined;
    for (const plugin of sketchConfig.plugins) {
      if (isOverlayPlugin(plugin)) {
        const overlayRoot = plugin.getRoot();
        container = document.createElement('div');
        container.className = 'tp-dfwv';
        overlayRoot.appendChild(container);
      }
    }

    const isWindowBig = Math.min(window.innerWidth, window.innerHeight) > 600;
    const storedPref = localStorage.getItem(`closed-${location.pathname}`);
    const pane = new Pane({
      title: 'Controls',
      container,
      expanded:
        !window.frameElement &&
        (isWindowBig || storedPref !== null) &&
        storedPref !== 'true',
    });
    pane.registerPlugin(EssentialsPlugin);
    this.pane = pane;

    pane.on('fold', ({ expanded }) => {
      localStorage.setItem(`closed-${location.pathname}`, String(!expanded));
    });
    const presetName = `preset-${location.pathname}`;
    pane.on('change', () => {
      localStorage.setItem(presetName, JSON.stringify(pane.exportPreset()));
      this.hasChanged = true;
    });

    const tab = pane.addTab({
      pages: [{ title: 'Sketch config' }, { title: 'Performance' }],
    });

    this.fpsGraph = tab.pages[1].addBlade({
      view: 'fpsgraph',
      label: 'FPS',
      lineCount: 2,
    }) as FpsGraphBladeApi;

    if (renderer) {
      tab.pages[1].addMonitor(renderer.info.render, 'triangles');
      tab.pages[1].addMonitor(renderer.info.render, 'calls');
      tab.pages[1].addMonitor(renderer.info.memory, 'textures');
      tab.pages[1].addMonitor(renderer.info.memory, 'geometries');
    }

    if (this.cb) {
      this.cb({ pane: tab.pages[0], config: userConfig, actualPane: pane });
    } else {
      tab.pages[1].selected = true;
    }

    tab.pages[0].addButton({ title: 'Reset' }).on('click', () => {
      pane.importPreset(JSON.parse(initialUserConfig));
    });

    const preset = localStorage.getItem(presetName);
    // TODO: add capture support back
    if (preset /* && !sketchConfig.capture?.enabled */) {
      try {
        pane.importPreset(JSON.parse(preset));
      } catch (err) {
        console.error('Failed to set from preset', err);
      }
    }
  }

  onBeforeFrame() {
    if (this.fpsGraph) {
      this.fpsGraph.begin();
    }
  }

  onFrame() {
    if (this.fpsGraph) {
      this.fpsGraph.end();
    }
  }

  onDispose() {
    if (this.pane) {
      this.pane.dispose();
    }
  }
}

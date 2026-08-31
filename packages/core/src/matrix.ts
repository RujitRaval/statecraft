import type {
  RouteDefinition,
  StateDefinition,
  UIWitnessConfig,
  ViewportDefinition,
} from "./config.js";

/** One configured route, state, viewport, and theme execution coordinate. */
export interface MatrixCell {
  readonly route: RouteDefinition;
  readonly state: StateDefinition;
  readonly theme: string;
  readonly viewport: ViewportDefinition;
  readonly viewportId: string;
}

/** Optional exact-match selections applied while expanding a matrix. */
export interface MatrixFilter {
  readonly routeIds?: readonly string[] | undefined;
  readonly stateIds?: readonly string[] | undefined;
  readonly themes?: readonly string[] | undefined;
  readonly viewportIds?: readonly string[] | undefined;
}

function selected(
  selection: ReadonlySet<string> | undefined,
  value: string,
): boolean {
  return selection === undefined || selection.has(value);
}

/**
 * Expands a validated config into execution cells in deterministic configuration
 * order. Viewports follow ECMAScript property order; filter order and duplicate
 * filter values never reorder or duplicate cells.
 */
export function expandMatrix(
  config: UIWitnessConfig,
  filter: MatrixFilter = {},
): readonly MatrixCell[] {
  const routeIds =
    filter.routeIds === undefined ? undefined : new Set(filter.routeIds);
  const stateIds =
    filter.stateIds === undefined ? undefined : new Set(filter.stateIds);
  const themeIds =
    filter.themes === undefined ? undefined : new Set(filter.themes);
  const viewportIds =
    filter.viewportIds === undefined ? undefined : new Set(filter.viewportIds);
  const selectedThemes = config.themes.filter((theme) =>
    selected(themeIds, theme),
  );
  const selectedViewports = Object.entries(config.viewports).filter(
    ([viewportId]) => selected(viewportIds, viewportId),
  );
  const cells: MatrixCell[] = [];

  for (const route of config.routes) {
    if (!selected(routeIds, route.id)) {
      continue;
    }

    for (const state of route.states) {
      if (!selected(stateIds, state.id)) {
        continue;
      }

      for (const [viewportId, viewport] of selectedViewports) {
        for (const theme of selectedThemes) {
          cells.push({ route, state, theme, viewport, viewportId });
        }
      }
    }
  }

  return cells;
}

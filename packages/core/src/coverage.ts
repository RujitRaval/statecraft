import type { MatrixCell } from "./matrix.js";

/** The minimal execution projection consumed by coverage calculations. */
export interface CoverageObservation {
  readonly passed: boolean;
  readonly routeId: string;
  readonly stateId: string;
  readonly theme: string;
  readonly viewportId: string;
}

/** One coverage numerator, denominator, and percentage from zero through 100. */
export interface CoverageMetric {
  readonly covered: number;
  readonly percentage: number;
  readonly total: number;
}

/** Configured-execution coverage across Statecraft's four MVP dimensions. */
export interface CoverageSummary {
  readonly execution: CoverageMetric;
  readonly responsive: CoverageMetric;
  readonly state: CoverageMetric;
  readonly theme: CoverageMetric;
}

interface ConfiguredCoordinate {
  readonly routeId: string;
  readonly stateId: string;
  readonly theme: string;
  readonly viewportId: string;
}

interface StateGroup {
  hasPassedCell: boolean;
  readonly passedThemes: Set<string>;
  readonly passedViewports: Set<string>;
  readonly themes: Set<string>;
  readonly viewports: Set<string>;
}

function coordinateKey(coordinate: ConfiguredCoordinate): string {
  return JSON.stringify([
    coordinate.routeId,
    coordinate.stateId,
    coordinate.viewportId,
    coordinate.theme,
  ]);
}

function stateKey(coordinate: ConfiguredCoordinate): string {
  return JSON.stringify([coordinate.routeId, coordinate.stateId]);
}

function everyValueIsPresent(
  expected: ReadonlySet<string>,
  actual: ReadonlySet<string>,
): boolean {
  for (const value of expected) {
    if (!actual.has(value)) {
      return false;
    }
  }
  return true;
}

function metric(covered: number, total: number): CoverageMetric {
  const percentage =
    total === 0 ? 0 : Math.round((covered * 10_000) / total) / 100;
  return Object.freeze({ covered, percentage, total });
}

/**
 * Calculates coverage from the configured matrix and observed execution outcomes.
 * Missing observations are uncovered, unconfigured observations are ignored, and
 * duplicate observations pass only when every observation for that cell passed.
 */
export function calculateCoverage(
  cells: readonly MatrixCell[],
  observations: readonly CoverageObservation[],
): CoverageSummary {
  const configured = new Map<string, ConfiguredCoordinate>();

  for (const cell of cells) {
    const coordinate = {
      routeId: cell.route.id,
      stateId: cell.state.id,
      theme: cell.theme,
      viewportId: cell.viewportId,
    };
    configured.set(coordinateKey(coordinate), coordinate);
  }

  const outcomes = new Map<string, boolean>();
  for (const observation of observations) {
    const key = coordinateKey(observation);
    if (!configured.has(key)) {
      continue;
    }

    outcomes.set(key, (outcomes.get(key) ?? true) && observation.passed);
  }

  const groups = new Map<string, StateGroup>();
  let passedExecutions = 0;

  for (const [key, coordinate] of configured) {
    const groupKey = stateKey(coordinate);
    let group = groups.get(groupKey);
    if (group === undefined) {
      group = {
        hasPassedCell: false,
        passedThemes: new Set<string>(),
        passedViewports: new Set<string>(),
        themes: new Set<string>(),
        viewports: new Set<string>(),
      };
      groups.set(groupKey, group);
    }

    group.themes.add(coordinate.theme);
    group.viewports.add(coordinate.viewportId);

    if (outcomes.get(key) === true) {
      passedExecutions += 1;
      group.hasPassedCell = true;
      group.passedThemes.add(coordinate.theme);
      group.passedViewports.add(coordinate.viewportId);
    }
  }

  let coveredStates = 0;
  let responsiveStates = 0;
  let themedStates = 0;

  for (const group of groups.values()) {
    if (group.hasPassedCell) {
      coveredStates += 1;
    }
    if (everyValueIsPresent(group.viewports, group.passedViewports)) {
      responsiveStates += 1;
    }
    if (everyValueIsPresent(group.themes, group.passedThemes)) {
      themedStates += 1;
    }
  }

  const stateTotal = groups.size;
  return Object.freeze({
    execution: metric(passedExecutions, configured.size),
    responsive: metric(responsiveStates, stateTotal),
    state: metric(coveredStates, stateTotal),
    theme: metric(themedStates, stateTotal),
  });
}

import type { MatrixCell } from "@statecraft/core";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type LaunchOptions,
  type Page,
} from "playwright";

/** Playwright primitives and matrix metadata available while one cell runs. */
export interface CellExecutionContext {
  readonly cell: MatrixCell;
  readonly context: BrowserContext;
  readonly page: Page;
}

/** Executes one matrix cell inside its isolated browser context. */
export type CellExecutor<Value> = (
  execution: CellExecutionContext,
) => Promise<Value>;

/** A cell whose callback completed before its context was closed. */
export interface FulfilledCellExecution<Value> {
  readonly cell: MatrixCell;
  readonly status: "fulfilled";
  readonly value: Value;
}

/** A cell whose context setup, callback, or cleanup failed. */
export interface RejectedCellExecution {
  readonly cell: MatrixCell;
  readonly reason: unknown;
  readonly status: "rejected";
}

/** The settled lifecycle outcome for one matrix cell. */
export type CellExecutionOutcome<Value> =
  | FulfilledCellExecution<Value>
  | RejectedCellExecution;

/** Browser launch settings for one programmatic execution run. */
export interface RunExecutionCellsOptions {
  readonly launchOptions?: LaunchOptions;
}

interface CellRun<Value> {
  readonly contextCleanupFailed: boolean;
  readonly outcome: CellExecutionOutcome<Value>;
}

function rejected<Value>(
  cell: MatrixCell,
  reason: unknown,
): CellExecutionOutcome<Value> {
  return Object.freeze({ cell, reason, status: "rejected" });
}

async function runCell<Value>(
  browser: Browser,
  cell: MatrixCell,
  execute: CellExecutor<Value>,
): Promise<CellRun<Value>> {
  let context: BrowserContext | undefined;
  let contextCleanupFailed = false;
  let outcome: CellExecutionOutcome<Value>;

  try {
    context = await browser.newContext({
      viewport: {
        height: cell.viewport.height,
        width: cell.viewport.width,
      },
    });
    const page = await context.newPage();
    const value = await execute(Object.freeze({ cell, context, page }));
    outcome = Object.freeze({ cell, status: "fulfilled", value });
  } catch (reason: unknown) {
    outcome = rejected(cell, reason);
  }

  if (context !== undefined) {
    try {
      await context.close();
    } catch (cleanupReason: unknown) {
      contextCleanupFailed = true;
      const reason =
        outcome.status === "rejected"
          ? new AggregateError(
              [outcome.reason, cleanupReason],
              "Cell execution and browser-context cleanup both failed.",
            )
          : cleanupReason;
      outcome = rejected(cell, reason);
    }
  }

  return { contextCleanupFailed, outcome };
}

/**
 * Runs matrix cells in configured order with one reused healthy browser and one
 * fresh browser context per cell. Cell failures are returned instead of
 * aborting the remaining cells. A browser whose context cannot close is
 * replaced before the next cell; browser launch, replacement, and browser
 * cleanup failures reject.
 */
export async function runExecutionCells<Value>(
  cells: readonly MatrixCell[],
  execute: CellExecutor<Value>,
  options: RunExecutionCellsOptions = {},
): Promise<readonly CellExecutionOutcome<Value>[]> {
  if (cells.length === 0) {
    return Object.freeze([]);
  }

  let browser = await chromium.launch(options.launchOptions);
  let browserNeedsClose = true;
  try {
    const outcomes: CellExecutionOutcome<Value>[] = [];
    for (const [index, cell] of cells.entries()) {
      const run = await runCell(browser, cell, execute);
      outcomes.push(run.outcome);

      if (run.contextCleanupFailed && index < cells.length - 1) {
        browserNeedsClose = false;
        await browser.close();
        browser = await chromium.launch(options.launchOptions);
        browserNeedsClose = true;
      }
    }
    return Object.freeze(outcomes);
  } finally {
    if (browserNeedsClose) {
      await browser.close();
    }
  }
}

#!/usr/bin/env node

import { runCli } from "./command.js";

process.exitCode = await runCli({ args: process.argv.slice(2) });

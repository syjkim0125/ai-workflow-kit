#!/usr/bin/env node
const values = process.argv.slice(2);
if (values.length !== 2 || values.some(value => !value.trim() || !Number.isFinite(Number(value)))) {
  console.error('Usage: app.mjs <number> <number>');
  process.exitCode = 2;
} else console.log(Number(values[0]) + Number(values[1]));

#!/usr/bin/env node

const args = process.argv.slice(2);
process.stdout.write(`${JSON.stringify(args)}\n`);

if (args.slice(0, 3).join(" ") === "d1 migrations apply") {
  process.exit(23);
}

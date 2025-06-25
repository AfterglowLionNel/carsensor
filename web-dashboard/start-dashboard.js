#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const dirIndex = process.argv.indexOf('--dir');
let carDir = '';
if (dirIndex !== -1 && process.argv.length > dirIndex + 1) {
  carDir = process.argv[dirIndex + 1];
}

const env = { ...process.env };
if (carDir) {
  env.REACT_APP_CAR_DIR = carDir;
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const proc = spawn(npm, ['start'], { cwd: __dirname, stdio: 'inherit', env });
proc.on('close', code => process.exit(code));

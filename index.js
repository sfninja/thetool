#!/usr/bin/env node
/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const fs = require('fs');

const runTool = require('./lib/Runner');
const package = require('./package.json');

require('update-notifier')({pkg: package}).notify({isGlobal: true});

function checkOutputFolder(outputFolder) {
  if (!outputFolder)
    outputHelp('Error: please specify output folder');
  if (!fs.existsSync(outputFolder))
    outputHelp('Error: output folder does not exist');
  const stats = fs.statSync(outputFolder);
  if (!stats.isDirectory())
    outputHelp('Error: passed output folder is not a folder');
}

function outputHelp(error) {
  if (error)
    console.log(error);
  console.log('Usage: thetool [options] <command to start node process, e.g. node index.js or npm run test>');
  console.log('');
  console.log('Options:');
  console.log('  -t, --tool [type]               tool type: cpu, memoryallocation, memorysampling, coverage or type');
  console.log('  -o, --output [existing folder]  folder for captured data');
  console.log('  --ondemand                      add startTheTool and stopTheTool to Node context for on-demand profiling');
  console.log('  -V, --version                   output the version number');
  console.log('  -h, --help                      output usage information');
  process.exit(error ? -1 : 0);
}

function outputVersion() {
  console.log(package.version);
  process.exit(0);
}

(async function main() {
  let toolName = '';
  let outputFolder = '';
  let nodeCommandLine = [];
  let ondemand = false;
  const argv = process.argv;
  for (let i = 2; i < argv.length; ++i) {
    const arg = argv[i];
    if (arg === '-V' || arg === '--version')
      outputVersion();
    if (arg === '--help')
      outputHelp();
    if (arg === '-t' || arg === '--tool') {
      toolName = argv[i + 1] || '';
      ++i;
    } else if (arg === '-o' || arg === '--output') {
      outputFolder = argv[i + 1] || '';
      ++i;
    } else if (arg === '--ondemand') {
      ondemand = true;
    } else {
      nodeCommandLine = argv.slice(i);
      break;
    }
  }
  if (nodeCommandLine.length < 1)
    outputHelp('Error: please specify how to start node process');
  const supportedProfiles = new Set(['cpu', 'memorysampling', 'memoryallocation', 'coverage', 'type']);
  if (!supportedProfiles.has(toolName))
    outputHelp('Error: please specify supported tool type using -t option');
  checkOutputFolder(outputFolder);
  await runTool({
    nodeCommandLine,
    toolName,
    ondemand,
    outputFolder
  });
})();

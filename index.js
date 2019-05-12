#!/usr/bin/env node
/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const fs = require('fs');

const runTool = require('./lib/Runner');
const { ReportWriter } = require('./lib/ReportWriter');
const pkg = require('./package.json');

function checkOutputFolder(outputFolder) {
  if (!outputFolder)
    return outputHelp('Error: please specify output folder');
  if (!fs.existsSync(outputFolder))
    return outputHelp('Error: output folder does not exist');
  const stats = fs.statSync(outputFolder);
  if (!stats.isDirectory())
    return outputHelp('Error: passed output folder is not a folder');
  return 0;
}

function outputHelp(error) {
  if (error)
    console.error(error);
  console.log('Usage: thetool [options] <command to start node process, e.g. node index.js or npm run test>');
  console.log('');
  console.log('Options:');
  console.log('  -t, --tool [type]               tool type: cpu, memoryallocation, memorysampling, coverage or type');
  console.log('  -o, --output [existing folder]  folder for captured data');
  console.log('  --ondemand                      add startTheTool and stopTheTool to Node context for on-demand profiling');
  console.log('  -V, --version                   output the version number');
  console.log('  -h, --help                      output usage information');
  return error ? -1 : 0;
}

function outputVersion() {
  console.log(pkg.version);
  return 0;
}

async function main(argv) {
  let toolName = '';
  let outputFolder = '';
  let nodeCommandLine = [];
  let ondemand = false;
  for (let i = 0; i < argv.length; ++i) {
    const arg = argv[i];
    if (arg === '-V' || arg === '--version')
      return outputVersion();
    if (arg === '--help')
      return outputHelp();
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
    return outputHelp('Error: please specify how to start node process');
  const supportedProfiles = new Set(['cpu', 'memorysampling', 'memoryallocation', 'coverage', 'type']);
  if (!supportedProfiles.has(toolName))
    return outputHelp('Error: please specify supported tool type using -t option');
  const code = checkOutputFolder(outputFolder);
  if (code !== 0)
    return code;
  const writer = new ReportWriter(outputFolder);
  await runTool({
    nodeCommandLine,
    toolName,
    ondemand,
    callback: writer.reportEventCallback.bind(writer)
  });
  return 0;
}

if (require.main === module) {
  require('update-notifier')({pkg}).notify({isGlobal: true});
  main(process.argv.slice(2)).then(process.exit);
} else {
  module.exports = main;
}

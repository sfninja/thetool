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

function checkOutputFolder(program) {
  const output = program.output;
  if (!output) {
    console.log('Error: please specify output folder');
    program.outputHelp();
    process.exit(-1);
  }
  if (!fs.existsSync(output)) {
    console.log('Error: output folder does not exist');
    program.outputHelp();
    process.exit(-1);
  }
  const stats = fs.statSync(output);
  if (!stats.isDirectory()) {
    console.log('Error: passed output folder is not a folder');
    program.outputHelp();
    process.exit(-1);
  }
}

(async function main() {
  const program = require('commander');
  program
    .version(package.version)
    .usage('[options] <command to start node process, e.g. node index.js or npm run test>')
    .option('-t, --tool [type]', 'tool type: cpu, memoryallocation, memorysampling, coverage or type')
    .option('-o, --output [existing folder]', 'folder for captured data')
    .parse(process.argv);
  if (program.args.length < 1) {
    console.log('Error: please specify how to start node process');
    program.outputHelp();
    process.exit(-1);
  }
  const supportedProfiles = new Set(['cpu', 'memorysampling', 'memoryallocation', 'coverage', 'type']);
  if (!supportedProfiles.has(program.tool)) {
    console.log('Error: please specify supported tool type using -t option');
    program.outputHelp();
    process.exit(-1);
  }
  checkOutputFolder(program);
  await runTool({
    nodeCommandLine: program.args,
    toolName: program.tool,
    outputFolder: program.output
  });
})()

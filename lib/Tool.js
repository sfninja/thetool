/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const fs = require('fs');

class MemorySamplingProfiler {
  constructor({connection, filePathPrefix}) {
    this._connection = connection;
    this._fileNamePrefix = filePathPrefix;
  }

  before() {
    return this._connection.HeapProfiler.startSampling();
  }

  async after() {
    const data = await this._connection.HeapProfiler.stopSampling();
    const filename = this._fileNamePrefix + '.heapprofile';
    await new Promise(resolve => fs.writeFile(filename, JSON.stringify(data.profile), 'utf8', resolve));

    console.log('Sampling heap profile recorded: ' + filename);
    console.log('You can use Chrome DevTools Memory tab to load and analyze it.');
  }
};

class MemoryAllocationProfiler {
  constructor({connection, filePathPrefix}) {
    this._connection = connection;
    this._fileNamePrefix = filePathPrefix;
  }

  before() {
    return this._connection.HeapProfiler.startTrackingHeapObjects({ trackAlocations: false});
  }

  async after() {
    let data = '';
    this._connection.HeapProfiler.addHeapSnapshotChunk((m) => data += m.chunk);
    await this._connection.HeapProfiler.stopTrackingHeapObjects();
    const filename = this._fileNamePrefix + '.heaptimeline';
    await new Promise(resolve => fs.writeFile(filename, data, 'utf8', resolve));

    console.log('Allocation heap profile recorded: ' + filename);
    console.log('You can use Chrome DevTools Memory tab to load and analyze it.');
  }
};

class CoverageProfiler {
  constructor({connection, filePathPrefix}) {
    this._connection = connection;
    this._fileNamePrefix = filePathPrefix;
  }

  async before() {
    await this._connection.Profiler.enable();
    await this._connection.Profiler.startPreciseCoverage();
  }

  async after() {
    const data = await this._connection.Profiler.takePreciseCoverage();
    await this._connection.Profiler.stopPreciseCoverage();

    const filename = this._fileNamePrefix + '.json';
    await new Promise(resolve => fs.writeFile(filename, JSON.stringify(data), 'utf8', resolve));

    console.log('Coverage profile recorded: ' + filename);
    console.log('You can use c8 npm package to analyze this data, put file with data to ./coverage/tmp and run \'c8 report\'');
  }
};

class CPUProfiler {
  constructor({connection, filePathPrefix}) {
    this._connection = connection;
    this._fileNamePrefix = filePathPrefix;
  }

  async before() {
    await this._connection.Profiler.enable();
    await this._connection.Profiler.start();
  }

  async after() {
    const data = await this._connection.Profiler.stop();

    const filename = this._fileNamePrefix + '.cpuprofile';
    await new Promise(resolve => fs.writeFile(filename, JSON.stringify(data.profile), 'utf8', resolve));

    console.log('CPU profile recorded: ' + filename);
    console.log('You can use Chrome DevTools Performance tab to load and analyze it.');
  }
};

class TypeProfiler {
  constructor({connection, filePathPrefix}) {
    this._connection = connection;
    this._fileNamePrefix = filePathPrefix;
  }

  async before() {
    await this._connection.Profiler.enable();
    await this._connection.Profiler.startTypeProfile();
  }

  async after() {
    const data = await this._connection.Profiler.takeTypeProfile();
    await this._connection.Profiler.stopTypeProfile();

    const filename = this._fileNamePrefix + '.typeprofile';
    await new Promise(resolve => fs.writeFile(filename, JSON.stringify(data), 'utf8', resolve));

    console.log('Type profile recorded: ' + filename);
    console.log('Unfortunately there is no nice visualization tool yet. Please build one and add it here.');
  }
};

function createTool(name, options) {
  if (name === 'memorysampling')
    return new MemorySamplingProfiler(options);
  if (name === 'memoryallocation')
    return new MemoryAllocationProfiler(options);
  if (name === 'coverage')
    return new CoverageProfiler(options);
  if (name === 'cpu')
    return new CPUProfiler(options);
  if (name === 'type')
    return new TypeProfiler(options);
}

module.exports = createTool;

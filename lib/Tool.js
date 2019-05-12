/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const fs = require('fs');

let lastId = 0;

class Tool {
  constructor({connection, filePathPrefix}) {
    this._connection = connection;
    this._fileNamePrefix = filePathPrefix;
    this._running = 0;
    this._currentId = 0;
  }

  async before() {
    ++this._running;
    if (this._running === 1) {
      this._currentId = ++lastId;
      await this._beforeImpl();
    }
  }

  async after() {
    --this._running;
    if (this._running === 0) {
      await this._afterImpl();
      this._currentId = 0;
    }
  }

  filename(extension) {
    return this._fileNamePrefix + `_${this._currentId}.` + extension;
  }
}

class MemorySamplingProfiler extends Tool {
  constructor(options) {
    super(options);
  }

  _beforeImpl() {
    return this._connection.send('HeapProfiler.startSampling');
  }

  async _afterImpl() {
    const data = await this._connection.send('HeapProfiler.stopSampling');
    const filename = this.filename('heapprofile');
    await new Promise(resolve => fs.writeFile(filename, JSON.stringify(data.profile), 'utf8', resolve));
    console.log('Sampling heap profile recorded: ' + filename);
    console.log('You can use Chrome DevTools Memory tab to load and analyze it.');
  }
}

class MemoryAllocationProfiler extends Tool {
  constructor(options) {
    super(options);
  }

  _beforeImpl() {
    return this._connection.send('HeapProfiler.startTrackingHeapObjects', { trackAlocations: false});
  }

  async _afterImpl() {
    let data = '';
    this._connection.on('HeapProfiler.addHeapSnapshotChunk', m => data += m.chunk);
    await this._connection.send('HeapProfiler.stopTrackingHeapObjects');
    const filename = this.filename('heaptimeline');
    await new Promise(resolve => fs.writeFile(filename, data, 'utf8', resolve));

    console.log('Allocation heap profile recorded: ' + filename);
    console.log('You can use Chrome DevTools Memory tab to load and analyze it.');
  }
}

class CoverageProfiler extends Tool {
  constructor(options) {
    super(options);
  }

  async _beforeImpl() {
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.startPreciseCoverage');
  }

  async _afterImpl() {
    const data = await this._connection.send('Profiler.takePreciseCoverage');
    await this._connection.send('Profiler.stopPreciseCoverage');

    const filename = this.filename('coverage');
    await new Promise(resolve => fs.writeFile(filename, JSON.stringify(data), 'utf8', resolve));

    console.log('Coverage profile recorded: ' + filename);
    console.log('You can use c8 npm package to analyze this data, put file with data to ./coverage/tmp and run \'c8 report\'');
  }
}

class CPUProfiler extends Tool {
  constructor(options) {
    super(options);
  }

  async _beforeImpl() {
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.start');
  }

  async _afterImpl() {
    const data = await this._connection.send('Profiler.stop');

    const filename = this.filename('cpuprofile');
    await new Promise(resolve => fs.writeFile(filename, JSON.stringify(data.profile), 'utf8', resolve));

    console.log('CPU profile recorded: ' + filename);
    console.log('You can use Chrome DevTools Performance tab to load and analyze it.');
  }
}

class TypeProfiler extends Tool {
  constructor(options) {
    super(options);
  }

  async _beforeImpl() {
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.startTypeProfile');
  }

  async _afterImpl() {
    const data = await this._connection.send('Profiler.takeTypeProfile');
    await this._connection.send('Profiler.stopTypeProfile');

    const filename = this.filename('typeprofile');
    await new Promise(resolve => fs.writeFile(filename, JSON.stringify(data), 'utf8', resolve));

    console.log('Type profile recorded: ' + filename);
    console.log('Unfortunately there is no nice visualization tool yet. Please build one and add it here.');
  }
}

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

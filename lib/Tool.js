/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

class MemorySamplingProfiler {
  constructor(connection, toolOptions) {
    this._connection = connection;
    this._samplingInterval = toolOptions.get('samplingInterval') * 1.0 || 32768;
  }

  before(reporter) {
    reporter.reportStart('heapprofile', 'You can use Chrome DevTools Memory tab to load and analyze it.');
    return this._connection.send('HeapProfiler.startSampling', {
      samplingInterval: this._samplingInterval
    });
  }

  async after(reporter) {
    const data = await this._connection.send('HeapProfiler.stopSampling');
    reporter.reportChunk(JSON.stringify(data.profile));
    reporter.reportFinish();
  }
}

class MemoryAllocationProfiler {
  constructor(connection, toolOptions) {
    this._connection = connection;
    this._listener = null;
  }

  before(reporter) {
    reporter.reportStart('heaptimeline', 'You can use Chrome DevTools Memory tab to load and analyze it.');
    this._listener = m => reporter.reportChunk(m.chunk);
    this._connection.on('HeapProfiler.addHeapSnapshotChunk', this._listener);
    return this._connection.send('HeapProfiler.startTrackingHeapObjects', { trackAlocations: false});
  }

  async after(reporter) {
    await this._connection.send('HeapProfiler.stopTrackingHeapObjects');
    this._connection.removeListener('HeapProfiler.addHeapSnapshotChunk', this._listener);
    this._listener = null;
    reporter.reportFinish();
  }
}

class CoverageProfiler {
  constructor(connection, toolOptions) {
    this._connection = connection;
  }

  async before(reporter) {
    reporter.reportStart('coverage', 'You can use c8 npm package to analyze this data, put file with data to ./coverage/tmp and run \'c8 report\'');
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.startPreciseCoverage');
  }

  async after(reporter) {
    const data = await this._connection.send('Profiler.takePreciseCoverage');
    await this._connection.send('Profiler.stopPreciseCoverage');
    reporter.reportChunk(JSON.stringify(data));
    reporter.reportFinish();
  }
}

class CPUProfiler {
  constructor(connection, toolOptions) {
    this._connection = connection;
  }

  async before(reporter) {
    reporter.reportStart('cpuprofile', 'You can use Chrome DevTools Performance tab to load and analyze it.');
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.start');
  }

  async after(reporter) {
    const data = await this._connection.send('Profiler.stop');
    reporter.reportChunk(JSON.stringify(data.profile));
    reporter.reportFinish();
  }
}

class TypeProfiler {
  constructor(connection, toolOptions) {
    this._connection = connection;
  }

  async before(reporter) {
    reporter.reportStart('typeprofile', 'Unfortunately there is no nice visualization tool yet. Please build one and add it here.');
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.startTypeProfile');
  }

  async after(reporter) {
    const data = await this._connection.send('Profiler.takeTypeProfile');
    await this._connection.send('Profiler.stopTypeProfile');
    reporter.reportChunk(JSON.stringify(data));
    reporter.reportFinish();
  }
}

class Tracing {
  constructor(connection, toolOptions) {
    this._connection = connection;
    this._recordMode = toolOptions.get('recordMode') || 'recordAsMuchAsPossible';
    this._includedCategories = (toolOptions.get('includedCategories') || '').split(',');
    const categories = this._includedCategories.filter(category => !category.startsWith('disabled-by-default-'));
    this._includedCategories.push(...categories.map(category => 'disabled-by-default-' + category));
    this._getCategories = toolOptions.get('getCategories') || false;
    this._listener = null;
  }

  async before(reporter) {
    if (this._getCategories) {
      const {categories} = await this._connection.send('NodeTracing.getCategories');
      console.log('Available categories: ', categories);
      return;
    }
    reporter.reportStart('json', 'You can use Chrome DevTools Performance tab to load and analyze it.');
    await this._connection.send('NodeTracing.start', {
      traceConfig: {
        recordMode: this._recordMode,
        includedCategories: this._includedCategories
      }
    });
    let first = true;
    this._listener = message => reportChunk(message.value);
    this._connection.on('NodeTracing.dataCollected', this._listener);
    function reportChunk(value) {
      if (first)
        reporter.reportChunk('[');
      else
        reporter.reportChunk(',');
      first = false;
      reporter.reportChunk(value.map(JSON.stringify).join(','));
    }
  }

  async after(reporter) {
    if (!this._getCategories) {
      await this._connection.send('NodeTracing.stop');
      this._connection.removeListener('NodeTracing.dataCollected', this._listener);
      this._listener = null;
      reporter.reportChunk(']');
      reporter.reportFinish();
    }
  }
}

function createTool(name, toolOptions, connection) {
  if (name === 'memorysampling')
    return new MemorySamplingProfiler(connection, toolOptions);
  if (name === 'memoryallocation')
    return new MemoryAllocationProfiler(connection, toolOptions);
  if (name === 'coverage')
    return new CoverageProfiler(connection, toolOptions);
  if (name === 'cpu')
    return new CPUProfiler(connection, toolOptions);
  if (name === 'type')
    return new TypeProfiler(connection, toolOptions);
  if (name === 'tracing')
    return new Tracing(connection, toolOptions);
}

module.exports = createTool;

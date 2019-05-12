/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const fs = require('fs');
const path = require('path');

const GREEN_OPEN = '\u001B[32m';
const GREEN_CLOSE = '\u001B[39m';

class ReportWriter {
  constructor(outputFolder) {
    this._outputFolder = outputFolder;
    this._reports = new Map();
  }

  async reportEventCallback(event, data) {
    if (event === 'reportStart') {
      const report = {
        filename: path.join(this._outputFolder, `${data.id}_${Date.now()}.${data.suggestedFileExtension}`),
        userHint: data.userHint
      };
      this._reports.set(data.id, report);
    } else if (event === 'reportChunk') {
      const report = this._reports.get(data.id);
      await new Promise(resolve => fs.appendFile(report.filename, data.chunk, 'utf8', resolve));
    } else if (event === 'reportFinish') {
      const report = this._reports.get(data.id);
      this._reports.delete(data.id);
      console.log(GREEN_OPEN + 'thetool> Report captured in ' + report.filename);
      console.log('thetool> ' + report.userHint + GREEN_CLOSE);
    }
  }
}

module.exports = { ReportWriter };

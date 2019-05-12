/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const main = require('../index.js');

test('empty args', async() => {
  const messages = [];
  const errors = [];
  jest.spyOn(global.console, 'log').mockImplementation(messages.push.bind(messages));
  jest.spyOn(global.console, 'error').mockImplementation(errors.push.bind(errors));
  expect(await main([])).toBe(-1);
  jest.restoreAllMocks();
  expect(errors.length).toBe(1);
  expect(messages[0].startsWith('Usage:')).toBe(true);
});

test('--help', async() => {
  const messages = [];
  const errors = [];
  jest.spyOn(global.console, 'log').mockImplementation(messages.push.bind(messages));
  jest.spyOn(global.console, 'error').mockImplementation(errors.push.bind(errors));
  expect(await main(['--help'])).toBe(0);
  jest.restoreAllMocks();
  expect(errors.length).toBe(0);
  expect(messages[0].startsWith('Usage:')).toBe(true);
});

test('--version', async() => {
  const messages = [];
  const errors = [];
  jest.spyOn(global.console, 'log').mockImplementation(messages.push.bind(messages));
  jest.spyOn(global.console, 'error').mockImplementation(errors.push.bind(errors));
  expect(await main(['--version'])).toBe(0);
  jest.restoreAllMocks();
  expect(errors.length).toBe(0);
  expect(messages.length).toBe(1);
});

test('unknown tool', async() => {
  const messages = [];
  const errors = [];
  jest.spyOn(global.console, 'log').mockImplementation(messages.push.bind(messages));
  jest.spyOn(global.console, 'error').mockImplementation(errors.push.bind(errors));
  expect(await main(['-t', 'fix-all-bugs', 'node', '-e', ''])).toBe(-1);
  jest.restoreAllMocks();
  expect(errors.length).toBe(1);
  expect(errors[0]).toBe('Error: please specify supported tool type using -t option');
  expect(messages[0].startsWith('Usage:')).toBe(true);
});

test('bad output folder', async() => {
  const messages = [];
  const errors = [];
  jest.spyOn(global.console, 'log').mockImplementation(messages.push.bind(messages));
  jest.spyOn(global.console, 'error').mockImplementation(errors.push.bind(errors));
  expect(await main(['-t', 'cpu', '-o', '/unexist/folder/a/b/c', 'node', '-e', ''])).toBe(-1);
  jest.restoreAllMocks();
  expect(errors.length).toBe(1);
  expect(errors[0]).toBe('Error: output folder does not exist');
  expect(messages[0].startsWith('Usage:')).toBe(true);
});

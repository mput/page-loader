import fs from 'fs';
import os from 'os';
import path from 'path';
import nock from 'nock';
import axios from 'axios';
import httpAdapter from 'axios/lib/adapters/http';
import pageLoader from '../src';

axios.defaults.adapter = httpAdapter;
const fixturesPath = '__tests__/fixtures/';

describe('Page loader', () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-'));

  test('should download page to folder', () => {
    const pageURL = 'https://en.wikipedia.org';
    const pathName = '/wiki/Main_Page';
    const fileName = 'en-wikipedia-org-wiki-Main_Page.html';
    nock(pageURL).get(pathName).replyWithFile(200, path.join(fixturesPath, fileName));

    expect.assertions(1);
    return pageLoader(`${pageURL}${pathName}`, testDir).then(() => {
      const fixturesFileBuf = fs.readFileSync(path.join(fixturesPath, fileName));
      const resultFileBuf = fs.readFileSync(path.join(testDir, fileName));
      expect(fixturesFileBuf.equals(resultFileBuf)).toBeTruthy();
    });
  });
});

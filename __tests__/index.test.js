import fs from 'mz/fs';
import os from 'os';
import path from 'path';
import nock from 'nock';
import axios from 'axios';
import httpAdapter from 'axios/lib/adapters/http';
import loadPage from '../src';

axios.defaults.adapter = httpAdapter;
const fixturesPath = '__tests__/fixtures/';

describe('Test page with content', () => {
  const pagePath = path.join(fixturesPath, 'test-page-1');
  const filesPath = path.join(pagePath, 'files');
  const pageURL = 'https://test-page.cat';
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-loader-'));
    console.log(tempDir);
  });

  test('Server return all links', async () => {
    nock(pageURL).get('/').replyWithFile(200, path.join(pagePath, 'test-page.html'));
    nock(pageURL).get('/files/main.css').replyWithFile(200, path.join(filesPath, 'main.css'));
    nock(pageURL).get('/files/main.json').replyWithFile(200, path.join(filesPath, 'main.json'));
    nock(pageURL).get('/files/ugly-cat.jpg').replyWithFile(200, path.join(filesPath, 'ugly-cat.jpg'));
    nock(pageURL).get('/files/cat-catcher.gif').delay(300).replyWithFile(200, path.join(filesPath, 'cat-catcher.gif'));
    nock('https://maxcdn.bootstrapcdn.com').get('/bootstrap/4.0.0-alpha.6/css/bootstrap.min.css').replyWithFile(200, path.join(filesPath, 'bootstrap.min.css'));
    nock('https://visualhunt.com').get('/photos/l/7/animated-cat-cat-windows.jpg').delay(300).replyWithFile(200, path.join(filesPath, 'ugly-cat.jpg'));

    await loadPage(pageURL, tempDir);
    const resultPage = await fs.readFile(path.join(tempDir, 'test-page-cat.html'), 'utf8');
    const fixtureResultPage = await fs.readFile(path.join(pagePath, 'result_pages', 'all-links-test-page-cat.html'), 'utf8');
    expect(resultPage).toEqual(fixtureResultPage);
    const isFileExist = await fs.exists(path.join(tempDir, 'test-page-cat_file/maxcdn-bootstrapcdn-com-bootstrap-4-0-0-alpha-6-css-bootstrap-min.css'));
    expect(isFileExist).toBeTruthy();
  });

  test('Server return only one link, dir already exist', async () => {
    nock(pageURL).get('/').replyWithFile(200, path.join(pagePath, 'test-page.html'));
    nock('https://maxcdn.bootstrapcdn.com').get('/bootstrap/4.0.0-alpha.6/css/bootstrap.min.css').replyWithFile(200, path.join(filesPath, 'bootstrap.min.css'));
    nock(pageURL)
      .get('/files/main.css')
      .reply(404)
      .get('/files/main.json')
      .reply(500)
      .get('/files/ugly-cat.jpg')
      .reply(404)
      .get('/files/cat-catcher.gif')
      .reply(404);
    nock('https://visualhunt.com').get('/photos/l/7/animated-cat-cat-windows.jpg').reply(404);

    await fs.mkdir(path.join(tempDir, './test-page-cat_file'));
    await loadPage(pageURL, tempDir);
    const resultPage = await fs.readFile(path.join(tempDir, 'test-page-cat.html'), 'utf8');
    const fixtureResultPage = await fs.readFile(path.join(pagePath, 'result_pages', 'one-links-test-page-cat.html'), 'utf8');
    expect(resultPage).toEqual(fixtureResultPage);
  });

  test('Directory not exist', async () => {
    nock(pageURL).get('/').replyWithFile(200, path.join(pagePath, 'test-page.html'));
    await expect(loadPage(pageURL, path.join(tempDir, '/wrong-dir'))).rejects.toThrow('ENOENT');
  });
});

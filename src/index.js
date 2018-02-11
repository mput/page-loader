import path from 'path';
import fs from 'mz/fs';
import axios from 'axios';
import url from 'url';
import cheerio from 'cheerio';
import debug from 'debug';
import Listr from 'listr';

const log = debug('page-loader');

const isUrlAbsolute = (link) => {
  const parsedUrl = url.parse(link);
  return (parsedUrl.protocol && parsedUrl.host);
};

const buildName = (fileUrl, ending) => {
  const parsedUrl = url.parse(fileUrl);
  const pageName = `${parsedUrl.host}${parsedUrl.pathname === '/' ? '' : parsedUrl.pathname}`.replace(/\W/g, '-');
  return `${pageName}${ending}`;
};

const getFileNameAndExtension = (fileUrl) => {
  const parsedUrl = url.parse(fileUrl);
  const shortUrl = url.format({ ...parsedUrl, search: null, hash: null });
  const dotIndex = shortUrl.lastIndexOf('.') > -1 ? shortUrl.lastIndexOf('.') : shortUrl.length;
  const name = shortUrl.slice(0, dotIndex);
  const preExt = shortUrl.slice(dotIndex, shortUrl.length);
  const ext = preExt.slice(0, preExt.indexOf('/') > -1 ? preExt.indexOf('/') - 1 : preExt.length);
  return { name, ext };
};

const getRelativeLinks = (pageContent) => {
  const $ = cheerio.load(pageContent);
  const tags = [{ tag: 'link', linkAtr: 'href' },
    { tag: 'script', linkAtr: 'src' },
    { tag: 'img', linkAtr: 'src' }];
  const links = new Set();
  tags.forEach(({ tag, linkAtr }) => {
    $(tag).each((i, elm) => {
      const link = $(elm).attr(linkAtr);
      if (link && !isUrlAbsolute(link)) {
        links.add(link);
      }
    });
  });
  return Array.from(links);
};

const loadFile = (link, baseURL, workDir, fileDir) => {
  const absURL = url.resolve(baseURL, link);
  const { name, ext } = getFileNameAndExtension(absURL);
  const responseType = ['.png', '.jpg', '.ico', '.gif'].includes(ext) ? 'arraybuffer' : 'json';
  const fileName = buildName(name, ext);
  const absoluteFilePath = path.resolve(workDir, fileDir, fileName);
  const relativeFilePath = path.join(fileDir, fileName);
  const task = new Listr([
    {
      title: absURL,
      task: () => axios({ url: absURL, responseType })
        .then(({ data }) => {
          log('Writing file -  %s \nwith name - %s', link, absoluteFilePath);
          return fs.writeFile(absoluteFilePath, data);
        }),
    }]);
  return task.run()
    .then(() => ({ link, relativeFilePath, downloaded: true }))
    .catch(() => ({ link, downloaded: false }));
};

const createFolderAndLoadFiles = (links, baseUrl, dir, folderName) =>
  fs.mkdir(path.resolve(dir, folderName))
    .then(null, (err) => {
      if (err.code === 'EEXIST') {
        log('%s', err);
        return;
      }
      throw err;
    }).then(() => Promise.all(links.map(link => loadFile(link, baseUrl, dir, folderName))));

const loadPage = (pageUrl, dir = './') => {
  let pageContent;
  const fileName = buildName(pageUrl, '.html');
  const folderName = buildName(pageUrl, '_file');
  const filePath = path.resolve(dir, fileName);

  return axios.get(pageUrl)
    .then((res) => {
      log('Received data from page %s', pageUrl);
      pageContent = res.data;
      const links = getRelativeLinks(pageContent);
      return createFolderAndLoadFiles(links, pageUrl, dir, folderName);
    })
    .then((downloaderResults) => {
      downloaderResults.filter(res => res.downloaded).forEach((res) => {
        pageContent = pageContent.replace(new RegExp(res.link, 'g'), res.relativeFilePath);
      });
      log('Writing file %s', filePath);
      return fs.writeFile(filePath, pageContent);
    })
    .then(() => fileName);
};

export default loadPage;

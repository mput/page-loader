import path from 'path';
import axios from 'axios';
import fs from 'mz/fs';
import { URL } from 'url';
import cheerio from 'cheerio';

const buildName = (url, ending) => {
  const myURL = new URL(url);
  const pageName = `${myURL.host}${myURL.pathname === '/' ? '' : myURL.pathname}`.replace(/\W/g, '-');
  return `${pageName}${ending}`;
};

const getFileNameAndExtension = (url) => {
  const questionMarkSymIndex = (url.indexOf('?') > -1) ? url.indexOf('?') : url.length;
  const hashSymIndex = (url.indexOf('#') > -1) ? url.indexOf('#') : url.length;
  const indexOfFirstDelimiter = (questionMarkSymIndex <= hashSymIndex) ?
    questionMarkSymIndex : hashSymIndex;
  const base = url.slice(0, indexOfFirstDelimiter);
  const dotSymIndex = base.lastIndexOf('.');
  const name = base.slice(0, dotSymIndex);
  const ext = base.slice(dotSymIndex, base.length);
  return { name, ext };
};

const getLinks = (pageContent) => {
  const $ = cheerio.load(pageContent);
  const tags = [{ tag: 'link', linkAtr: 'href' },
    { tag: 'script', linkAtr: 'src' },
    { tag: 'img', linkAtr: 'src' }];
  const links = new Set();
  tags.forEach(({ tag, linkAtr }) => {
    $(tag)
      .filter((i, elm) => !!$(elm).attr(linkAtr))
      .each((i, elm) => {
        const link = $(elm).attr(linkAtr);
        links.add(link);
      });
  });
  return Array.from(links);
};

const loadFile = (url, baseURL, workDir, fileDir) => {
  const absoluteUrl = new URL(url, baseURL).href;
  const { name, ext } = getFileNameAndExtension(absoluteUrl);
  const responseType = ['.png', '.jpg', '.ico', '.gif'].includes(ext) ? 'arraybuffer' : 'json';
  const fileName = buildName(name, ext);
  const absoluteFilePath = path.resolve(workDir, fileDir, fileName);
  const relativeFilePath = path.join(fileDir, fileName);
  return axios({ url: absoluteUrl, responseType })
    .then(({ data }) => fs.writeFile(absoluteFilePath, data))
    .then(() => ({ url, relativeFilePath, downloaded: true }))
    .catch(() => {
      console.error('Can\'t load - ', absoluteUrl);
      return { url, downloaded: false };
    });
};

const loadPage = (url, dir = './') => {
  let pageContent;
  return axios.get(url)
    .then((res) => {
      pageContent = res.data;
      const links = getLinks(pageContent);
      const folderName = buildName(url, '_file');
      fs.mkdir(path.resolve(dir, folderName)).catch((err) => {
        throw new Error(err);
      });
      return Promise.all(links.map(link => loadFile(link, url, dir, folderName)));
    })
    .then((downloaderResults) => {
      downloaderResults.filter(res => res.downloaded).forEach((res) => {
        pageContent = pageContent.replace(new RegExp(res.url, 'g'), res.relativeFilePath);
      });
      const fileName = buildName(url, '.html');
      const filePath = path.resolve(dir, fileName);
      return fs.writeFile(filePath, pageContent);
    });
};

export default loadPage;


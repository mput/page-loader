import path from 'path';
import fs from 'mz/fs';
import axios from 'axios';
import url from 'url';
import cheerio from 'cheerio';
import debug from 'debug';

const log = debug('page-loader');
const logProd = debug('page-loader*');

const buildName = (fileUrl, ending) => {
  const parsedUrl = url.parse(fileUrl);
  const pageName = `${parsedUrl.host}${parsedUrl.pathname === '/' ? '' : parsedUrl.pathname}`.replace(/\W/g, '-');
  return `${pageName}${ending}`;
};

const getFileNameAndExtension = (fileUrl) => {
  const parsedUrl = url.parse(fileUrl);
  const shortUrl = url.format({ ...parsedUrl, search: null, hash: null });
  const dotIndex = shortUrl.lastIndexOf('.') > -1 ? shortUrl.lastIndexOf('.') : shortUrl.length;
  return { name: shortUrl.slice(0, dotIndex), ext: shortUrl.slice(dotIndex, shortUrl.length) };
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

const loadFile = (link, baseURL, workDir, fileDir) => {
  const absURL = url.resolve(baseURL, link);
  const { name, ext } = getFileNameAndExtension(absURL);
  const responseType = ['.png', '.jpg', '.ico', '.gif'].includes(ext) ? 'arraybuffer' : 'json';
  const fileName = buildName(name, ext);
  const absoluteFilePath = path.resolve(workDir, fileDir, fileName);
  const relativeFilePath = path.join(fileDir, fileName);
  return axios({ url: absURL, responseType })
    .then(({ data }) => {
      log('Writing file -  %s \nwith name - %s', link, absoluteFilePath);
      return fs.writeFile(absoluteFilePath, data);
    })
    .then(() => ({ link, relativeFilePath, downloaded: true }))
    .catch(() => {
      logProd('Can\'t load- %s', absURL);
      return { link, downloaded: false };
    });
};

const loadPage = (pageUrl, dir = './') => {
  let pageContent;
  return axios.get(pageUrl)
    .then((res) => {
      log('Received data from page %s', pageUrl);
      pageContent = res.data;
      const links = getLinks(pageContent);
      const folderName = buildName(pageUrl, '_file');
      fs.mkdir(path.resolve(dir, folderName)).catch((err) => {
        if (err.code === 'EEXIST') {
          logProd(err);
          return;
        }
        throw new Error(err);
      });
      return Promise.all(links.map(link => loadFile(link, pageUrl, dir, folderName)));
    })
    .then((downloaderResults) => {
      downloaderResults.filter(res => res.downloaded).forEach((res) => {
        pageContent = pageContent.replace(new RegExp(res.link, 'g'), res.relativeFilePath);
      });
      const fileName = buildName(pageUrl, '.html');
      const filePath = path.resolve(dir, fileName);
      log('Writing file %s', filePath);
      return fs.writeFile(filePath, pageContent);
    });
};

export default loadPage;


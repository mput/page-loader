import path from 'path';
import axios from 'axios';
import fs from 'mz/fs';
import { URL } from 'url';

const buildPageName = (url) => {
  const myURL = new URL(url);
  const pageName = `${myURL.host}${myURL.pathname === '/' ? '' : myURL.pathname}`.replace(/\W/g, '-');
  return `${pageName}.html`;
};

const pageLoader = (url, dir = './') => axios.get(url)
  .then((res) => {
    const pageContent = res.data;
    const fileName = buildPageName(url);
    const filePath = path.resolve(dir, fileName);
    return fs.writeFile(filePath, pageContent);
  });

export default pageLoader;


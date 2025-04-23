import {
  test,
  expect,
  beforeAll,
  beforeEach,
  describe,
} from 'vitest';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import nock from 'nock';

// Больше ничего в тесты не импортируется!
// https://ru.hexlet.io/blog/posts/how-to-test-code
import pageLoader from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const buildFixturesPath = (...paths) => path.join(__dirname, '..', '__fixtures__', ...paths);
const readFile = (dirpath, filename, isBinary = false) => (
  fsp.readFile(path.join(dirpath, filename), isBinary ? null : 'utf-8')
);

const pageDirname = 'site-com-blog-about_files';
const pageFilename = 'site-com-blog-about.html';
const baseUrl = 'https://site.com';
const pagePath = '/blog/about';
const pageUrl = new URL(pagePath, baseUrl);

let expectedPageContent = '';
let resources = [
  {
    format: 'css',
    urlPath: '/blog/about/assets/styles.css',
    filename: path.join(
      pageDirname,
      'site-com-blog-about-assets-styles.css',
    ),
  },
  {
    format: 'jpg',
    urlPath: '/photos/me.jpg',
    isBinary: true,
    filename: path.join(
      pageDirname,
      'site-com-photos-me.jpg',
    ),
  },
  {
    format: 'js',
    urlPath: '/assets/scripts.js',
    filename: path.join(
      pageDirname,
      'site-com-assets-scripts.js',
    ),
  },
  {
    format: 'html',
    urlPath: '/blog/about',
    filename: path.join(
      pageDirname,
      'site-com-blog-about.html',
    ),
  },
];

const formats = resources.map(({ format }) => format);
const scope = nock(baseUrl).persist();

// Важно отрубить реальные коннекты
nock.disableNetConnect();

beforeAll(async () => {
  const sourcePageContent = await readFile(buildFixturesPath('.'), pageFilename);
  const promises = resources.map((info) => readFile(buildFixturesPath('expected'), info.filename, info.isBinary)
    .then((data) => ({ ...info, data })));

  expectedPageContent = await readFile(buildFixturesPath('expected'), pageFilename);
  resources = await Promise.all(promises);

  scope.get(pagePath).reply(200, sourcePageContent);
  resources.forEach(({ urlPath, data }) => scope.get(urlPath).reply(200, data));
});

describe('negative cases', () => {
  let tmpDirPath = '';
  beforeEach(async () => {
    // На каждый тест своя временная директория (это изоляция!)
    // Чистить не надо, система сама почистит
    tmpDirPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });
  // проверка ошибок сети
  test('load page: no response', async () => {
    await expect(fsp.access(path.join(tmpDirPath, pageFilename)))
      .rejects.toThrow(/ENOENT/);

    const invalidBaseUrl = 'https://badsite.com';
    const expectedError = `getaddrinfo ENOTFOUND ${invalidBaseUrl}`;
    nock(invalidBaseUrl).persist().get('/').replyWithError(expectedError);
    await expect(pageLoader(invalidBaseUrl, tmpDirPath))
      .rejects.toThrow(expectedError);

    await expect(fsp.access(path.join(tmpDirPath, pageFilename)))
      .rejects.toThrow(/ENOENT/);
  });

  // проверка ошибок с сайта
  test.each([404, 500])('load page: status code %s', async (code) => {
    scope.get(`/${code}`).reply(code, '');
    const url = new URL(`/${code}`, baseUrl).toString();
    await expect(pageLoader(url, tmpDirPath))
      .rejects.toThrow(new RegExp(code));
  });

  // проверка ошибок файловой системы
  test('load page: file system errors', async () => {
    const rootDirPath = '/sys';
    await expect(pageLoader(pageUrl.toString(), rootDirPath))
      .rejects.toThrow();

    const filepath = buildFixturesPath(pageFilename);
    await expect(pageLoader(pageUrl.toString(), filepath))
      .rejects.toThrow(/ENOTDIR/);

    const notExistsPath = buildFixturesPath('notExistsPath');
    await expect(pageLoader(pageUrl.toString(), notExistsPath))
      .rejects.toThrow(/ENOENT/);
  });
});

describe('positive cases', () => {
  let tmpDirPath = '';
  beforeAll(async () => {
    tmpDirPath = await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
    await pageLoader(pageUrl.toString(), tmpDirPath);
  });

  // кейс: проверка скачанных файлов
  test('check HTML-page', async () => {
    await expect(fsp.access(path.join(tmpDirPath, pageFilename)))
      .resolves.not.toThrow();

    const actualContent = await readFile(tmpDirPath, pageFilename);
    expect(actualContent).toBe(expectedPageContent.trim());
  });
  test.each(formats)('check .%s-resource', async (format) => {
    const { filename, data, isBinary } = resources.find((content) => content.format === format);

    await expect(fsp.access(path.join(tmpDirPath, pageFilename)))
      .resolves.not.toThrow();

    const actualContent = await readFile(tmpDirPath, filename, isBinary);
    expect(actualContent).toStrictEqual(data);
  });

  // кейс: проверка параметра по умолчанию
  test('download to current workdir', async () => {
    const cwd = await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
    process.chdir(cwd);

    await pageLoader(pageUrl.toString());

    await expect(fsp.access(path.join(cwd, pageFilename)))
      .resolves.not.toThrow();

    const loadedAssets = await fsp.readdir(path.join(cwd, pageDirname))
      .then((filenames) => filenames
        .map((filename) => path.join(pageDirname, filename))
        .sort());
    const expectedAssets = resources.map(({ filename }) => filename).sort();

    expect(loadedAssets).toEqual(expectedAssets);
  });
});

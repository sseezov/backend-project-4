#!/usr/bin/env node

import program from 'commander';

// Библиотека ничего не может печатать на экран. Весь вывод тут.
// https://ru.hexlet.io/blog/posts/skripty-moduli-i-biblioteki
import download from '../index.js';

program
  .description('some description')
  .version('0.0.1')
  // Дефолт задается 4 параметром
  .option('-o --output [dir]', 'output dir', process.cwd())
  .arguments('<url>')
  .action((url) => {
    download(url, program.opts().output)
      .then(({ filepath }) => {
        // По умолчанию код выхода 0, поэтому тут его ставить не надо
        console.log(`Page was successfully downloaded into '${filepath}'`);
      })
      // Библиотека не должна подавалять ошибки, иначе невозможно будет сделать catch
      // https://ru.hexlet.io/blog/posts/sovershennyy-kod-obrabotka-oshibok-v-bibliotekah
      .catch((error) => {
        // Вывод ошибок только тут.
        console.error(error.message);
        // Обязательно код выхода (не обязательно 1, главное не 0)
        process.exit(1);
      });
  });

program.parse(process.argv);

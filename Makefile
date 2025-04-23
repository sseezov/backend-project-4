setup:
	npm install

install:
	npm ci

run:
	rm -rf tmp
	mkdir tmp
	./bin/page-loader.js --output tmp https://ru.hexlet.io/courses

lint:
	npx eslint .

test:
	DEBUG=page-loader* npm test

test-coverage:
	npm test -- --coverage --coverageProvider=v8

publish:
	npm publish --dry-run

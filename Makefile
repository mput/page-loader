install:
	npm install

build:
	rm -rf dist
	npm run build

test:
	npm test

testwatch:
	jest --watchAll

lint:
	npm run eslint .

publish:
	npm publish

.PHONY: test

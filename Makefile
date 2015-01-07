
RAW = $(shell find lib -maxdepth 1 -name "*.js" -type f) lib/adapters/browser-adapter.js

all: bolero.js

bolero.js: $(RAW) support/compile.js
	@node support/compile $(RAW)

clean:
	rm -f bolero.js

.PHONY: all clean

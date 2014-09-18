
RAW = $(shell find lib -maxdepth 1 -name "*.js" -type f)

all: bolero.js

bolero.js: $(RAW)
	@node support/compile $(RAW)

test: $(RAW)
	@node support/compile -t $(RAW)

clean:
	rm -f bolero.js
	rm -f _bolero.js

.PHONY: all clean test

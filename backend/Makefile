# Movie Store — one place for every command. Run `make` (or `make help`) to list targets.
# Name and version come from package.json, so `npm version patch` is the only bump needed.
PROJECT   := $(shell node -p "require('./package.json').name")
VERSION   := $(shell node -p "require('./package.json').version")
IMAGE     := $(PROJECT):$(VERSION)
CONTAINER := $(PROJECT)
PORT      ?= 3000
SERVICES  := $(notdir $(wildcard services/*))
SYNCED    := entities shared

.DEFAULT_GOAL := help
.PHONY: help sync check-sync clean-sync dev build test docker-build deploy logs stop version token

help: ## List all targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-14s %s\n", $$1, $$2}'

sync: ## Copy root entities/ and shared/ into every service (read-only copies)
	@for svc in $(SERVICES); do \
	  for dir in $(SYNCED); do \
	    rsync -a --delete --chmod=Fa-w,Du+w $$dir/ services/$$svc/$$dir/; \
	  done; \
	done
	@echo "Synced $(SYNCED) into: $(SERVICES)"

check-sync: ## Fail if any service copy differs from its source
	@status=0; \
	for svc in $(SERVICES); do \
	  for dir in $(SYNCED); do \
	    if ! diff -r $$dir services/$$svc/$$dir > /dev/null 2>&1; then \
	      echo "❌ services/$$svc/$$dir is out of sync with /$$dir:"; \
	      diff -rq $$dir services/$$svc/$$dir | sed 's/^/   /'; \
	      status=1; \
	    fi; \
	  done; \
	done; \
	if [ $$status -ne 0 ]; then echo "Run 'make sync' (and edit only the root $(SYNCED) folders)."; exit 1; fi; \
	echo "✅ All service copies match their source"

clean-sync: ## Remove the generated copies
	@for svc in $(SERVICES); do \
	  for dir in $(SYNCED); do chmod -R u+w services/$$svc/$$dir 2>/dev/null; rm -rf services/$$svc/$$dir; done; \
	done

dev: sync ## Run locally with auto-restart (nodemon re-syncs on change)
	npx nodemon

build: sync check-sync ## Sync, check, and syntax-check every .js file (there is no compile step)
	@find . \( -name '*.js' -o -name '*.mjs' \) -not -path '*/node_modules/*' -print0 \
	  | xargs -0 -n1 node --check
	@echo "✅ Syntax OK"

test: sync check-sync ## Run all tests (in-memory MongoDB replica set)
	@node scripts/verify-tests.js
	npx vitest run

docker-build: build ## Build the Docker image $(IMAGE)
	docker build -t $(IMAGE) -t $(PROJECT):latest --label org.opencontainers.image.version=$(VERSION) .

deploy: docker-build ## Run the image locally as container $(CONTAINER) and wait for /health
	@test -f .env || { echo "❌ .env not found. Copy .env.example to .env first."; exit 1; }
	@docker rm -f $(CONTAINER) > /dev/null 2>&1 || true
	docker run -d --name $(CONTAINER) --env-file .env -p $(PORT):3000 --restart unless-stopped $(IMAGE)
	@for i in $$(seq 1 30); do \
	  if curl -fsS http://localhost:$(PORT)/health > /dev/null 2>&1; then \
	    echo "Deployed $(IMAGE) as container $(CONTAINER) on http://localhost:$(PORT)"; exit 0; \
	  fi; \
	  sleep 1; \
	done; \
	echo "❌ /health did not return 200 within 30 s. Last logs:"; docker logs --tail 30 $(CONTAINER); exit 1

logs: ## Follow the container logs
	docker logs -f $(CONTAINER)

stop: ## Stop and remove the container
	docker rm -f $(CONTAINER)

version: ## Print name and version
	@echo "$(PROJECT) $(VERSION)"

token: ## Print an access token (use: TOKEN=$$(make -s token))
	@node scripts/token.js


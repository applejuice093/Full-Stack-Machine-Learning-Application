# Local helpers for Linux/macOS/WSL. On Windows PowerShell, use the npm scripts
# documented in the README (dev:ml:win / test:ml:win).

PYTHON ?= ml-service/.venv/bin/python
PIP ?= ml-service/.venv/bin/pip

.PHONY: install install-frontend install-backend install-ml \
	dev-frontend dev-backend dev-ml \
	test test-backend test-ml \
	db-up db-down db-ps \
	build-frontend

install: install-frontend install-backend install-ml

install-frontend:
	npm install --prefix frontend

install-backend:
	npm install --prefix backend

install-ml:
	@test -d ml-service/.venv || python3 -m venv ml-service/.venv
	$(PIP) install -r ml-service/requirements-dev.txt

dev-frontend:
	npm run dev --prefix frontend

dev-backend:
	npm run dev --prefix backend

dev-ml:
	$(PYTHON) -m uvicorn app.main:app --reload --app-dir ml-service --port 8000

test: test-backend test-ml

test-backend:
	npm test --prefix backend

test-ml:
	$(PYTHON) -m pytest ml-service/tests

db-up:
	docker compose up -d

db-down:
	docker compose down

db-ps:
	docker compose ps

build-frontend:
	npm run build --prefix frontend

PY := backend/.venv/bin/python
PIP := backend/.venv/bin/pip
MANAGE := cd backend && .venv/bin/python manage.py

.PHONY: setup db migrate seed backend worker beat frontend dev test test-backend test-frontend lint brand gen-api e2e build

setup: ## Create the venv, install deps, create databases, migrate
	python3 -m venv backend/.venv
	$(PIP) install -r backend/requirements.txt
	cd frontend && npm install
	-createdb sartoria
	-createdb sartoria_test
	psql -d sartoria -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
	psql -d sartoria_test -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
	$(MANAGE) migrate

migrate:
	$(MANAGE) makemigrations
	$(MANAGE) migrate

seed: ## Load demo data (add ARGS=--flush to wipe first)
	$(MANAGE) seed_demo $(ARGS)

backend:
	$(MANAGE) runserver 0.0.0.0:8000

worker:
	cd backend && .venv/bin/celery -A config worker -l info

beat:
	cd backend && .venv/bin/celery -A config beat -l info

frontend:
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && .venv/bin/pytest

test-frontend:
	cd frontend && npm test

lint:
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd frontend && npm run lint && npm run typecheck

brand: ## Regenerate logo SVG/PNG assets from the font outlines
	$(PY) scripts/build_brand_assets.py

gen-api: ## Regenerate TypeScript API types from the running backend
	cd frontend && npm run gen:api

build:
	cd frontend && npm run build
	$(MANAGE) collectstatic --noinput

e2e:
	cd frontend && npm run e2e

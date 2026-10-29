PY := backend/.venv/bin/python
PIP := backend/.venv/bin/pip
MANAGE := cd backend && .venv/bin/python manage.py

.PHONY: setup db migrate seed backend worker beat frontend dev test test-backend test-frontend test-integration lint brand gen-api e2e build serve-prod loadtest

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

test-integration: ## End-to-end business journeys through the HTTP API
	cd backend && .venv/bin/pytest tests/integration

test-frontend:
	cd frontend && npm test

lint:
	cd backend && .venv/bin/ruff format --check . && .venv/bin/ruff check .
	cd frontend && npm run lint && npm run typecheck

brand: ## Regenerate logo SVG/PNG assets from the font outlines
	$(PY) scripts/build_brand_assets.py

gen-api: ## Regenerate TypeScript API types from the running backend
	cd frontend && npm run gen:api

build: ## Production build: SPA bundle (pre-compressed for WhiteNoise) and Django static files
	cd frontend && npm run build
	$(PY) -m whitenoise.compress frontend/dist
	$(MANAGE) collectstatic --noinput

e2e:
	cd frontend && npm run e2e

# ---------------------------------------------------------------------------- production-like local run
# Gunicorn with production settings on :8001 (run `make build` first). LOADTEST=1 lifts the per-IP
# rate limits, because every simulated user in a load test shares this machine's IP.
LOADTEST_THROTTLES := $(if $(LOADTEST),THROTTLE_ANON=1000000/min THROTTLE_USER=1000000/min THROTTLE_SEARCH=1000000/min THROTTLE_LOGIN=1000/min THROTTLE_LOGIN_EMAIL=10000/hour THROTTLE_CHECKOUT=100000/min,)
serve-prod:
	cd backend && DJANGO_SETTINGS_MODULE=config.settings.prod \
	  DJANGO_SECRET_KEY=$${DJANGO_SECRET_KEY:-local-$$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")} \
	  SECURE_SSL_REDIRECT=false REFRESH_COOKIE_SECURE=false DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 \
	  $(LOADTEST_THROTTLES) .venv/bin/gunicorn config.wsgi -b 127.0.0.1:8001 --workers 4 --threads 4 --keep-alive 10 --access-logfile /dev/null

# Headless load test; the HTML report lands in loadtest/reports/. Override USERS, SPAWN, DURATION, LOADTEST_HOST.
USERS ?= 50
SPAWN ?= 5
DURATION ?= 2m
LOADTEST_HOST ?= http://localhost:8001
loadtest:
	$(PIP) install -q -r loadtest/requirements.txt
	mkdir -p loadtest/reports
	cd loadtest && ../backend/.venv/bin/locust -f locustfile.py --headless -u $(USERS) -r $(SPAWN) -t $(DURATION) \
	  --host $(LOADTEST_HOST) --html reports/report.html --csv reports/stats --only-summary

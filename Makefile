# =============================================================================
#  ArchiSpark — Makefile
#
#  Variables overridables depuis la ligne de commande :
#    make build VERSION=1.2.3
#    make build OS=trixie-slim
#    make build REGISTRY=ghcr.io/myorg
#    make up ENV=prod
#
#  OS variants : alpine (défaut) | trixie-slim
#  ENV variants : dev (défaut — infra Docker + pnpm dev) | prod (stack Docker complet)
#                  charge .env.$(ENV) (créé via `make env`)
# =============================================================================

SHELL     := /bin/bash
NVM_DIR   ?= $(HOME)/.nvm

REGISTRY  ?= archispark
VERSION   ?= $(shell node -p "require('./package.json').version" 2>/dev/null \
               || grep '"version"' package.json | cut -d'"' -f4)
OS        ?= alpine

ENV       ?= dev
ENV_FILE  := .env.$(ENV)

-include $(ENV_FILE)

SERVICES  := api web mcp-server

DC        := $(shell if docker compose version >/dev/null 2>&1; then echo "docker compose"; else echo "docker-compose"; fi)
DC_PROD   := $(DC) -f .docker/docker-compose.yml
DC_DEV    := $(DC) -f .docker/docker-compose.dev.yml

ifeq ($(ENV),prod)
DC_ENV := $(DC_PROD)
else
DC_ENV := $(DC_DEV)
endif

.DEFAULT_GOAL := help

# =============================================================================
#  Aide
# =============================================================================

.PHONY: help
help:
	@printf "\033[1mArchiSpark $(VERSION)\033[0m — cibles disponibles\n\n"
	@printf "\033[4mStack\033[0m (ENV=$(ENV) — défaut dev: infra Docker + pnpm dev · prod: stack Docker complet)\n"
	@printf "  \033[36mup\033[0m              Démarrer (ENV=dev|prod)\n"
	@printf "  \033[36mdown\033[0m            Arrêter\n"
	@printf "  \033[36mrestart\033[0m         Redémarrer tous les services\n"
	@printf "  \033[36mlogs\033[0m            Suivre les logs en temps réel\n"
	@printf "  \033[36mps\033[0m              État des services\n"
	@printf "  \033[36mpull\033[0m            Mettre à jour les images (ENV=prod)\n"
	@printf "\n\033[4mKeycloak / démo\033[0m\n"
	@printf "  \033[36msetup-demo\033[0m       Setup complet démo : realm + comptes + workspaces (keycloak-setup → seed-demo-users → seed-demo)\n"
	@printf "  \033[36mkeycloak-setup\033[0m   Créer/mettre à jour le realm Keycloak (realm-export.json)\n"
	@printf "  \033[36mseed-demo-users\033[0m  Créer/mettre à jour les 4 comptes Keycloak de démo (admin/user/contrib/archi)\n"
	@printf "  \033[36mseed-demo\033[0m        Charger les workspaces de démo (ArchiMetal/ArchiSurance)\n"
	@printf "\n\033[4mBuild\033[0m (OS=$(OS) VERSION=$(VERSION))\n"
	@printf "  \033[36mbuild\033[0m           Builder toutes les images pour l'OS courant\n"
	@printf "  \033[36mbuild-api\033[0m       Builder l'image API\n"
	@printf "  \033[36mbuild-web\033[0m       Builder l'image web\n"
	@printf "  \033[36mbuild-mcp\033[0m       Builder l'image mcp-server\n"
	@printf "  \033[36mbuild-all\033[0m       Builder toutes les images (alpine + trixie-slim)\n"
	@printf "\n\033[4mUtilitaires\033[0m\n"
	@printf "  \033[36minstall\033[0m         Installer les dépendances (pnpm install)\n"
	@printf "  \033[36menv\033[0m             Créer .env.$(ENV) depuis .env.example si absent (ENV=dev|prod)\n"
	@printf "  \033[36mclean\033[0m           Supprimer les images ArchiSpark locales\n"
	@printf "  \033[36mprune\033[0m           docker system prune (images non utilisées)\n"
	@printf "  \033[36mversion\033[0m         Afficher la version du projet\n"
	@printf "\n"

# =============================================================================
#  Stack (ENV=dev|prod)
# =============================================================================

.PHONY: up down restart logs ps pull

up: $(ENV_FILE)
ifeq ($(ENV),prod)
	ARCHISPARK_OS=$(OS) ARCHISPARK_VERSION=$(VERSION) $(DC_ENV) --env-file $(ENV_FILE) up -d
else
	$(DC_ENV) --env-file $(ENV_FILE) up -d --wait
	. $(NVM_DIR)/nvm.sh && nvm use 24 && set -a && . ./$(ENV_FILE) && set +a && pnpm dev
endif

down:
	$(DC_ENV) --env-file $(ENV_FILE) down

restart:
	$(DC_ENV) --env-file $(ENV_FILE) restart

logs:
	$(DC_ENV) --env-file $(ENV_FILE) logs -f

ps:
	$(DC_ENV) --env-file $(ENV_FILE) ps

pull:
	ARCHISPARK_OS=$(OS) ARCHISPARK_VERSION=$(VERSION) $(DC_ENV) --env-file $(ENV_FILE) pull

# =============================================================================
#  Keycloak / démo (ENV=dev|prod)
# =============================================================================

.PHONY: setup-demo keycloak-setup seed-demo-users seed-demo

# Setup complet démo : realm Keycloak + comptes de démo + workspaces.
# Idempotent — safe à relancer après une mise à jour du realm ou des données.
setup-demo: keycloak-setup seed-demo-users seed-demo

# Crée/mets à jour le realm Keycloak (rôles, clients, service
# account) depuis .docker/keycloak/realm-export.json — idempotent, fonctionne
# en local et sur n'importe quel realm distant (voir docs/deployment.md).
keycloak-setup: $(ENV_FILE)
	. $(NVM_DIR)/nvm.sh && nvm use 24 && set -a && . ./$(ENV_FILE) && set +a && pnpm setup:realm

# Crée/mets à jour les 4 comptes Keycloak de démo (admin/user/contrib/archi)
# depuis .docker/keycloak/demo-users.json.
seed-demo-users: $(ENV_FILE)
	. $(NVM_DIR)/nvm.sh && nvm use 24 && set -a && . ./$(ENV_FILE) && set +a && pnpm seed:demo-users

# Charge les workspaces de démo (ArchiMetal/ArchiSurance) dans l'organisation
# Keycloak existante — idempotent, réinitialise leur contenu si déjà présents.
seed-demo: $(ENV_FILE)
	. $(NVM_DIR)/nvm.sh && nvm use 24 && set -a && . ./$(ENV_FILE) && set +a && pnpm seed:demo

# =============================================================================
#  Build des images
# =============================================================================

# Usage interne : $(call build-image,<service>,<os>)
define build-image
	docker build \
		--file .docker/$(1)/$(2)/Dockerfile \
		--tag $(REGISTRY)/archispark-$(1):$(2)-$(VERSION) \
		--tag $(REGISTRY)/archispark-$(1):$(2)-latest \
		.
endef

.PHONY: build build-api build-web build-mcp build-all

build: build-api build-web build-mcp

build-api:
	$(call build-image,api,$(OS))

build-web:
	$(call build-image,web,$(OS))

build-mcp:
	$(call build-image,mcp-server,$(OS))

build-all:
	@for os in alpine trixie-slim; do \
		echo ""; \
		echo "==> Build ($$os) version=$(VERSION)"; \
		$(MAKE) --no-print-directory build OS=$$os VERSION=$(VERSION) || exit 1; \
	done

# =============================================================================
#  Utilitaires
# =============================================================================

.PHONY: install env clean prune version

# Installe les dépendances du monorepo (pnpm install).
install:
	. $(NVM_DIR)/nvm.sh && nvm use 24 && pnpm install

# Cibles fichier : créent .env.dev / .env.prod depuis .env.example uniquement s'ils sont absents.
.env.dev:
	@if [ -f .env.example ]; then \
		cp .env.example .env.dev; \
		echo "Fichier .env.dev créé depuis .env.example — modifiez-le avant 'make up'."; \
	else \
		echo "Erreur : .env.example introuvable. Créez .env.dev manuellement."; \
		exit 1; \
	fi

.env.prod:
	@if [ -f .env.example ]; then \
		cp .env.example .env.prod; \
		echo "Fichier .env.prod créé depuis .env.example — modifiez-le avant 'make up ENV=prod'."; \
	else \
		echo "Erreur : .env.example introuvable. Créez .env.prod manuellement."; \
		exit 1; \
	fi

env: $(ENV_FILE)

clean:
	@echo "Suppression des images ArchiSpark locales..."
	-docker images --filter reference='$(REGISTRY)/archispark-*' -q \
		| xargs -r docker rmi -f

prune:
	docker system prune -f

version:
	@echo "$(VERSION)"

# =============================================================================
#  ArchiSpark — Makefile
#
#  Variables overridables depuis la ligne de commande :
#    make build VERSION=1.2.3
#    make build OS=trixie-slim
#    make push  REGISTRY=ghcr.io/myorg
#
#  OS variants : alpine (défaut) | trixie-slim
# =============================================================================

SHELL     := /bin/bash
NVM_DIR   ?= $(HOME)/.nvm

REGISTRY  ?= archispark
VERSION   ?= $(shell node -p "require('./package.json').version" 2>/dev/null \
               || grep '"version"' package.json | cut -d'"' -f4)
OS        ?= alpine

SERVICES  := api web mcp-server

DC        := docker compose
DC_PROD   := $(DC) -f .docker/docker-compose.yml
DC_DEV    := $(DC) -f .docker/docker-compose.dev.yml

.DEFAULT_GOAL := help

# =============================================================================
#  Aide
# =============================================================================

.PHONY: help
help:
	@printf "\033[1mArchiSpark $(VERSION)\033[0m — cibles disponibles\n\n"
	@printf "\033[4mProduction\033[0m (images Docker Hub)\n"
	@printf "  \033[36mup\033[0m              Démarrer le stack complet\n"
	@printf "  \033[36mdown\033[0m            Arrêter le stack\n"
	@printf "  \033[36mrestart\033[0m         Redémarrer tous les services\n"
	@printf "  \033[36mlogs\033[0m            Suivre les logs en temps réel\n"
	@printf "  \033[36mps\033[0m              État des services\n"
	@printf "  \033[36mpull\033[0m            Mettre à jour les images Hub\n"
	@printf "\n\033[4mDéveloppement\033[0m\n"
	@printf "  \033[36mdev\033[0m             Postgres + Redis en Docker, puis pnpm dev (hot-reload)\n"
	@printf "  \033[36mdev-infra\033[0m       Postgres + Redis seulement (background)\n"
	@printf "  \033[36mdev-down\033[0m        Arrêter l'infrastructure de dev\n"
	@printf "  \033[36mdev-logs\033[0m        Suivre les logs de dev\n"
	@printf "  \033[36mdev-ps\033[0m          État des services de dev\n"
	@printf "\n\033[4mBuild\033[0m (OS=$(OS) VERSION=$(VERSION))\n"
	@printf "  \033[36mbuild\033[0m           Builder toutes les images pour l'OS courant\n"
	@printf "  \033[36mbuild-api\033[0m       Builder l'image API\n"
	@printf "  \033[36mbuild-web\033[0m       Builder l'image web\n"
	@printf "  \033[36mbuild-mcp\033[0m       Builder l'image mcp-server\n"
	@printf "  \033[36mbuild-all\033[0m       Builder toutes les images (alpine + trixie-slim)\n"
	@printf "\n\033[4mPush\033[0m (REGISTRY=$(REGISTRY))\n"
	@printf "  \033[36mpush\033[0m            Pousser toutes les images (OS courant)\n"
	@printf "  \033[36mpush-api\033[0m        Pousser l'image API\n"
	@printf "  \033[36mpush-web\033[0m        Pousser l'image web\n"
	@printf "  \033[36mpush-mcp\033[0m        Pousser l'image mcp-server\n"
	@printf "  \033[36mpush-all\033[0m        Pousser toutes les images (alpine + trixie-slim)\n"
	@printf "  \033[36mrelease\033[0m         build-all + push-all  (make release VERSION=x.y.z)\n"
	@printf "\n\033[4mUtilitaires\033[0m\n"
	@printf "  \033[36menv\033[0m             Créer .env depuis .env.example si absent\n"
	@printf "  \033[36mclean\033[0m           Supprimer les images ArchiSpark locales\n"
	@printf "  \033[36mprune\033[0m           docker system prune (images non utilisées)\n"
	@printf "  \033[36mversion\033[0m         Afficher la version du projet\n"
	@printf "\n"

# =============================================================================
#  Production
# =============================================================================

.PHONY: up down restart logs ps pull

up: .env
	ARCHISPARK_OS=$(OS) ARCHISPARK_VERSION=$(VERSION) $(DC_PROD) up -d

down:
	$(DC_PROD) down

restart:
	$(DC_PROD) restart

logs:
	$(DC_PROD) logs -f

ps:
	$(DC_PROD) ps

pull:
	ARCHISPARK_OS=$(OS) ARCHISPARK_VERSION=$(VERSION) $(DC_PROD) pull

# =============================================================================
#  Développement
# =============================================================================

.PHONY: dev dev-infra dev-down dev-logs dev-ps

dev: dev-infra
	. $(NVM_DIR)/nvm.sh && nvm use 24 && set -a && . ./.env && set +a && pnpm dev

dev-infra:
	$(DC_DEV) up -d --wait

dev-down:
	$(DC_DEV) down

dev-logs:
	$(DC_DEV) logs -f

dev-ps:
	$(DC_DEV) ps

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
#  Push des images
# =============================================================================

# Usage interne : $(call push-image,<service>,<os>)
define push-image
	docker push $(REGISTRY)/archispark-$(1):$(2)-$(VERSION)
	docker push $(REGISTRY)/archispark-$(1):$(2)-latest
endef

.PHONY: push push-api push-web push-mcp push-all

push: push-api push-web push-mcp

push-api:
	$(call push-image,api,$(OS))

push-web:
	$(call push-image,web,$(OS))

push-mcp:
	$(call push-image,mcp-server,$(OS))

push-all:
	@for os in alpine trixie-slim; do \
		echo ""; \
		echo "==> Push ($$os) version=$(VERSION)"; \
		$(MAKE) --no-print-directory push OS=$$os VERSION=$(VERSION) || exit 1; \
	done

# =============================================================================
#  Release : build-all + push-all
# =============================================================================

.PHONY: release

release: build-all push-all
	@echo ""
	@echo "Release $(VERSION) poussée (alpine + trixie-slim)."

# =============================================================================
#  Utilitaires
# =============================================================================

.PHONY: env clean prune version

# Cible fichier : crée .env depuis .env.example uniquement s'il est absent.
.env:
	@if [ -f .env.example ]; then \
		cp .env.example .env; \
		echo "Fichier .env créé depuis .env.example — modifiez-le avant 'make up'."; \
	else \
		echo "Erreur : .env.example introuvable. Créez .env manuellement."; \
		exit 1; \
	fi

env: .env

clean:
	@echo "Suppression des images ArchiSpark locales..."
	-docker images --filter reference='$(REGISTRY)/archispark-*' -q \
		| xargs -r docker rmi -f

prune:
	docker system prune -f

version:
	@echo "$(VERSION)"

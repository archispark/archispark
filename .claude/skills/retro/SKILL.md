---
name: retro
description: Rétrospective de session — extraire les leçons de la session en cours et proposer des mises à jour de la configuration
disable-model-invocation: true
---

Analyse la session en cours et rends un rapport en trois sections :

1. **Corrections récurrentes** : ce que l'utilisateur a dû corriger ou
   répéter. Pour chaque cas, propose la règle exacte à ajouter
   (CLAUDE.md si transverse, .claude/rules/ avec `paths:` si thématique).
2. **Décisions prises** : les choix d'architecture ou de convention
   faits pendant la session. Propose les entrées pour docs/decisions.md.
3. **Nettoyage** : règles existantes devenues obsolètes ou contredites,
   à modifier ou supprimer.

Applique uniquement ce que l'utilisateur valide, point par point.
Ne modifie jamais la configuration sans validation explicite.

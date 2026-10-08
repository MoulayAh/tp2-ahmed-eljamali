# salles-api

API interne de reservation de salles.

```bash
npm install
npm start          # http://localhost:3000
```

## Endpoints

| Methode | Route | Role |
|---|---|---|
| GET | `/health` | sonde de vie |
| GET | `/rooms` | catalogue des salles |
| GET | `/rooms/:id` | une salle et ses reservations |
| GET | `/bookings?roomId=` | les reservations |
| POST | `/bookings` | creer une reservation |
| DELETE | `/bookings/:id` | annuler une reservation |

Exemple :

```bash
curl -s localhost:3000/rooms | jq
curl -s -X POST localhost:3000/bookings \
  -H 'content-type: application/json' \
  -d '{"roomId":"salle-a","who":"moi","people":4,
       "startsAt":"2026-11-02T09:00:00Z","endsAt":"2026-11-02T11:00:00Z"}' | jq
```

## Outillage agent

Le depot embarque une chaine d'agents, pour Claude Code (`.claude/`, `CLAUDE.md`) et pour
OpenCode (`.opencode/`) : un agent principal `architect` et six subagents specialises.
Sous Claude Code, `claude` demarre directement sur l'architecte ; `/agents` les liste.
Le diagnostic de la chaine et ce qui a ete repare sont dans `DIAGNOSTIC.md`.

## Etat du projet

L'equipe qui a monte ce service est partie. Le service tourne en production depuis
huit mois. La chaine d'agents a ete installee en juin et personne ne l'a revue depuis.

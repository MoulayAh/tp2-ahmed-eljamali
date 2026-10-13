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
| GET | `/rooms/:id/availability?date=YYYY-MM-DD` | creneaux libres d'une salle sur la journee (08:00-20:00 UTC, pas de 60 min) |
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

Le depot embarque une chaine d'agents OpenCode (`.opencode/`) : un agent principal
`architect` et six subagents specialises (`finder`, `explorer`, `planner`, `dev`,
`reviewer`, `tester`). `opencode agent list` les liste avec leurs droits effectifs.

## Verifications

`npm install` active le hook `pre-commit` (typecheck, lint, tests ; pas de commit sur
`main`). La CI relance les memes checks et la couverture sur chaque PR. Le detail est
dans `AGENTS.md`.

## Etat du projet

L'equipe qui a monte ce service est partie. Le service tourne en production depuis
huit mois. La chaine d'agents, installee en juin, a ete revue en octobre 2026 : voir
`DIAGNOSTIC.md`.

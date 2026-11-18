// Ida y vuelta de task.extra por la WEB (normalizeTaskForDb -> hydrateTaskFromDb -> normalizeTaskForDb).
// Los campos que escriben el móvil o MAMA no deben perderse al guardar desde la web.
//   node --test src/sync/normalizeTask.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

const { normalizeTaskForDb, hydrateTaskFromDb } = await import("./normalizeTask.ts");

const base = {
  id: "00000000-0000-4000-8000-000000000001",
  metaId: "00000000-0000-4000-8000-000000000002",
  parentId: null, level: 0, order: 0, kind: "NORMAL",
  type: "ACTIVIDAD", scope: "LABORAL", title: "sintética",
  date: "2026-11-18", time: "10:00", isCompleted: false, points: 2,
};

test("conserva archivado, nivel de aviso, snooze y extra.mama en ida y vuelta", () => {
  const extra = {
    reminderEnabled: true, archived: true, archivedAt: "2026-11-18T09:00:00.000Z",
    alertLevel: "urgente", alertSnooze: { occurrence: "2026-11-18T10:00", until: "2026-11-18T11:00:00.000Z" },
    mama: { origen: "mama", nota: "x" },
  };
  const db = normalizeTaskForDb({ ...base, extra });
  const vuelta = normalizeTaskForDb(hydrateTaskFromDb(db));
  for (const k of Object.keys(extra)) assert.deepEqual(vuelta.extra[k], extra[k], k);
});

test("descarta valores inválidos de esos campos", () => {
  const db = normalizeTaskForDb({ ...base, extra: { archived: "si", archivedAt: "nunca", alertLevel: "normal", mama: [1] } });
  for (const k of ["archived", "archivedAt", "alertLevel", "mama"]) assert.equal(k in db.extra, false, k);
});

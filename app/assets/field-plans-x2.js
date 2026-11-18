"use strict";

function sceneItinerary(scenes, chapter, faction, includeConditional) {
  const destinations = new Map();
  for (const scene of x2GroupSceneChecks(scenes.filter((row) => row.chapter === chapter))) {
    if (
      scene.done ||
      (faction !== "any" && scene.branch && scene.branch !== faction) ||
      (!includeConditional && scene.conditional)
    )
      continue;
    const destination = scene.visit || scene.location.split(/ · | - /)[0];
    if (!destinations.has(destination)) destinations.set(destination, []);
    destinations.get(destination).push(scene);
  }
  return [...destinations].sort(([a], [b]) => a.localeCompare(b));
}
function drawErrands(current, view) {
  const scenes = x2SceneAudit(current);
  if (!scenes) {
    view.list.append(entry("Chapter flags unavailable", "Load an FFX-2 USA save."));
    return;
  }
  const faction = fieldChoices.faction || "any",
    chapter = fieldChoices.errandChapter || 0;
  planSelect(
    view.controls,
    "Chapter to visit",
    [[0, "Current chapter"], ...[1, 2, 3, 4, 5].map((n) => [n, "Chapter " + n])],
    chapter,
    (v) => {
      fieldChoices.errandChapter = Number(v);
      planRefresh();
    }
  );
  planSelect(
    view.controls,
    "Story branch",
    [
      ["any", "Both routes"],
      ["league", "Youth League"],
      ["yevon", "New Yevon"]
    ],
    faction,
    (v) => {
      fieldChoices.faction = v;
      planRefresh();
    }
  );
  planSelect(
    view.controls,
    "Conditional scenes",
    [
      [1, "Include"],
      [0, "Hide"]
    ],
    fieldChoices.conditions ?? 1,
    (v) => {
      fieldChoices.conditions = Number(v);
      planRefresh();
    }
  );
  const trip = sceneItinerary(scenes, chapter || current.chapter, faction, fieldChoices.conditions !== 0);
  if (!trip.length) view.list.append(entry("No outstanding checks for this selection"));
  for (const [place, rows] of trip) {
    const details = element("details", "planner-config");
    details.dataset.detailKey = "visit:" + place;
    details.append(element("summary", "", place + " · " + planCount(rows.length, "check")));
    for (const row of rows)
      details.append(
        entry(
          row.name,
          [
            row.location,
            row.branch === "league"
              ? "Youth League"
              : row.branch === "yevon"
                ? "New Yevon"
                : row.conditional
                  ? "Conditional"
                  : ""
          ]
            .filter(Boolean)
            .join(" · "),
          row.action
        )
      );
    view.list.append(details);
  }
}
function sceneChanges(previous, scenes) {
  const before = new Set(previous);
  return scenes
    .filter((scene) => before.has(scene.key) !== scene.done)
    .map((scene) => ({ ...scene, gained: scene.done }));
}
function drawBookmark(current, view) {
  const scenes = x2SceneAudit(current);
  if (!scenes) {
    view.list.append(entry("Chapter flags unavailable", "Load an FFX-2 USA save."));
    return;
  }
  const key = "bookmark." + fieldContext(current),
    old = readCompanionSetting(planKey(key), null);
  if (!old || !Array.isArray(old.keys) || !old.keys.every((k) => typeof k === "string")) {
    const button = action("Bookmark this save", () => {
      if (!canRecordPlan(current)) {
        view.message.textContent = "Wait for a fresh live frame.";
        return;
      }
      planSave(
        key,
        {
          time: frame.timestamp,
          chapter: frame.chapter,
          room: roomName(frame),
          keys: x2SceneAudit(frame)
            .filter((s) => s.done)
            .map((s) => s.key)
        },
        view.message
      );
    });
    button.disabled = !canRecordPlan(current);
    view.controls.append(button);
    view.list.append(
      entry("Bookmark before advancing", "Load another save or keep playing to compare the recorded scenes.")
    );
    return;
  }
  view.controls.append(action("Clear bookmark", () => planSave(key, null, view.message)));
  const changes = sceneChanges(old.keys, scenes);
  view.list.append(
    entry(
      "Chapter " + old.chapter + " · " + old.room,
      new Date(old.time).toLocaleString(),
      planCount(changes.filter((s) => s.gained).length, "flag") +
        " added · " +
        changes.filter((s) => !s.gained).length +
        " absent relative to bookmark"
    )
  );
  for (const gained of [true, false]) {
    const groups = x2GroupSceneChecks(changes.filter((s) => s.gained === gained));
    for (const group of groups)
      view.list.append(
        entry(
          group.name,
          (gained ? "Added" : "Absent") +
            " · " +
            planCount(group.flags.length, "flag") +
            " · Chapter " +
            group.chapter,
          group.visit || group.location
        )
      );
  }
  if (!changes.length) view.list.append(entry("Same mapped scene flags"));
}
function drawBullets(current, view) {
  const choice = fieldChoices.bulletFilter || "missing";
  planSelect(
    view.controls,
    "Gun Mage abilities",
    [
      ["missing", "Missing on at least one character"],
      ["all", "All Blue Bullets"]
    ],
    choice,
    (v) => {
      fieldChoices.bulletFilter = v;
      planRefresh();
    }
  );
  const members = catalog.x2.party.slice(0, 3);
  const manual = members.filter((_, i) => !Number.isInteger(current.blueBullets?.[i]));
  if (manual.length)
    view.message.textContent = "Using manual Fiend Guide checks for " + manual.join(", ") + ".";
  let count = 0;
  for (const [i, [name, teachers, note]] of x2BlueBullets.entries()) {
    const needed = members.map((who, m) => ({ who, m })).filter(({ m }) => !x2BlueLearned(current, m, i));
    if (!needed.length && choice === "missing") continue;
    const row = entry(
      name,
      needed.length ? "Needs it: " + needed.map((m) => m.who).join(", ") : "All three learned",
      teachers.join(" · ")
    );
    if (note) row.append(element("p", "field-note", note));
    if (needed.length && current.oversoul)
      row.append(
        action("Open " + needed[0].who + "’s entry", () => openX2FieldGuide("blue", needed[0].m, name))
      );
    view.list.append(row);
    count++;
  }
  if (!count) view.list.append(entry("All three have all 16 Blue Bullets"));
}
function floorSweep(entries, first, last, seen) {
  const result = [];
  for (const [name, bit, place, range] of entries) {
    if (!range || seen(name, bit)) continue;
    let start = null,
      end = null;
    for (let floor = first; floor <= last; floor++)
      if (x2MatchesFloor(range, floor)) {
        start ??= floor;
        end = floor;
      }
    if (start !== null) result.push({ name, bit, place, range, start, end });
  }
  return result.sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name));
}
function drawSweep(current, view) {
  if (!/^[0-9a-f]{128}$/i.test(current.oversoul || "")) {
    view.list.append(entry("Waiting for Shinra’s Bestiary data"));
    return;
  }
  const first = planNumber(view.controls, "Starting floor", fieldChoices.floorStart || 1, 1, 100);
  const last = planNumber(view.controls, "Ending floor", fieldChoices.floorEnd || 20, 1, 100);
  const results = element("div");
  view.list.append(results);
  const draw = () => {
    results.replaceChildren();
    view.message.textContent = "";
    if (!first.validity.valid || !last.validity.valid || first.valueAsNumber > last.valueAsNumber) {
      view.message.textContent = "Enter a range from 1 to 100 with the starting floor first.";
      return;
    }
    fieldChoices.floorStart = first.valueAsNumber;
    fieldChoices.floorEnd = last.valueAsNumber;
    const rows = floorSweep(
      x2OversoulEntries,
      first.valueAsNumber,
      last.valueAsNumber,
      (name, bit) => x2OversoulSeen(current.oversoul, bit) || x2FieldChecks.has("oversoul:" + name)
    );
    for (const row of rows) {
      const floors = row.start === row.end ? "Floor " + row.start : "Floors " + row.start + "–" + row.end;
      const line = entry(row.name, floors, row.range === "Any" ? "Can appear on any floor" : row.place);
      line.append(action("Inspect " + row.name, () => openX2FieldGuide("oversoul", 0, row.name)));
      results.append(line);
    }
    if (!rows.length) results.append(entry("No outstanding entries in this range"));
  };
  first.addEventListener("input", draw);
  last.addEventListener("input", draw);
  draw();
}
function apShortlist(current, memberFilter) {
  const jobs = new Set(
    (current.loadout?.dresspheres || []).filter(([, qty]) => qty > 0).map(([id]) => id - 0x5000)
  );
  const rows = [];
  for (const member of [0, 1, 2]) {
    if (memberFilter !== "all" && Number(memberFilter) !== member) continue;
    for (const job of jobs)
      for (const a of x2AbilityProgress(current.dressphereAp?.[member], job)) {
        if (a.ap > 0 && !a.done) rows.push({ ...a, member, job, remaining: a.cost - a.ap });
      }
  }
  return rows.sort(
    (a, b) => a.remaining - b.remaining || a.member - b.member || a.name.localeCompare(b.name)
  );
}
function drawLessons(current, view) {
  if (!current.dressphereAp || !current.loadout) {
    view.list.append(entry("Dressphere AP unavailable", "Load a supported save with job progress."));
    return;
  }
  const member = fieldChoices.apMember || "all";
  planSelect(
    view.controls,
    "Training shortlist",
    [["all", "All three"], ...catalog.x2.party.slice(0, 3).map((name, i) => [i, name])],
    member,
    (v) => {
      fieldChoices.apMember = v;
      planRefresh();
    }
  );
  const rows = apShortlist(current, member);
  for (const row of rows) {
    const name = x2JobName(current.loadout.dressphereInfo, row.job + 0x5000);
    const line = entry(
      row.name,
      row.remaining + " AP to go",
      catalog.x2.party[row.member] + " · " + name + " · " + row.ap + "/" + row.cost + " AP"
    );
    line.append(
      action("Open " + name + " AP", () => {
        x2Member = row.member;
        x2ApJob = row.job;
        x2ApOpen = true;
        choose("equip");
      })
    );
    view.list.append(line);
  }
  if (!rows.length)
    view.list.append(
      entry("No partially learned AP abilities", "Start earning AP toward an ability on an owned dressphere.")
    );
}
function drawX2FieldPlan(current, id, view) {
  if (!current.disc) {
    view.list.append(entry("Load an FFX-2 PS2 save to use this tool"));
    return;
  }
  ({
    errands: drawErrands,
    bookmark: drawBookmark,
    bullets: drawBullets,
    sweep: drawSweep,
    lessons: drawLessons
  })[id](current, view);
}

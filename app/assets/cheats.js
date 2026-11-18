"use strict";

window.SpiraCheats = (() => {
  let token;
  let visible = false;
  let pending = false;
  let message = "";
  let selected = 0;
  let draft = "";
  let disc;
  let confirmation = null;
  let shareAp = false;
  const maxGil = 99999999;
  const supported = new Set(["SLPS-25088", "SLUS-20672"]);

  function redraw() {
    signature = "";
    render();
  }

  function settings() {
    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.checked = visible;
    checkbox.disabled = !token;
    checkbox.addEventListener("change", () => window.SpiraSetup.showCheatMenu(token, checkbox.checked));
    const label = element("label", "prep-choice");
    label.append(checkbox, "Show Cheat Menu");
    const section = element("section", "cheat-settings");
    section.append(element("h2", "", "Gameplay options"), label,
      element("p", "field-note", "Show one-time gil and item changes in the sidebar. Hidden by default."));
    panel.append(section);
  }

  function show(current, state) {
    heading("Cheat Menu");
    if (!visible) return;
    panel.append(element("p", "sub", "Changes apply to the running game and can carry into your next save."));
    const notice = element("p", "cheat-notice", message);
    notice.setAttribute("role", "status");
    panel.append(notice);
    if (current?.disc === "SLPS-25088") {
      const sharing = element("input"); sharing.type = "checkbox"; sharing.checked = shareAp;
      sharing.disabled = !token || typeof window.SpiraSetup?.partyApSharing !== "function";
      sharing.addEventListener("change", () => window.SpiraSetup.partyApSharing(token,sharing.checked));
      const label = element("label","goal-choice"); label.append(sharing,document.createTextNode("Share battle AP with the recruited party"));
      panel.append(label,element("p","field-note","Optional game modification. Marks recruited characters as participants during battle; victory status rules still apply. Turns off when you hide Cheats or restart Spira."));
    }
    if (state !== "live" || reconnecting || !supported.has(current?.disc) || current.party.length === 0 ||
        (current.game === "x2" && !current.chapter)) {
      confirmation = null;
      panel.append(element("p", "", "Resume FFX International or FFX-2 USA in ARMSX2 to use the Cheat Menu."));
      return;
    }
    if (disc !== current.disc) {
      disc = current.disc;
      selected = 0;
      draft = "";
      confirmation = null;
      if (!pending) notice.textContent = message = "";
    }
    if (current.battle) {
      confirmation = null;
      panel.append(element("p", "", "Finish the battle before applying a cheat."));
      return;
    }
    const amounts = itemAmounts(current.items);
    const inventory = [...amounts].filter(([id, qty]) =>
      id >= 0x2000 && id <= 0x200f && qty >= 1 && qty <= 99);
    if (selected && !inventory.some(([id]) => id === selected)) {
      selected = 0;
      draft = "";
    }
    const names = new Map([[0, "Gil"], ...inventory.map(([id]) => [id, current.game === "x" ?
      ffxData.items[id] : catalog.x2.recovery[id - 0x2000]])]);
    const name = names.get(selected);
    const before = selected ? amounts.get(selected) : current.gil;
    const minimum = selected ? 1 : 0;
    const maximum = selected ? 99 : maxGil;
    const context = [current.disc, current.room, current.story, selected, before];
    if (confirmation && confirmation.context !== context.join("/")) confirmation = null;

    const section = entry("Set amount", `Current ${name}: ${number.format(before)}`);
    const target = options("Cheat target", [...names], selected, value => {
      selected = Number(value);
      draft = "";
      confirmation = null;
      message = "";
      redraw();
    });
    target.disabled = pending;
    const label = element("label", "farm-target", "New amount");
    const input = element("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = minimum;
    input.max = maximum;
    input.value = draft || before;
    input.disabled = pending;
    label.append(input);
    const controls = element("div", "filters");
    const review = action("Review change", () => {
      confirmation = {amount:input.valueAsNumber, context:context.join("/")};
      message = "";
      redraw();
      panel.querySelector(".cheat-confirm")?.focus();
    }, true);
    const sync = () => {
      draft = input.value;
      review.disabled = pending || !input.value || !input.validity.valid || input.valueAsNumber === before;
    };
    input.addEventListener("input", sync);
    const quickAmount = action(selected ? "Set to 99" : "Add 100,000 gil", () => {
      input.value = selected ? 99 : Math.min(before + 100000, maximum);
      sync();
    });
    quickAmount.disabled = pending || before >= maximum;
    controls.append(quickAmount, review, action("Hide Cheat Menu", () => window.SpiraSetup.showCheatMenu(token, false)));
    section.append(target, label, element("p", "field-note", `Enter ${number.format(minimum)} to ${number.format(maximum)}.`));
    if (confirmation) {
      input.disabled = true;
      target.disabled = true;
      const confirm = action("Apply change", () => {
        const amount = confirmation.amount;
        confirmation = null;
        pending = true;
        message = "Applying live change…";
        window.SpiraSetup.applyCheat(token, ...context, amount);
        redraw();
      }, true);
      confirm.classList.add("cheat-confirm");
      const cancel = action("Cancel", () => { confirmation = null; redraw(); });
      const buttons = element("div", "filters");
      buttons.append(confirm, cancel);
      section.append(element("p", "detail",
        `Change ${name} from ${number.format(before)} to ${number.format(confirmation.amount)}?`), buttons);
    } else {
      section.append(controls);
    }
    sync();
    const sheet = element("div", "sheet");
    sheet.append(section);
    panel.append(sheet);
  }

  function visibility(show) {
    visible = show;
    if (!show) {
      shareAp = false;
      confirmation = null;
      selected = 0;
      draft = "";
      message = "";
      if (tab === "cheats") tab = "setup";
    }
    redraw();
  }

  return {
    initialize(key, show) { token = key; visibility(show); },
    apSharing(enabled) { shareAp = enabled; redraw(); },
    visibility,
    visible: () => visible,
    settings,
    show,
    result(applied, reason) {
      pending = false;
      if (!visible) return;
      message = applied ? "Change verified in ARMSX2." : reason;
      draft = "";
      if (tab === "cheats") redraw();
    }
  };
})();

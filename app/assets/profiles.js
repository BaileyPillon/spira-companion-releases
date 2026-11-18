"use strict";

// Profiles contain companion preferences and plans, never emulator saves or ROM data.
const SpiraProfiles = (() => {
  const registryKey = "spira.profiles.v1";
  const maxBytes = 4 * 1024 * 1024;
  const allowed = key => typeof key === "string" && key.startsWith("spira.") && key !== registryKey &&
    !/token|credential|cheat/i.test(key) && key.length < 160;
  function registry() {
    try {
      const value = JSON.parse(localStorage.getItem(registryKey));
      if (value?.version === 1 && Array.isArray(value.profiles) && value.profiles.some(p => p.id === value.active)) return value;
    } catch {}
    return {version:1, active:"original", profiles:[{id:"original",name:"My playthrough",data:{}}]};
  }
  function capture() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (allowed(key)) data[key] = localStorage.getItem(key);
    }
    return data;
  }
  function validateData(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("The backup has no companion data.");
    if (Object.keys(data).length > 250 || JSON.stringify(data).length > maxBytes) throw Error("This backup is too large.");
    for (const [key,value] of Object.entries(data)) {
      if (!allowed(key) || typeof value !== "string") throw Error("This file contains unsupported backup entries.");
    }
    return data;
  }
  function put(data) {
    for (const key of Object.keys(capture())) localStorage.removeItem(key);
    for (const [key,value] of Object.entries(data)) localStorage.setItem(key,value);
  }
  function transact(next, data) {
    const oldData = capture(), oldRegistry = localStorage.getItem(registryKey);
    try {
      if (data) put(validateData(data));
      localStorage.setItem(registryKey,JSON.stringify(next));
    } catch (error) {
      put(oldData);
      if (oldRegistry == null) localStorage.removeItem(registryKey); else localStorage.setItem(registryKey,oldRegistry);
      throw Error("There is not enough storage to save this profile. Export a backup before removing an old profile.");
    }
  }
  function name(value) {
    const cleaned = String(value || "").trim();
    if (!cleaned || cleaned.length > 80) throw Error("Use a profile name between 1 and 80 characters.");
    return cleaned;
  }
  function create(label, data = {}) {
    const next = registry();
    if (next.profiles.length >= 12) throw Error("You can keep 12 profiles. Export and remove an unused profile first.");
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,9);
    next.profiles.push({id,name:name(label),data:validateData(data)});
    transact(next);
    return id;
  }
  function activate(id) {
    const next = registry(), selected = next.profiles.find(p => p.id === id);
    if (!selected) throw Error("That profile is no longer available.");
    if (id === next.active) return;
    next.profiles.find(p => p.id === next.active).data = capture();
    const data = selected.data;
    selected.data = {};
    next.active = id;
    transact(next,data);
  }
  function rename(id,label) {
    const next = registry(), selected = next.profiles.find(p => p.id === id);
    if (!selected) throw Error("That profile is no longer available.");
    selected.name = name(label); transact(next);
  }
  function remove(id) {
    const next = registry();
    if (id === next.active) throw Error("Switch to another profile before removing this one.");
    next.profiles = next.profiles.filter(p => p.id !== id); transact(next);
  }
  function backup() {
    const current = registry();
    return JSON.stringify({format:"spira-companion-profile",version:1,
      name:current.profiles.find(p => p.id === current.active).name,exported:new Date().toISOString(),data:capture()},null,2);
  }
  function importBackup(text) {
    if (typeof text !== "string" || text.length > maxBytes) throw Error("Choose a Spira profile backup smaller than 4 MB.");
    let value; try { value = JSON.parse(text); } catch { throw Error("The backup is not valid JSON."); }
    if (value?.format !== "spira-companion-profile" || value.version !== 1) throw Error("Choose a version 1 Spira companion profile backup.");
    return create(value.name,validateData(value.data));
  }
  return {registry,capture,create,activate,rename,remove,backup,importBackup};
})();

function downloadCompanionFile(name, text) {
  if (window.SpiraSetup?.exportCompanion) { window.SpiraSetup.exportCompanion(name,text); return; }
  const url = URL.createObjectURL(new Blob([text],{type:"application/json"}));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

function showProfiles() {
  heading("Playthrough profiles","Goals, notes, checklists and saved builds stay with the profile you choose.");
  const registry = SpiraProfiles.registry();
  const message = element("p","field-note"); message.setAttribute("role","status");
  const perform = fn => { try { fn(); } catch (error) { message.textContent = error.message; } };
  const picker = options("Playthrough profile",registry.profiles.map(p => [p.id,p.name]),registry.active,() => {});
  const controls = element("div","filters");
  controls.append(picker,action("Switch profile",() => perform(() => {
    SpiraProfiles.activate(picker.value); window.location.reload();
  })));
  const label = element("label","plan-field","Profile name");
  const input = element("input"); input.maxLength = 80; input.value = registry.profiles.find(p => p.id === registry.active).name;
  picker.addEventListener("change",()=>{input.value=registry.profiles.find(p=>p.id===picker.value).name;});
  label.append(input);
  controls.append(label,action("Rename selected",() => perform(() => { SpiraProfiles.rename(picker.value,input.value); signature="";render(); })),
    action("Create empty profile",() => perform(() => { SpiraProfiles.create(input.value); signature="";render(); })),
    action("Duplicate current",() => perform(() => { SpiraProfiles.create(input.value,SpiraProfiles.capture()); signature="";render(); })));
  const remove = action("Remove selected profile",() => {
    if (picker.value === registry.active) { message.textContent="Switch to another profile before removing this one.";return; }
    const id = picker.value, selected = registry.profiles.find(p => p.id === id);
    message.replaceChildren(document.createTextNode(`Remove “${selected.name}” and its companion data? `),
      action("Confirm removal",() => perform(() => { SpiraProfiles.remove(id);signature="";render(); })),
      action("Keep profile",() => message.replaceChildren()));
  });
  controls.append(remove);
  panel.append(controls,element("h2","","Backup and restore"),
    element("p","field-note","Import creates a separate profile. Your current profile remains available. Game saves are managed in ARMSX2."));
  const files = element("div","controls");
  files.append(action("Export profile",() => perform(() => downloadCompanionFile("Spira-profile-"+new Date().toISOString().slice(0,10)+".json",SpiraProfiles.backup()))));
  const upload = element("input");upload.type="file";upload.accept="application/json,.json";upload.setAttribute("aria-label","Import companion profile");
  upload.addEventListener("change",async () => {
    if (!upload.files[0]) return;
    if (upload.files[0].size > 4*1024*1024) { message.textContent="Choose a backup smaller than 4 MB.";return; }
    try { SpiraProfiles.importBackup(await upload.files[0].text());signature="";render(); } catch(error) { message.textContent=error.message; }
  });
  files.append(upload);panel.append(files,message);
  if (window.SpiraSetup?.importCompanion) {
    upload.replaceWith(action("Import profile",()=>window.SpiraSetup.importCompanion("profile")));
  }
}

window.SpiraDocuments = {
  message(text) {
    let node=document.querySelector("#document-result");
    if(!node){node=element("p","field-note");node.id="document-result";node.setAttribute("role","status");panel.prepend(node);}
    node.textContent=text;
  },
  imported(kind,text) {
    try {
      if(kind==="profile"){SpiraProfiles.importBackup(text);signature="";choose("profiles");this.message("Imported as a separate profile. Select it to switch.");}
      else if(kind==="grid"){
        if(text.length>100000)throw Error("Choose a grid build smaller than 100 KB.");
        const value=JSON.parse(text);if(value.format!=="spira-grid-build")throw Error("Choose a Spira grid build file.");
        activeGridBuild=validateGridBuild(value.build);activeGridBuild.id=newGridBuildId();signature="";choose("grid-lab");
      }
    } catch(error) { this.message(error.message); }
  }
};

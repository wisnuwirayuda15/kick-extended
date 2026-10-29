// The userscript manager's menu, for the settings that have no UI on the page.
//
// Every command is registered again whenever one runs, in the order they were
// added. A toggle's label changes when it is clicked, and replacing only that
// entry would move it to the bottom of the menu.
//
// Greasemonkey 4 has no synchronous menu API, so there is simply no menu
// there rather than a crash. A manager without GM_unregisterMenuCommand gets
// the menu once, with labels that stop following their settings.

type MenuCommand = {
  /** Read on every render, so it can describe the current state. */
  label: () => string;
  run: () => void;
};

const commands: MenuCommand[] = [];
let registeredIds: any[] = [];

function render() {
  if (typeof GM_registerMenuCommand !== "function") return;
  if (registeredIds.length) {
    if (typeof GM_unregisterMenuCommand !== "function") return;
    registeredIds.forEach((id) => GM_unregisterMenuCommand(id));
  }

  registeredIds = commands.map((command) =>
    GM_registerMenuCommand(command.label(), () => {
      command.run();
      render();
    }),
  );
}

export function addMenuCommand(command: MenuCommand) {
  commands.push(command);
  render();
}

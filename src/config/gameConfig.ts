export enum GameMode {
  EDITOR = 'editor',
  SIMULATION = 'simulation',
  GAME = 'game',
  MENU = 'menu',
}

export const THEME_COLORS = {
  [GameMode.EDITOR]: '#1e1e1e',
  [GameMode.SIMULATION]: '#15291a',
  [GameMode.GAME]: '#251532',
  [GameMode.MENU]: '#111111',
};

export const TOOL_GROUP_THEME_COLORS = {
  [GameMode.EDITOR]: '#2d2d2d',
  [GameMode.SIMULATION]: '#1e3b25',
  [GameMode.GAME]: '#352047',
  [GameMode.MENU]: '#1e1e1e',
};

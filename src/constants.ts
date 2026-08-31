export enum GameMode {
    EDITOR = 'editor',
    SIMULATION = 'simulation',
    GAME = 'game',
}
  
export const THEME_COLORS = {
    [GameMode.EDITOR]: '#1e1e1e',
    [GameMode.SIMULATION]: '#15291a',
    [GameMode.GAME]: '#251532',
};

export const TOOL_GROUP_THEME_COLORS = {
    [GameMode.EDITOR]: '#2d2d2d',
    [GameMode.SIMULATION]: '#1e3b25',
    [GameMode.GAME]: '#352047',
};
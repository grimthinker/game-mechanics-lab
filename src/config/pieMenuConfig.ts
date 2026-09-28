export const PIE_MENU_CONFIG = {
  // Радиусы внутреннего кольца категорий
  innerRingInnerRadius: 44,
  innerRingOuterRadius: 104,

  // Радиусы внешнего веера подменю
  outerArcInnerRadius: 114,
  outerArcOuterRadius: 178,

  // Радиус центральной кнопки закрытия
  centerRadius: 30,

  // Лимиты внешнего веера
  maxVisibleSubmenuItems: 6,
  maxSubmenuArcAngle: Math.PI, // Максимальный размах веера: не более 180 градусов

  // Угловой размер кнопок пагинации по краям дуги (в радианах)
  navButtonAngle: Math.PI / 18, // 10 градусов
} as const;

import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import { EntityId, EntityConfig } from '../types';
import { Vec3 } from '../../types';
import { deg2Rad } from '../../utils';
import { EnvironmentComponent } from '../components/environment';

export function createDefaultEnvironmentConfig(): EntityConfig {
  const envComp: EnvironmentComponent = {
    timeOfDay: 10.0,
    dayDuration: 600,
    azimuth: deg2Rad(45),
    axialTilt: deg2Rad(23.5),
    fogDensity: 0.0012,
    ambientIntensity: 0.65,
    sunIntensityMultiplier: 1.0,
    hemiSkyColor: '#c8dcff',
    hemiGroundColor: '#5c4a38',
  };

  return {
    tag: { archetype: 'environment' },
    meta: { name: 'Окружение мира', entityType: 'environment' },
    environment: envComp,
    renderable: {
      zIndex: -1,
      isVisible: true,
      syncWithTransform: false,
    },
  };
}

export function assembleEnvironment(
  world: World,
  _physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  _position?: Vec3
): void {
  world.addComponent(id, 'tag', { archetype: 'environment' });
  world.addComponent(id, 'meta', {
    name: config.meta?.name || 'Окружение мира',
    entityType: 'environment',
  });

  if (config.environment) {
    world.addComponent(id, 'environment', { ...config.environment });
  }

  world.addComponent(id, 'renderable', {
    zIndex: -1,
    isVisible: true,
    syncWithTransform: false,
  });
}
